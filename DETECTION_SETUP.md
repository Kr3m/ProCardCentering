# Border Detection Setup

This version uses **Hough line detection** for accurate card and toploader edge detection.

## Setup Instructions

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

Or if you're using Python 3:
```bash
pip3 install -r requirements.txt
```

### 2. Start the Detection Server

In a terminal, run:

```bash
python3 card_detector.py
```

You should see:
```
Card Border Detection Server running on http://localhost:5000
```

Leave this terminal running while you use the web app.

### 3. Use the Web App

Open `index.html` in your browser (or use a local web server).

Click **"🤖 Auto-detect Borders"** and the app will:
- Use OpenCV's Hough line detection to find card edges
- Find straight edges that form a proper card rectangle
- Distinguish card edges from toploader edges through line analysis
- Detect printed image borders (inner guides)
- Automatically position all guides

### 4. Manual Refinement

If the detection needs adjustment, simply drag any guide to fine-tune the position. The centering calculations update in real-time.

## How It Works

The Python backend:
1. Uses **Canny edge detection** to find all edges in the image
2. Applies **Hough line transform** to identify straight lines
3. **Groups lines** into vertical and horizontal sets
4. **Finds the outermost lines** that form a rectangle with proper card aspect ratio (0.65-0.75)
5. **Validates** that detected boundaries make sense (appropriate proportions)
6. **Analyzes the card interior** to detect printed image borders
7. Returns percentages for all 8 guide positions

This approach:
- Correctly identifies card edges separate from toploader edges
- Handles various lighting conditions
- Works with different image qualities
- Is not fooled by what's printed on the card

## Troubleshooting

**"Python server not running" error:**
- Make sure you've started the Flask server with `python3 card_detector.py`
- Make sure the terminal is still open in the background

**Server won't start:**
- Run `pip3 install -r requirements.txt` again
- Make sure you have Python 3.8+ installed

**Detection is off:**
- Try adjusting the guides manually - they're still fully draggable
- Ensure good lighting on your card photo
- Try cropping the image to show just the card and toploader
- Make sure the card's straight edges are clearly visible
