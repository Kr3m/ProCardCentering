"""
Card Border Detection Server
Uses OpenCV for intelligent card and toploader edge detection
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
    Detect card borders in an image
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
    
    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Apply bilateral filter to preserve edges while reducing noise
    filtered = cv2.bilateralFilter(gray, 9, 75, 75)
    
    # Find edges using Canny
    edges = cv2.Canny(filtered, 40, 120)
    
    # Dilate edges to connect broken segments
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    dilated = cv2.dilate(edges, kernel, iterations=2)
    
    # Find contours
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        return None
    
    # Find the two largest contours (likely toploader and card, or just card)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    
    # Get bounding rectangles for the largest contours
    rects = []
    for i, contour in enumerate(contours[:3]):  # Check top 3 contours
        x, y, w, h = cv2.boundingRect(contour)
        if w > width * 0.3 and h > height * 0.3:  # Must be significant
            rects.append({'x': x, 'y': y, 'w': w, 'h': h, 'area': w * h})
    
    if not rects:
        return None
    
    # If we have 2+ large rectangles, the larger one is likely toploader, use the smaller one (card)
    # If we have 1 rectangle, that's the card
    if len(rects) >= 2:
        rects.sort(key=lambda r: r['area'])
        card_rect = rects[0]  # Smallest of the large rectangles = card inside toploader
    else:
        card_rect = rects[0]
    
    # Outer boundaries (card edge)
    outer_left = (card_rect['x'] / width) * 100
    outer_top = (card_rect['y'] / height) * 100
    outer_right = ((card_rect['x'] + card_rect['w']) / width) * 100
    outer_bottom = ((card_rect['y'] + card_rect['h']) / height) * 100
    
    # Now find inner boundaries (printed image borders) by looking for edges within the card
    card_region = filtered[
        card_rect['y']:card_rect['y'] + card_rect['h'],
        card_rect['x']:card_rect['x'] + card_rect['w']
    ]
    
    # Find edges in the card region
    card_edges = cv2.Canny(card_region, 40, 120)
    
    # Find horizontal and vertical edge projections
    horizontal_projection = np.sum(card_edges, axis=1)
    vertical_projection = np.sum(card_edges, axis=0)
    
    # Find peaks in projections (strong edges)
    h_len = len(horizontal_projection)
    v_len = len(vertical_projection)
    
    h_threshold = np.max(horizontal_projection) * 0.15
    v_threshold = np.max(vertical_projection) * 0.15
    
    # Find inner boundaries by looking for the first significant edge after entering the card
    inner_left = _find_left_edge(vertical_projection, v_threshold)
    inner_right = _find_right_edge(vertical_projection, v_threshold, v_len)
    inner_top = _find_top_edge(horizontal_projection, h_threshold)
    inner_bottom = _find_bottom_edge(horizontal_projection, h_threshold, h_len)
    
    # Convert card-relative positions to image percentages
    if inner_left is not None:
        inner_left = ((card_rect['x'] + inner_left) / width) * 100
    if inner_right is not None:
        inner_right = ((card_rect['x'] + inner_right) / width) * 100
    if inner_top is not None:
        inner_top = ((card_rect['y'] + inner_top) / height) * 100
    if inner_bottom is not None:
        inner_bottom = ((card_rect['y'] + inner_bottom) / height) * 100
    
    # If inner boundaries not found, estimate based on typical card proportions
    if inner_left is None:
        inner_left = outer_left + (outer_right - outer_left) * 0.08
    if inner_right is None:
        inner_right = outer_right - (outer_right - outer_left) * 0.08
    if inner_top is None:
        inner_top = outer_top + (outer_bottom - outer_top) * 0.08
    if inner_bottom is None:
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


def _find_left_edge(projection, threshold):
    """Find first significant vertical edge from the left"""
    for i in range(len(projection)):
        if projection[i] > threshold:
            # Look ahead a bit to confirm it's a real edge
            if i + 1 < len(projection) and projection[i + 1] > threshold * 0.5:
                return i
    return None


def _find_right_edge(projection, threshold, length):
    """Find first significant vertical edge from the right"""
    for i in range(length - 1, -1, -1):
        if projection[i] > threshold:
            # Look back a bit to confirm it's a real edge
            if i - 1 >= 0 and projection[i - 1] > threshold * 0.5:
                return i
    return None


def _find_top_edge(projection, threshold):
    """Find first significant horizontal edge from the top"""
    for i in range(len(projection)):
        if projection[i] > threshold:
            # Look ahead a bit to confirm it's a real edge
            if i + 1 < len(projection) and projection[i + 1] > threshold * 0.5:
                return i
    return None


def _find_bottom_edge(projection, threshold, length):
    """Find first significant horizontal edge from the bottom"""
    for i in range(length - 1, -1, -1):
        if projection[i] > threshold:
            # Look back a bit to confirm it's a real edge
            if i - 1 >= 0 and projection[i - 1] > threshold * 0.5:
                return i
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
