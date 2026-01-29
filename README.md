# Pro Card Centering Tool

A professional web application for analyzing the centering quality of trading cards, sports cards, and collectible cards. This tool helps graders and collectors evaluate card centering with precision using draggable guides and real-time calculations.

## Features

- **Dual Image Loading**: Load both front and back images of cards
- **Interactive Grid Overlay**: Toggle a centering grid on/off for visual reference
- **Draggable Border Guides**: 
  - Inner and outer guides for all four borders (left, right, top, bottom)
  - Visual distinction between card edges (red) and image borders (blue)
- **Real-time Centering Calculations**: 
  - Left/Right centering ratios (e.g., 50/50, 60/40)
  - Top/Bottom centering ratios
  - Overall grading assessment
- **Professional Grading Scale**: 
  - Perfect (50/50)
  - Excellent (±5%)
  - Good (±10%)
  - Fair (±15%)
  - Poor (>15% deviation)
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Color-coded Results**: Visual feedback with green/orange/red color coding

## How to Use

1. **Load Images**: Click "Load Front Image" and "Load Back Image" to upload card photos
2. **Position Guides**: Drag the red guides to mark the card edges and blue guides to mark the image borders
3. **Toggle Grid**: Use "Toggle Grid" for additional visual reference
4. **Analyze Results**: View real-time centering calculations in the sidebar
5. **Reset**: Use "Reset Guides" to return guides to default positions

## Guide Types

- **Red Guides (Outer)**: Mark the physical edges of the card
- **Blue Guides (Inner)**: Mark the borders of the printed image/design

## Centering Calculation

The tool calculates centering by measuring the border widths on opposite sides:
- **Left/Right**: Compares left border width to right border width
- **Top/Bottom**: Compares top border width to bottom border width
- **Results**: Expressed as ratios (e.g., 70/30 means 70% on one side, 30% on the other)

## Technical Details

- Built with vanilla HTML, CSS, and JavaScript
- No external dependencies required
- Uses HTML5 Canvas for image rendering
- Touch-friendly for mobile devices
- Responsive grid layout

## Getting Started

Simply open `index.html` in a modern web browser. No installation or server setup required.

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge

## File Structure

```
ProCardCentering/
├── index.html          # Main application HTML
├── styles.css          # Styling and layout
├── script.js           # Application logic and interactivity
└── README.md          # This documentation
```