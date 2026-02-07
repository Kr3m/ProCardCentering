"""
Card Border Detection Server
Uses line detection to find card edges and printed borders
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import base64
import io
from PIL import Image

app = Flask(__name__)
CORS(app)

def detect_borders(image_data):
    """
    Detect card borders using Hough line detection
    Returns: {outerLeft, outerRight, outerTop, outerBottom, innerLeft, innerRight, innerTop, innerBottom}
    as percentages of image dimensions
    """
    # Decode the image from base64
    if isinstance(image_data, str):
        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]
        image_bytes = base64.b64decode(image_data)
        image_pil = Image.open(io.BytesIO(image_bytes))
        image = cv2.cvtColor(np.array(image_pil), cv2.COLOR_RGB2BGR)
    else:
        image = image_data
    
    height, width = image.shape[:2]
    
    # Find card edges using line detection
    card_bounds = _find_card_bounds_with_lines(image)
    
    if card_bounds is None:
        return None
    
    outer_left = (card_bounds['x_min'] / width) * 100
    outer_right = (card_bounds['x_max'] / width) * 100
    outer_top = (card_bounds['y_min'] / height) * 100
    outer_bottom = (card_bounds['y_max'] / height) * 100
    
    # Extract card region
    card_region = image[
        int(card_bounds['y_min']):int(card_bounds['y_max']),
        int(card_bounds['x_min']):int(card_bounds['x_max'])
    ]
    
    if card_region.size == 0:
        return None
    
    # Find inner borders within the card
    inner_left, inner_right, inner_top, inner_bottom = _detect_inner_borders(card_region)
    
    # Convert card-relative positions to image percentages
    card_width = card_bounds['x_max'] - card_bounds['x_min']
    card_height = card_bounds['y_max'] - card_bounds['y_min']
    
    if inner_left is not None:
        inner_left = ((card_bounds['x_min'] + inner_left * card_width) / width) * 100
    else:
        inner_left = outer_left + (outer_right - outer_left) * 0.08
    
    if inner_right is not None:
        inner_right = ((card_bounds['x_min'] + inner_right * card_width) / width) * 100
    else:
        inner_right = outer_right - (outer_right - outer_left) * 0.08
    
    if inner_top is not None:
        inner_top = ((card_bounds['y_min'] + inner_top * card_height) / height) * 100
    else:
        inner_top = outer_top + (outer_bottom - outer_top) * 0.08
    
    if inner_bottom is not None:
        inner_bottom = ((card_bounds['y_min'] + inner_bottom * card_height) / height) * 100
    else:
        inner_bottom = outer_bottom - (outer_bottom - outer_top) * 0.08
    
    return {
        'outerLeft': outer_left,
        'outerRight': outer_right,
        'outerTop': outer_top,
        'outerBottom': outer_bottom,
        'innerLeft': inner_left,
        'innerRight': inner_right,
        'innerTop': inner_top,
        'innerBottom': inner_bottom,
    }


def _find_card_bounds_with_lines(image):
    """Find card boundaries using contour + Hough fallback.

    Strategy:
    1. Try to detect a four-point polygon (contour approx) that matches a card
    2. Prefer inner/quadrilateral contours (card inside a toploader)
    3. If no quad found, fall back to Hough line grouping but pick inner clusters
    """
    height, width = image.shape[:2]

    # Create a mask for toploader-like colors to suppress its edges
    toploader_mask = _create_toploader_mask(image, '#A0A5C8')

    # Convert to grayscale and enhance edges
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    filtered = cv2.bilateralFilter(blurred, 9, 75, 75)
    edges = cv2.Canny(filtered, 50, 150)

    # Morph close to fill small gaps
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel, iterations=2)

    # Suppress edges that fall on toploader color areas
    if toploader_mask is not None:
        mask_inv = cv2.bitwise_not(toploader_mask)
        # ensure mask_inv matches edges dtype
        mask_inv_bool = (mask_inv > 0).astype('uint8') * 255
        closed = cv2.bitwise_and(closed, closed, mask=mask_inv)

    # Find contours and look for quadrilaterals
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        candidates = []
        for cnt in contours[:12]:
            area = cv2.contourArea(cnt)
            if area < (width * height) * 0.01:
                continue
            peri = cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
            if len(approx) == 4:
                x, y, w, h = cv2.boundingRect(approx)
                if w <= 0 or h <= 0:
                    continue
                aspect = w / float(h)
                rect_area = w * h
                solidity = area / float(rect_area) if rect_area > 0 else 0
                # Score: aspect closeness to card + solidity + relative area
                aspect_score = 1.0 - min(abs(aspect - 0.68) / 0.68, 1.0)
                area_score = min(area / float(width * height), 1.0)
                score = aspect_score * 0.6 + solidity * 0.25 + area_score * 0.15
                # Penalize overlap with toploader mask (prefer contours not matching toploader color)
                if toploader_mask is not None:
                    roi_mask = toploader_mask[y:y+h, x:x+w]
                    if roi_mask.size > 0:
                        overlap = cv2.countNonZero(roi_mask)
                        overlap_ratio = overlap / float(w * h)
                        score = score * (1.0 - min(overlap_ratio, 0.9))
                candidates.append((score, x, y, w, h, approx, area))

        if candidates:
            # Prefer the candidate that is not the absolute largest (to avoid toploader)
            candidates.sort(key=lambda c: c[0], reverse=True)
            best = candidates[0]
            _, x, y, w, h, approx, area = best
            # If best candidate is nearly full-image, try to pick a smaller one inside it
            if w > width * 0.95 and h > height * 0.95 and len(candidates) > 1:
                best = candidates[1]
                _, x, y, w, h, approx, area = best
            # Expand bounds slightly to account for edge detection offsets
            pad_x = max(1, int(w * 0.005))
            pad_y = max(1, int(h * 0.005))
            x_min = max(0, x - pad_x)
            x_max = min(width, x + w + pad_x)
            y_min = max(0, y - pad_y)
            y_max = min(height, y + h + pad_y)
            return {'x_min': x_min, 'x_max': x_max, 'y_min': y_min, 'y_max': y_max}

    # Fallback: Hough lines with clustering to avoid outer toploader
    # Dilate a bit for Hough
    dilated = cv2.dilate(edges, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)), iterations=1)
    lines = cv2.HoughLinesP(dilated, 1, np.pi / 180, 80, minLineLength=int(height * 0.2), maxLineGap=20)
    if lines is None:
        return None

    v_x = []
    h_y = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        if abs(x2 - x1) < 8:  # vertical
            v_x.append((x1, min(y1, y2), max(y1, y2)))
        elif abs(y2 - y1) < 8:  # horizontal
            h_y.append((y1, min(x1, x2), max(x1, x2)))

    if len(v_x) < 2 or len(h_y) < 2:
        return None

    # Cluster vertical x positions and pick inner cluster (avoid extremes)
    xs = sorted([x for x,_,_ in v_x])
    # compute gaps
    gaps = [(xs[i+1]-xs[i], i) for i in range(len(xs)-1)]
    if not gaps:
        return None
    # find largest gap which likely separates toploader edge from card
    gaps.sort(reverse=True)
    largest_gap, idx = gaps[0]
    # choose inner cluster between gap if gap near edges else pick central pair
    if largest_gap > width * 0.05 and idx >= 0:
        # take cluster on the side with more density toward center
        left_cluster = xs[:idx+1]
        right_cluster = xs[idx+1:]
        # pick closest clusters to center
        center_x = width / 2
        left_mean = np.mean(left_cluster) if left_cluster else 0
        right_mean = np.mean(right_cluster) if right_cluster else width
        # choose inner-most pair as those closest to center
        if abs(left_mean - center_x) < abs(right_mean - center_x):
            # inner left is rightmost of left_cluster, inner right is leftmost of right_cluster
            left_x = left_cluster[-1]
            right_x = right_cluster[0]
        else:
            left_x = left_cluster[-1]
            right_x = right_cluster[0]
    else:
        # fallback to take inner two distinct x positions
        left_x = xs[len(xs)//4]
        right_x = xs[-(len(xs)//4)-1]

    ys = sorted([y for y,_,_ in h_y])
    if len(ys) < 2:
        return None
    top_y = ys[len(ys)//4]
    bottom_y = ys[-(len(ys)//4)-1]

    # sanity checks
    card_w = right_x - left_x
    card_h = bottom_y - top_y
    if card_w < width * 0.15 or card_h < height * 0.15:
        return None

    aspect = card_w / float(card_h) if card_h > 0 else 0
    if aspect < 0.5 or aspect > 1.0:
        return None

    return {'x_min': int(left_x), 'x_max': int(right_x), 'y_min': int(top_y), 'y_max': int(bottom_y)}


def _detect_inner_borders(card_region):
    """Detect printed image borders within a card region"""
    height, width = card_region.shape[:2]
    
    # Convert to grayscale
    gray = cv2.cvtColor(card_region, cv2.COLOR_BGR2GRAY)
    
    # Apply bilateral filter
    filtered = cv2.bilateralFilter(gray, 9, 75, 75)
    
    # Find edges
    edges = cv2.Canny(filtered, 40, 120)
    
    # Use Hough line transform for inner borders
    lines = cv2.HoughLinesP(edges, 1, np.pi/180, 50, minLineLength=height*0.15, maxLineGap=15)
    
    if lines is None or len(lines) == 0:
        # Fall back to projection method
        return _detect_inner_borders_projection(edges, height, width)
    
    # Separate into vertical and horizontal lines
    vertical_lines = []
    horizontal_lines = []
    
    for line in lines:
        x1, y1, x2, y2 = line[0]
        
        if abs(x2 - x1) < 5:  # Vertical
            vertical_lines.append({'x': x1, 'y_min': min(y1, y2), 'y_max': max(y1, y2)})
        elif abs(y2 - y1) < 5:  # Horizontal
            horizontal_lines.append({'y': y1, 'x_min': min(x1, x2), 'x_max': max(x1, x2)})
    
    inner_left = None
    inner_right = None
    inner_top = None
    inner_bottom = None
    
    # Find the best inner vertical lines (lines inside the card, not on edges)
    if len(vertical_lines) >= 2:
        vertical_lines.sort(key=lambda l: l['x'])
        
        # Skip the leftmost and rightmost lines (those are the card edge)
        inner_verticals = [l for l in vertical_lines[1:-1] if (l['y_max'] - l['y_min']) > height * 0.3]
        
        if inner_verticals:
            # Find pair closest to left and right regions
            left_candidates = [l for l in inner_verticals if l['x'] < width * 0.3]
            right_candidates = [l for l in inner_verticals if l['x'] > width * 0.7]
            
            if left_candidates:
                inner_left = max(left_candidates, key=lambda l: l['x'])['x'] / width
            if right_candidates:
                inner_right = min(right_candidates, key=lambda l: l['x'])['x'] / width
    
    # Find the best inner horizontal lines
    if len(horizontal_lines) >= 2:
        horizontal_lines.sort(key=lambda l: l['y'])
        
        # Skip top and bottom lines
        inner_horizontals = [l for l in horizontal_lines[1:-1] if (l['x_max'] - l['x_min']) > width * 0.3]
        
        if inner_horizontals:
            # Find pair closest to top and bottom regions
            top_candidates = [l for l in inner_horizontals if l['y'] < height * 0.3]
            bottom_candidates = [l for l in inner_horizontals if l['y'] > height * 0.7]
            
            if top_candidates:
                inner_top = max(top_candidates, key=lambda l: l['y'])['y'] / height
            if bottom_candidates:
                inner_bottom = min(bottom_candidates, key=lambda l: l['y'])['y'] / height
    
    return inner_left, inner_right, inner_top, inner_bottom


def _detect_inner_borders_projection(edges, height, width):
    """Fallback inner border detection using projection"""
    horizontal_projection = np.sum(edges, axis=1)
    vertical_projection = np.sum(edges, axis=0)
    
    h_threshold = np.max(horizontal_projection) * 0.2 if np.max(horizontal_projection) > 0 else 1
    v_threshold = np.max(vertical_projection) * 0.2 if np.max(vertical_projection) > 0 else 1
    
    inner_left = _find_left_edge_fraction(vertical_projection, v_threshold, width)
    inner_right = _find_right_edge_fraction(vertical_projection, v_threshold, width)
    inner_top = _find_top_edge_fraction(horizontal_projection, h_threshold, height)
    inner_bottom = _find_bottom_edge_fraction(horizontal_projection, h_threshold, height)
    
    return inner_left, inner_right, inner_top, inner_bottom


def _create_toploader_mask(image, hex_color):
    """Create a binary mask where pixels match the provided toploader-like color.

    The function converts the image to HSV and builds a tolerance range around
    the target color so we can suppress edges coming from the toploader.
    """
    try:
        # Parse hex color RRGGBB
        hex_color = hex_color.lstrip('#')
        r = int(hex_color[0:2], 16)
        g = int(hex_color[2:4], 16)
        b = int(hex_color[4:6], 16)
    except Exception:
        return None

    # Convert a single BGR pixel to HSV to get central hue/sat/val
    bgr_pixel = np.uint8([[[b, g, r]]])
    hsv_pixel = cv2.cvtColor(bgr_pixel, cv2.COLOR_BGR2HSV)[0][0]
    h0, s0, v0 = int(hsv_pixel[0]), int(hsv_pixel[1]), int(hsv_pixel[2])

    # Tolerances around H,S,V
    h_tol = 12
    s_tol = 60
    v_tol = 60

    lower = np.array([max(0, h0 - h_tol), max(0, s0 - s_tol), max(0, v0 - v_tol)])
    upper = np.array([min(179, h0 + h_tol), min(255, s0 + s_tol), min(255, v0 + v_tol)])

    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, lower, upper)

    # Clean up mask
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_DILATE, kernel, iterations=1)

    # If mask too small, return None (no toploader detected)
    if cv2.countNonZero(mask) < (image.shape[0] * image.shape[1]) * 0.002:
        return None

    return mask


def _find_left_edge_fraction(projection, threshold, length):
    """Find left edge as fraction of length"""
    for i in range(int(length * 0.05), int(length * 0.35)):
        if projection[i] > threshold:
            if i + 1 < length and projection[i + 1] > threshold * 0.5:
                return i / length
    return None


def _find_right_edge_fraction(projection, threshold, length):
    """Find right edge as fraction of length"""
    for i in range(length - 1, int(length * 0.65), -1):
        if projection[i] > threshold:
            if i - 1 >= 0 and projection[i - 1] > threshold * 0.5:
                return i / length
    return None


def _find_top_edge_fraction(projection, threshold, length):
    """Find top edge as fraction of length"""
    for i in range(int(length * 0.05), int(length * 0.35)):
        if projection[i] > threshold:
            if i + 1 < length and projection[i + 1] > threshold * 0.5:
                return i / length
    return None


def _find_bottom_edge_fraction(projection, threshold, length):
    """Find bottom edge as fraction of length"""
    for i in range(length - 1, int(length * 0.65), -1):
        if projection[i] > threshold:
            if i - 1 >= 0 and projection[i - 1] > threshold * 0.5:
                return i / length
    return None


@app.route('/detect', methods=['POST'])
def detect():
    """Endpoint for border detection"""
    try:
        data = request.json
        image_data = data.get('image')
        
        if not image_data:
            return jsonify({'error': 'No image provided'}), 400
        
        borders = detect_borders(image_data)
        
        if borders is None:
            return jsonify({'error': 'Could not detect borders in image'}), 400
        
        return jsonify(borders)
    
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})


if __name__ == '__main__':
    print("Card Border Detection Server running on http://localhost:5000")
    app.run(debug=True, port=5000, host='127.0.0.1')
