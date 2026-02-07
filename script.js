class CardCenteringApp {
    constructor() {
        this.frontImage = null;
        this.backImage = null;
        this.gridVisible = false;
        this.dragging = null;
        this.isDetecting = false;
        
        this.initializeEventListeners();
        this.initializeDragAndDrop();
        this.updateCenteringCalculations();
    }
    
    initializeEventListeners() {
        // Grid toggle
        document.getElementById('gridToggle').addEventListener('click', () => {
            this.toggleGrid();
        });
        
        // Reset guides
        document.getElementById('resetGuides').addEventListener('click', () => {
            this.resetGuides();
        });

        // Auto-detect borders
        document.getElementById('autoDetect').addEventListener('click', () => {
            this.autoDetectBorders();
        });
        
        // Image file inputs
        document.getElementById('frontImageInput').addEventListener('change', (e) => {
            this.loadImage(e.target.files[0], 'front');
        });
        
        document.getElementById('backImageInput').addEventListener('change', (e) => {
            this.loadImage(e.target.files[0], 'back');
        });
    }
    
    initializeDragAndDrop() {
        const guides = document.querySelectorAll('.guide');
        
        guides.forEach(guide => {
            guide.addEventListener('mousedown', (e) => {
                this.startDrag(e, guide);
            });
        });
        
        document.addEventListener('mousemove', (e) => {
            this.drag(e);
        });
        
        document.addEventListener('mouseup', () => {
            this.stopDrag();
        });
        
        // Touch events for mobile
        guides.forEach(guide => {
            guide.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.startDrag(e.touches[0], guide);
            });
        });
        
        document.addEventListener('touchmove', (e) => {
            if (this.dragging) {
                e.preventDefault();
                this.drag(e.touches[0]);
            }
        });
        
        document.addEventListener('touchend', () => {
            this.stopDrag();
        });
    }
    
    toggleGrid() {
        this.gridVisible = !this.gridVisible;
        const frontGrid = document.getElementById('frontGrid');
        const backGrid = document.getElementById('backGrid');
        
        if (this.gridVisible) {
            frontGrid.classList.add('active');
            backGrid.classList.add('active');
        } else {
            frontGrid.classList.remove('active');
            backGrid.classList.remove('active');
        }
    }
    
    resetGuides() {
        const guides = document.querySelectorAll('.guide');
        
        guides.forEach(guide => {
            const type = guide.dataset.type;
            
            // Reset to default positions
            if (type.includes('left-outer')) guide.style.left = '10%';
            if (type.includes('left-inner')) guide.style.left = '20%';
            if (type.includes('right-inner')) guide.style.right = '20%';
            if (type.includes('right-outer')) guide.style.right = '10%';
            if (type.includes('top-outer')) guide.style.top = '10%';
            if (type.includes('top-inner')) guide.style.top = '20%';
            if (type.includes('bottom-inner')) guide.style.bottom = '20%';
            if (type.includes('bottom-outer')) guide.style.bottom = '10%';
        });
        
        this.updateCenteringCalculations();
    }
    
    loadImage(file, side) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const canvas = document.getElementById(`${side}Canvas`);
            const ctx = canvas.getContext('2d');
            const container = document.getElementById(`${side}Container`);
            const placeholder = container.querySelector('.placeholder');
            
            const img = new Image();
            img.onload = () => {
                // Set canvas size to container size
                const containerRect = container.getBoundingClientRect();
                canvas.width = containerRect.width;
                canvas.height = containerRect.height;
                
                // Calculate aspect ratio and positioning
                const imgAspect = img.width / img.height;
                const canvasAspect = canvas.width / canvas.height;
                
                let drawWidth, drawHeight, drawX, drawY;
                
                if (imgAspect > canvasAspect) {
                    // Image is wider - fit to width
                    drawWidth = canvas.width;
                    drawHeight = canvas.width / imgAspect;
                    drawX = 0;
                    drawY = (canvas.height - drawHeight) / 2;
                } else {
                    // Image is taller - fit to height
                    drawHeight = canvas.height;
                    drawWidth = canvas.height * imgAspect;
                    drawX = (canvas.width - drawWidth) / 2;
                    drawY = 0;
                }
                
                // Clear canvas and draw image
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
                
                // Hide placeholder
                placeholder.style.display = 'none';
                canvas.style.display = 'block';
                
                // Store image data
                if (side === 'front') {
                    this.frontImage = { img, drawX, drawY, drawWidth, drawHeight };
                } else {
                    this.backImage = { img, drawX, drawY, drawWidth, drawHeight };
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    startDrag(e, guide) {
        this.dragging = guide;
        guide.classList.add('dragging');
        
        const rect = guide.parentElement.getBoundingClientRect();
        this.dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    drag(e) {
        if (!this.dragging) return;
        
        const container = this.dragging.parentElement;
        const rect = container.getBoundingClientRect();
        const type = this.dragging.dataset.type;
        
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const xPercent = (x / rect.width) * 100;
        const yPercent = (y / rect.height) * 100;
        
        // Constrain to container bounds
        const constrainedX = Math.max(0, Math.min(100, xPercent));
        const constrainedY = Math.max(0, Math.min(100, yPercent));
        
        if (type.includes('left')) {
            this.dragging.style.left = `${constrainedX}%`;
        } else if (type.includes('right')) {
            this.dragging.style.right = `${100 - constrainedX}%`;
        }
        
        if (type.includes('top')) {
            this.dragging.style.top = `${constrainedY}%`;
        } else if (type.includes('bottom')) {
            this.dragging.style.bottom = `${100 - constrainedY}%`;
        }
        
        this.updateCenteringCalculations();
    }
    
    stopDrag() {
        if (this.dragging) {
            this.dragging.classList.remove('dragging');
            this.dragging = null;
        }
    }
    
    updateCenteringCalculations() {
        this.calculateCentering('front');
        this.calculateCentering('back');
    }
    
    calculateCentering(side) {
        const container = document.getElementById(`${side}Container`);
        const guides = container.querySelectorAll('.guide');
        
        let leftOuter = 10, leftInner = 20, rightInner = 80, rightOuter = 90;
        let topOuter = 10, topInner = 20, bottomInner = 80, bottomOuter = 90;
        
        guides.forEach(guide => {
            const type = guide.dataset.type;
            const rect = container.getBoundingClientRect();
            const guideRect = guide.getBoundingClientRect();
            
            if (type.includes('left-outer')) {
                leftOuter = ((guideRect.left - rect.left) / rect.width) * 100;
            } else if (type.includes('left-inner')) {
                leftInner = ((guideRect.left - rect.left) / rect.width) * 100;
            } else if (type.includes('right-inner')) {
                rightInner = ((guideRect.left - rect.left) / rect.width) * 100;
            } else if (type.includes('right-outer')) {
                rightOuter = ((guideRect.left - rect.left) / rect.width) * 100;
            } else if (type.includes('top-outer')) {
                topOuter = ((guideRect.top - rect.top) / rect.height) * 100;
            } else if (type.includes('top-inner')) {
                topInner = ((guideRect.top - rect.top) / rect.height) * 100;
            } else if (type.includes('bottom-inner')) {
                bottomInner = ((guideRect.top - rect.top) / rect.height) * 100;
            } else if (type.includes('bottom-outer')) {
                bottomOuter = ((guideRect.top - rect.top) / rect.height) * 100;
            }
        });
        
        // Calculate border widths
        const leftBorder = leftInner - leftOuter;
        const rightBorder = rightOuter - rightInner;
        const topBorder = topInner - topOuter;
        const bottomBorder = bottomOuter - bottomInner;
        
        // Calculate centering ratios
        const lrTotal = leftBorder + rightBorder;
        const tbTotal = topBorder + bottomBorder;
        
        let leftPercent = 50, rightPercent = 50;
        let topPercent = 50, bottomPercent = 50;
        
        if (lrTotal > 0) {
            leftPercent = Math.round((leftBorder / lrTotal) * 100);
            rightPercent = 100 - leftPercent;
        }
        
        if (tbTotal > 0) {
            topPercent = Math.round((topBorder / tbTotal) * 100);
            bottomPercent = 100 - topPercent;
        }
        
        // Update display
        const lrElement = document.getElementById(`${side}LR`);
        const tbElement = document.getElementById(`${side}TB`);
        const gradeElement = document.getElementById(`${side}Grade`);
        
        lrElement.textContent = `${leftPercent}/${rightPercent}`;
        tbElement.textContent = `${topPercent}/${bottomPercent}`;
        
        // Calculate overall grade
        const maxDeviation = Math.max(
            Math.abs(leftPercent - 50),
            Math.abs(topPercent - 50)
        );
        
        let grade = 'Perfect';
        let gradeClass = '';
        
        if (maxDeviation <= 5) {
            grade = 'Excellent';
            gradeClass = '';
        } else if (maxDeviation <= 10) {
            grade = 'Good';
            gradeClass = 'good';
        } else if (maxDeviation <= 15) {
            grade = 'Fair';
            gradeClass = 'good';
        } else {
            grade = 'Poor';
            gradeClass = 'poor';
        }
        
        gradeElement.textContent = grade;
        gradeElement.className = `grade ${gradeClass}`;
        
        // Color-code the centering values
        this.colorCodeCentering(lrElement, Math.abs(leftPercent - 50));
        this.colorCodeCentering(tbElement, Math.abs(topPercent - 50));
    }
    
    colorCodeCentering(element, deviation) {
        element.style.color = '#27ae60'; // Green for good
        
        if (deviation > 5) {
            element.style.color = '#f39c12'; // Orange for fair
        }
        if (deviation > 15) {
            element.style.color = '#e74c3c'; // Red for poor
        }
    }

    // AI-powered border detection using edge detection
    async autoDetectBorders() {
        const btn = document.getElementById('autoDetect');
        if (this.isDetecting) return;
        
        this.isDetecting = true;
        btn.disabled = true;
        btn.textContent = '🔄 Detecting...';

        try {
            if (this.frontImage) {
                const frontBorders = await this.detectBordersForImage('front');
                if (frontBorders) {
                    this.applyDetectedBorders('front', frontBorders);
                }
            }
            
            if (this.backImage) {
                const backBorders = await this.detectBordersForImage('back');
                if (backBorders) {
                    this.applyDetectedBorders('back', backBorders);
                }
            }

            this.updateCenteringCalculations();
        } catch (error) {
            console.error('Border detection error:', error);
            alert('Error detecting borders. Please try again or adjust manually.');
        } finally {
            this.isDetecting = false;
            btn.disabled = false;
            btn.textContent = '🤖 Auto-detect Borders';
        }
    }

    async detectBordersForImage(side) {
        return new Promise((resolve) => {
            const canvas = document.getElementById(`${side}Canvas`);
            const container = document.getElementById(`${side}Container`);
            
            if (!canvas || canvas.style.display === 'none') {
                resolve(null);
                return;
            }

            // Create an off-screen canvas for processing
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
            
            // Copy the canvas content
            ctx.drawImage(canvas, 0, 0);
            
            // Use setTimeout to ensure this runs after canvas is ready
            setTimeout(() => {
                try {
                    const borders = this.findBorders(tempCanvas, ctx);
                    resolve(borders);
                } catch (e) {
                    console.error('Error finding borders:', e);
                    resolve(null);
                }
            }, 0);
        });
    }

    findBorders(canvas, ctx) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Apply edge detection (Sobel operator)
        const edges = this.applySobelEdgeDetection(canvas.width, canvas.height, data);
        
        // Find the card boundaries
        const bounds = this.findCardBoundaries(edges, canvas.width, canvas.height);
        
        if (!bounds) return null;
        
        // Convert pixel positions to percentages
        return {
            outerLeft: (bounds.outerLeft / canvas.width) * 100,
            outerRight: (bounds.outerRight / canvas.width) * 100,
            outerTop: (bounds.outerTop / canvas.height) * 100,
            outerBottom: (bounds.outerBottom / canvas.height) * 100,
            innerLeft: bounds.innerLeft !== undefined ? (bounds.innerLeft / canvas.width) * 100 : undefined,
            innerRight: bounds.innerRight !== undefined ? (bounds.innerRight / canvas.width) * 100 : undefined,
            innerTop: bounds.innerTop !== undefined ? (bounds.innerTop / canvas.height) * 100 : undefined,
            innerBottom: bounds.innerBottom !== undefined ? (bounds.innerBottom / canvas.height) * 100 : undefined,
        };
    }

    applySobelEdgeDetection(width, height, imageData) {
        // Convert to grayscale and apply Sobel edge detection
        const grayscale = new Uint8Array(width * height);
        for (let i = 0; i < imageData.length; i += 4) {
            grayscale[i / 4] = (imageData[i] * 0.299 + imageData[i + 1] * 0.587 + imageData[i + 2] * 0.114);
        }
        
        const edges = new Uint8Array(width * height);
        const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
        const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let gx = 0, gy = 0;
                
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const pixel = grayscale[(y + ky) * width + (x + kx)];
                        gx += pixel * sobelX[ky + 1][kx + 1];
                        gy += pixel * sobelY[ky + 1][kx + 1];
                    }
                }
                
                edges[y * width + x] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
            }
        }
        
        return edges;
    }

    findCardBoundaries(edges, width, height) {
        // Find edges with high gradient magnitude
        const threshold = 50;
        const edgeMap = new Uint8Array(width * height);
        for (let i = 0; i < edges.length; i++) {
            edgeMap[i] = edges[i] > threshold ? 255 : 0;
        }
        
        // Find outer boundaries by scanning from edges
        const outerLeft = this.findLeftBoundary(edgeMap, width, height);
        const outerRight = this.findRightBoundary(edgeMap, width, height);
        const outerTop = this.findTopBoundary(edgeMap, width, height);
        const outerBottom = this.findBottomBoundary(edgeMap, width, height);
        
        if (outerLeft === null || outerRight === null || outerTop === null || outerBottom === null) {
            return null;
        }
        
        // Find inner boundaries (image borders) by analyzing the region inside the card
        const cardWidth = outerRight - outerLeft;
        const cardHeight = outerBottom - outerTop;
        const innerMargin = Math.min(cardWidth, cardHeight) * 0.15; // Look 15% inward
        
        let innerLeft = outerLeft + innerMargin;
        let innerRight = outerRight - innerMargin;
        let innerTop = outerTop + innerMargin;
        let innerBottom = outerBottom - innerMargin;
        
        // Refine inner boundaries by finding edges within the card
        const innerLeftRefined = this.findInnerLeftBoundary(edgeMap, width, height, outerLeft, outerRight, outerTop, outerBottom);
        const innerRightRefined = this.findInnerRightBoundary(edgeMap, width, height, outerLeft, outerRight, outerTop, outerBottom);
        const innerTopRefined = this.findInnerTopBoundary(edgeMap, width, height, outerLeft, outerRight, outerTop, outerBottom);
        const innerBottomRefined = this.findInnerBottomBoundary(edgeMap, width, height, outerLeft, outerRight, outerTop, outerBottom);
        
        if (innerLeftRefined !== null) innerLeft = innerLeftRefined;
        if (innerRightRefined !== null) innerRight = innerRightRefined;
        if (innerTopRefined !== null) innerTop = innerTopRefined;
        if (innerBottomRefined !== null) innerBottom = innerBottomRefined;
        
        return {
            outerLeft,
            outerRight,
            outerTop,
            outerBottom,
            innerLeft,
            innerRight,
            innerTop,
            innerBottom,
        };
    }

    findLeftBoundary(edgeMap, width, height) {
        for (let x = 0; x < width; x++) {
            let edgeCount = 0;
            for (let y = 0; y < height; y++) {
                if (edgeMap[y * width + x] > 0) edgeCount++;
            }
            if (edgeCount > height * 0.3) return x;
        }
        return null;
    }

    findRightBoundary(edgeMap, width, height) {
        for (let x = width - 1; x >= 0; x--) {
            let edgeCount = 0;
            for (let y = 0; y < height; y++) {
                if (edgeMap[y * width + x] > 0) edgeCount++;
            }
            if (edgeCount > height * 0.3) return x;
        }
        return null;
    }

    findTopBoundary(edgeMap, width, height) {
        for (let y = 0; y < height; y++) {
            let edgeCount = 0;
            for (let x = 0; x < width; x++) {
                if (edgeMap[y * width + x] > 0) edgeCount++;
            }
            if (edgeCount > width * 0.3) return y;
        }
        return null;
    }

    findBottomBoundary(edgeMap, width, height) {
        for (let y = height - 1; y >= 0; y--) {
            let edgeCount = 0;
            for (let x = 0; x < width; x++) {
                if (edgeMap[y * width + x] > 0) edgeCount++;
            }
            if (edgeCount > width * 0.3) return y;
        }
        return null;
    }

    findInnerLeftBoundary(edgeMap, width, height, outerL, outerR, outerT, outerB) {
        const searchStart = outerL + (outerR - outerL) * 0.1;
        const searchEnd = outerL + (outerR - outerL) * 0.35;
        
        for (let x = searchStart; x < searchEnd; x++) {
            let edgeCount = 0;
            const startY = Math.max(0, outerT + (outerB - outerT) * 0.2);
            const endY = Math.min(height, outerB - (outerB - outerT) * 0.2);
            
            for (let y = startY; y < endY; y++) {
                if (edgeMap[Math.floor(y) * width + Math.floor(x)] > 0) edgeCount++;
            }
            if (edgeCount > (endY - startY) * 0.4) return x;
        }
        return null;
    }

    findInnerRightBoundary(edgeMap, width, height, outerL, outerR, outerT, outerB) {
        const searchStart = outerR - (outerR - outerL) * 0.35;
        const searchEnd = outerR - (outerR - outerL) * 0.1;
        
        for (let x = searchEnd; x >= searchStart; x--) {
            let edgeCount = 0;
            const startY = Math.max(0, outerT + (outerB - outerT) * 0.2);
            const endY = Math.min(height, outerB - (outerB - outerT) * 0.2);
            
            for (let y = startY; y < endY; y++) {
                if (edgeMap[Math.floor(y) * width + Math.floor(x)] > 0) edgeCount++;
            }
            if (edgeCount > (endY - startY) * 0.4) return x;
        }
        return null;
    }

    findInnerTopBoundary(edgeMap, width, height, outerL, outerR, outerT, outerB) {
        const searchStart = outerT + (outerB - outerT) * 0.1;
        const searchEnd = outerT + (outerB - outerT) * 0.35;
        
        for (let y = searchStart; y < searchEnd; y++) {
            let edgeCount = 0;
            const startX = Math.max(0, outerL + (outerR - outerL) * 0.2);
            const endX = Math.min(width, outerR - (outerR - outerL) * 0.2);
            
            for (let x = startX; x < endX; x++) {
                if (edgeMap[Math.floor(y) * width + Math.floor(x)] > 0) edgeCount++;
            }
            if (edgeCount > (endX - startX) * 0.4) return y;
        }
        return null;
    }

    findInnerBottomBoundary(edgeMap, width, height, outerL, outerR, outerT, outerB) {
        const searchStart = outerB - (outerB - outerT) * 0.35;
        const searchEnd = outerB - (outerB - outerT) * 0.1;
        
        for (let y = searchEnd; y >= searchStart; y--) {
            let edgeCount = 0;
            const startX = Math.max(0, outerL + (outerR - outerL) * 0.2);
            const endX = Math.min(width, outerR - (outerR - outerL) * 0.2);
            
            for (let x = startX; x < endX; x++) {
                if (edgeMap[Math.floor(y) * width + Math.floor(x)] > 0) edgeCount++;
            }
            if (edgeCount > (endX - startX) * 0.4) return y;
        }
        return null;
    }

    applyDetectedBorders(side, borders) {
        const container = document.getElementById(`${side}Container`);
        const guides = container.querySelectorAll('.guide');
        
        guides.forEach(guide => {
            const type = guide.dataset.type;
            
            if (type === 'left-outer' && borders.outerLeft !== undefined) {
                guide.style.left = `${borders.outerLeft}%`;
            } else if (type === 'right-outer' && borders.outerRight !== undefined) {
                guide.style.right = `${100 - borders.outerRight}%`;
            } else if (type === 'top-outer' && borders.outerTop !== undefined) {
                guide.style.top = `${borders.outerTop}%`;
            } else if (type === 'bottom-outer' && borders.outerBottom !== undefined) {
                guide.style.bottom = `${100 - borders.outerBottom}%`;
            } else if (type === 'left-inner' && borders.innerLeft !== undefined) {
                guide.style.left = `${borders.innerLeft}%`;
            } else if (type === 'right-inner' && borders.innerRight !== undefined) {
                guide.style.right = `${100 - borders.innerRight}%`;
            } else if (type === 'top-inner' && borders.innerTop !== undefined) {
                guide.style.top = `${borders.innerTop}%`;
            } else if (type === 'bottom-inner' && borders.innerBottom !== undefined) {
                guide.style.bottom = `${100 - borders.innerBottom}%`;
            }
        });
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new CardCenteringApp();
});

// Handle window resize to update canvas sizes
window.addEventListener('resize', () => {
    // Redraw images if they exist
    const app = window.cardCenteringApp;
    if (app && app.frontImage) {
        // Trigger image reload to adjust canvas size
        const frontCanvas = document.getElementById('frontCanvas');
        const frontContainer = document.getElementById('frontContainer');
        // ... resize logic can be added here if needed
    }
});