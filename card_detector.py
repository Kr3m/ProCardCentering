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
    """Find card boundaries using Hough line detection"""
    height, width = image.shape[:2]
    
    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Apply bilateral filter to smooth while preserving edges
    filtered = cv2.bilateralFilter(gray, 9, 75, 75)
    
    # Use Canny edge detection
    edges = cv2.Canny(filtered, 50, 150)
    
    # Dilate edges to connect broken segments
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edges = cv2.dilate(edges, kernel, iterations=1)
    
    # Use Hough line transform to find lines
    lines = cv2.HoughLinesP(edges, 1, np.pi/180, 100, minLineLength=height*0.2, maxLineGap=20)
    
    if lines is None or len(lines) == 0:
        return None
    
    # Separate lines into vertical and horizontal
    vertical_lines = []
    horizontal_lines = []
    
    for line in lines:
        x1, y1, x2, y2 = line[0]
        
        # Calculate angle
        if abs(x2 - x1) < 5:  # Nearly vertical
            vertical_lines.append({'x': x1, 'y_min': min(y1, y2), 'y_max': max(y1, y2)})
        elif abs(y2 - y1) < 5:  # Nearly horizontal
            horizontal_lines.append({'y': y1, 'x_min': min(x1, x2), 'x_max': max(x1, x2)})
    
    if len(vertical_lines) < 2 or len(horizontal_lines) < 2:
        return None
    
    # Find left and right edges (outermost vertical lines with enough coverage)
    vertical_lines.sort(key=lambda l: l['x'])
    horizontal_lines.sort(key=lambda l: l['y'])
    
    # Get candidate edges (lines that span most of the image height/width)
    min_coverage = height * 0.4
    valid_vertical = [l for l in vertical_lines if (l['y_max'] - l['y_min']) > min_coverage]
    valid_horizontal = [l for l in horizontal_lines if (l['x_max'] - l['x_min']) > width * 0.4]
    
    if len(valid_vertical) < 2 or len(valid_horizontal) < 2:
        return None
    
    # Find the outermost left and right edges
    left_x = valid_vertical[0]['x']
    right_x = valid_vertical[-1]['x']
    
    # Find the outermost top and bottom edges
    top_y = valid_horizontal[0]['y']
    bottom_y = valid_horizontal[-1]['y']
    
    # Verify this is a reasonable card size/aspect
    card_width = right_x - left_x
    card_height = bottom_y - top_y
    
    if card_width < width * 0.2 or card_height < height * 0.2:
        return None
    
    aspect_ratio = card_width / card_height
    
    # Card aspect ratio should be around 0.65-0.75
    if aspect_ratio < 0.5 or aspect_ratio > 1.0:
        return None
    
    return {
        'x_min': left_x,
        'x_max': right_x,
        'y_min': top_y,
        'y_max': bottom_y,
    }


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
