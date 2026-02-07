"""
Card Border Detection Server
Uses YOLOv8 for intelligent object detection and segmentation
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import base64
import io
from PIL import Image
from ultralytics import YOLO

app = Flask(__name__)
CORS(app)

# Load YOLOv8 segmentation model (lightweight)
try:
    model = YOLO('yolov8n-seg.pt')  # nano segmentation model
    print("✓ YOLOv8 model loaded successfully")
except Exception as e:
    print(f"Warning: Could not load YOLOv8 model: {e}")
    print("Model will be downloaded on first use...")
    model = None

def detect_borders(image_data):
    """
    Detect card borders using YOLOv8 segmentation
    Returns: {outerLeft, outerRight, outerTop, outerBottom, innerLeft, innerRight, innerTop, innerBottom}
    as percentages of image dimensions
    """
    global model
    
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
    
    # Load model if not already loaded
    if model is None:
        model = YOLO('yolov8n-seg.pt')
    
    # Run YOLOv8 segmentation
    results = model(image, verbose=False)
    
    if not results or len(results) == 0:
        return None
    
    result = results[0]
    
    # Get masks and boxes
    if result.masks is None or len(result.masks) == 0:
        # Fall back to bounding boxes if no masks
        return _detect_borders_from_boxes(image, result.boxes, height, width)
    
    # Find the best card candidate from segmentation masks
    masks = result.masks.data.cpu().numpy()
    boxes = result.boxes.xyxy.cpu().numpy() if hasattr(result.boxes, 'xyxy') else None
    
    card_mask = _find_card_mask(masks, boxes, height, width)
    
    if card_mask is None:
        # Fall back to box detection
        return _detect_borders_from_boxes(image, result.boxes, height, width)
    
    # Get card boundaries from mask
    outer_bounds = _get_bounds_from_mask(card_mask)
    
    if outer_bounds is None:
        return None
    
    # Convert to percentages
    outer_left = (outer_bounds['x_min'] / width) * 100
    outer_right = (outer_bounds['x_max'] / width) * 100
    outer_top = (outer_bounds['y_min'] / height) * 100
    outer_bottom = (outer_bounds['y_max'] / height) * 100
    
    # Extract card region for inner border detection
    card_region = image[
        int(outer_bounds['y_min']):int(outer_bounds['y_max']),
        int(outer_bounds['x_min']):int(outer_bounds['x_max'])
    ]
    
    if card_region.size == 0:
        return None
    
    # Find inner borders within the card
    inner_left, inner_right, inner_top, inner_bottom = _detect_inner_borders(card_region)
    
    # Convert card-relative positions to image percentages
    card_width = outer_bounds['x_max'] - outer_bounds['x_min']
    card_height = outer_bounds['y_max'] - outer_bounds['y_min']
    
    if inner_left is not None:
        inner_left = ((outer_bounds['x_min'] + inner_left * card_width) / width) * 100
    else:
        inner_left = outer_left + (outer_right - outer_left) * 0.08
    
    if inner_right is not None:
        inner_right = ((outer_bounds['x_min'] + inner_right * card_width) / width) * 100
    else:
        inner_right = outer_right - (outer_right - outer_left) * 0.08
    
    if inner_top is not None:
        inner_top = ((outer_bounds['y_min'] + inner_top * card_height) / height) * 100
    else:
        inner_top = outer_top + (outer_bottom - outer_top) * 0.08
    
    if inner_bottom is not None:
        inner_bottom = ((outer_bounds['y_min'] + inner_bottom * card_height) / height) * 100
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


def _find_card_mask(masks, boxes, height, width):
    """Find the most likely card from segmentation masks"""
    if len(masks) == 0:
        return None
    
    best_mask = None
    best_score = 0
    
    for i, mask in enumerate(masks):
        # Convert mask to binary
        mask_binary = (mask > 0.5).astype(np.uint8)
        
        # Get bounding box of this mask
        coords = np.where(mask_binary > 0)
        if len(coords[0]) == 0:
            continue
        
        y_min, y_max = coords[0].min(), coords[0].max()
        x_min, x_max = coords[1].min(), coords[1].max()
        
        mask_width = x_max - x_min
        mask_height = y_max - y_min
        
        # Card aspect ratio is typically 0.65-0.75 (width/height)
        if mask_width > 0 and mask_height > 0:
            aspect_ratio = mask_width / mask_height
            
            # Score based on aspect ratio match and size
            # Cards in toploaders should be roughly rectangular
            aspect_score = 1.0 - min(abs(aspect_ratio - 0.68) / (0.68), 1.0)
            
            # Prefer larger objects (more likely to be the card than small artifacts)
            area_score = (mask_width * mask_height) / (height * width)
            
            # Total score
            score = aspect_score * 0.7 + min(area_score * 10, 1.0) * 0.3
            
            if score > best_score:
                best_score = score
                best_mask = mask_binary
    
    return best_mask


def _get_bounds_from_mask(mask):
    """Get bounding box coordinates from a mask"""
    coords = np.where(mask > 0)
    if len(coords[0]) == 0:
        return None
    
    return {
        'y_min': coords[0].min(),
        'y_max': coords[0].max(),
        'x_min': coords[1].min(),
        'x_max': coords[1].max(),
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
    
    # Get projections
    horizontal_projection = np.sum(edges, axis=1)
    vertical_projection = np.sum(edges, axis=0)
    
    h_threshold = np.max(horizontal_projection) * 0.2 if np.max(horizontal_projection) > 0 else 1
    v_threshold = np.max(vertical_projection) * 0.2 if np.max(vertical_projection) > 0 else 1
    
    # Find inner boundaries (as fractions of card region)
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


def _detect_borders_from_boxes(image, boxes, height, width):
    """Fallback method using bounding boxes instead of masks"""
    if boxes is None or len(boxes) == 0:
        return None
    
    # Find largest box (likely the card)
    largest_idx = 0
    largest_area = 0
    
    for i, box in enumerate(boxes):
        x1, y1, x2, y2 = box[:4]
        area = (x2 - x1) * (y2 - y1)
        if area > largest_area:
            largest_area = area
            largest_idx = i
    
    box = boxes[largest_idx]
    x1, y1, x2, y2 = [int(v) for v in box[:4]]
    
    # Ensure coordinates are within bounds
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(width, x2), min(height, y2)
    
    outer_left = (x1 / width) * 100
    outer_right = (x2 / width) * 100
    outer_top = (y1 / height) * 100
    outer_bottom = (y2 / height) * 100
    
    # Extract region for inner borders
    card_region = image[y1:y2, x1:x2]
    
    if card_region.size == 0:
        return None
    
    inner_left, inner_right, inner_top, inner_bottom = _detect_inner_borders(card_region)
    
    card_width = x2 - x1
    card_height = y2 - y1
    
    if inner_left is not None:
        inner_left = ((x1 + inner_left * card_width) / width) * 100
    else:
        inner_left = outer_left + (outer_right - outer_left) * 0.08
    
    if inner_right is not None:
        inner_right = ((x1 + inner_right * card_width) / width) * 100
    else:
        inner_right = outer_right - (outer_right - outer_left) * 0.08
    
    if inner_top is not None:
        inner_top = ((y1 + inner_top * card_height) / height) * 100
    else:
        inner_top = outer_top + (outer_bottom - outer_top) * 0.08
    
    if inner_bottom is not None:
        inner_bottom = ((y1 + inner_bottom * card_height) / height) * 100
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
