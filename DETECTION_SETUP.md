# Border Detection Setup

This updated version uses a Python Flask backend for much better AI-powered border detection using OpenCV.

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
- Send your card images to the local Python server
- Use OpenCV with Canny edge detection to find card boundaries
- Distinguish between card edges and toploader edges
- Detect printed image borders (inner guides)
- Automatically position all guides

### 4. Manual Refinement

If the detection needs adjustment, simply drag any guide to fine-tune the position. The centering calculations update in real-time.

## How It Works

The Python backend:
1. Uses **bilateral filtering** to smooth noise while preserving sharp edges
2. Applies **Canny edge detection** to find all boundaries
3. Finds **contours** and selects the card-sized boundary (skipping toploader if present)
4. **Analyzes the card interior** to detect printed image borders
5. Returns percentages for all 8 guide positions

This is much more robust than the JavaScript Sobel method and handles:
- Different image qualities
- Cards in toploaders
- Various lighting conditions
- Different card sizes and proportions

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
