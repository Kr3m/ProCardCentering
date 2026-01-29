class CardCenteringApp {
    constructor() {
        this.frontImage = null;
        this.backImage = null;
        this.gridVisible = false;
        this.dragging = null;
        
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