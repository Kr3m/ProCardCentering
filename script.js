class CardCenteringApp {
    constructor() {
        this.frontImage = null;
        this.backImage = null;
        this.gridVisible = false;
        this.dragging = null;
        this.isDetecting = false;
        this.modalActiveSide = null;
        
        this.initializeEventListeners();
        this.initializeDragAndDrop();
        this.initializeModalListeners();
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

    // Helper: get image rectangle (local to container) for a given side ('front'|'back')
    getImageRectLocal(side) {
        const container = document.getElementById(`${side}Container`);
        const containerRect = container.getBoundingClientRect();
        const imageData = side === 'front' ? this.frontImage : this.backImage;
        if (!imageData) return null;

        // drawX/drawY are local to the container (canvas positioned at 0,0 inside container)
        return {
            left: imageData.drawX,
            top: imageData.drawY,
            width: imageData.drawWidth,
            height: imageData.drawHeight,
            containerWidth: containerRect.width,
            containerHeight: containerRect.height
        };
    }
    
    initializeModalListeners() {
        const frontZoom = document.getElementById('frontZoom');
        const backZoom = document.getElementById('backZoom');
        
        // Attach click listeners to zoom buttons
        if (frontZoom) {
            frontZoom.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.frontImage) {
                    this.openCardModal('front');
                }
            });
        }
        
        if (backZoom) {
            backZoom.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.backImage) {
                    this.openCardModal('back');
                }
            });
        }
        
        const modalOverlay = document.getElementById('modalOverlay');
        const modalClose = document.getElementById('modalClose');
        const modalSave = document.getElementById('modalSave');
        const modalCancel = document.getElementById('modalCancel');
        
        // Close modal handlers
        if (modalClose) modalClose.addEventListener('click', () => this.closeCardModal(false));
        if (modalOverlay) modalOverlay.addEventListener('click', () => this.closeCardModal(false));
        if (modalCancel) modalCancel.addEventListener('click', () => this.closeCardModal(false));
        if (modalSave) modalSave.addEventListener('click', () => this.closeCardModal(true));
        
        // Prevent overlay click from closing when clicking on modal content
        const modalContent = document.querySelector('.modal-content');
        if (modalContent) {
            modalContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    }
    
    openCardModal(side) {
        this.modalActiveSide = side;
        const modal = document.getElementById('cardModal');
        const enlargedCanvas = document.getElementById('enlargedCanvas');
        const enlargedContainer = document.getElementById('enlargedContainer');
        const modalTitle = document.getElementById('modalTitle');
        
        // Set title
        modalTitle.textContent = `${side.charAt(0).toUpperCase() + side.slice(1)} Card`;
        
        // Get the current image
        const imageData = side === 'front' ? this.frontImage : this.backImage;
        if (!imageData) return;
        
        // Show modal first so we can get container dimensions
        modal.classList.add('active');
        
        // Use requestAnimationFrame to ensure DOM is updated
        requestAnimationFrame(() => {
            const containerWidth = enlargedContainer.clientWidth;
            const containerHeight = enlargedContainer.clientHeight;
            
            // Use 95% of container space to leave room for padding
            const maxWidth = containerWidth * 0.95;
            const maxHeight = containerHeight * 0.95;
            
            const imgAspect = imageData.img.width / imageData.img.height;
            let drawWidth, drawHeight;
            
            if (imgAspect > maxWidth / maxHeight) {
                drawWidth = maxWidth;
                drawHeight = maxWidth / imgAspect;
            } else {
                drawHeight = maxHeight;
                drawWidth = maxHeight * imgAspect;
            }
            
            enlargedCanvas.width = drawWidth;
            enlargedCanvas.height = drawHeight;
            
            const ctx = enlargedCanvas.getContext('2d');
            ctx.drawImage(imageData.img, 0, 0, drawWidth, drawHeight);
            
            // Position guides based on canvas position
            const canvasLeft = (containerWidth - drawWidth) / 2;
            const canvasTop = (containerHeight - drawHeight) / 2;
            
            // Copy guide positions from main view to modal
            const mainContainer = document.getElementById(`${side}Container`);
            const modalGuides = enlargedContainer.querySelectorAll('.guide');
            const mainGuides = mainContainer.querySelectorAll('.guide');
            
            // Determine main image rect (local to main container)
            const mainImageRect = this.getImageRectLocal(side);

            mainGuides.forEach(mainGuide => {
                const type = mainGuide.dataset.type;
                const modalGuide = enlargedContainer.querySelector(`.guide[data-type="${type}"]`);
                if (!modalGuide) return;

                // compute image-relative percentage from main guide (which is rendered as container percent)
                const mainContainerRect = mainContainer.getBoundingClientRect();

                // horizontal
                if (mainGuide.style.left && mainGuide.style.left.includes('%') && mainImageRect) {
                    const containerPercent = parseFloat(mainGuide.style.left);
                    const pixelInContainer = (containerPercent / 100) * mainImageRect.containerWidth;
                    const imagePercent = ((pixelInContainer - mainImageRect.left) / mainImageRect.width) * 100;
                    modalGuide.dataset.pos = Math.max(0, Math.min(100, imagePercent));
                    // render modal pixel position
                    const modalPixel = canvasLeft + (modalGuide.dataset.pos / 100) * drawWidth;
                    modalGuide.style.left = `${modalPixel}px`;
                    modalGuide.style.right = '';
                } else if (mainGuide.style.right && mainGuide.style.right.includes('%') && mainImageRect) {
                    const containerPercent = parseFloat(mainGuide.style.right);
                    // compute pixel from right
                    const pixelFromLeft = mainImageRect.containerWidth - (containerPercent / 100) * mainImageRect.containerWidth;
                    const imagePercent = ((pixelFromLeft - mainImageRect.left) / mainImageRect.width) * 100;
                    modalGuide.dataset.pos = Math.max(0, Math.min(100, imagePercent));
                    const modalPixelRight = canvasLeft + (modalGuide.dataset.pos / 100) * drawWidth;
                    modalGuide.style.right = `${containerWidth - modalPixelRight}px`;
                    modalGuide.style.left = '';
                }

                // vertical
                if (mainGuide.style.top && mainGuide.style.top.includes('%') && mainImageRect) {
                    const containerPercentV = parseFloat(mainGuide.style.top);
                    const pixelInContainerV = (containerPercentV / 100) * mainImageRect.containerHeight;
                    const imagePercentV = ((pixelInContainerV - mainImageRect.top) / mainImageRect.height) * 100;
                    modalGuide.dataset.posV = Math.max(0, Math.min(100, imagePercentV));
                    const modalPixelV = canvasTop + (modalGuide.dataset.posV / 100) * drawHeight;
                    modalGuide.style.top = `${modalPixelV}px`;
                    modalGuide.style.bottom = '';
                } else if (mainGuide.style.bottom && mainGuide.style.bottom.includes('%') && mainImageRect) {
                    const containerPercentV = parseFloat(mainGuide.style.bottom);
                    const pixelFromTopV = mainImageRect.containerHeight - (containerPercentV / 100) * mainImageRect.containerHeight;
                    const imagePercentV = ((pixelFromTopV - mainImageRect.top) / mainImageRect.height) * 100;
                    modalGuide.dataset.posV = Math.max(0, Math.min(100, imagePercentV));
                    const modalPixelBV = canvasTop + (modalGuide.dataset.posV / 100) * drawHeight;
                    modalGuide.style.bottom = `${containerHeight - modalPixelBV}px`;
                    modalGuide.style.top = '';
                }
            });
            
            // Setup drag handlers for modal guides
            this.setupModalGuideDragging(drawWidth, drawHeight, canvasLeft, canvasTop);
        });
    }
    
    closeCardModal(saveChanges) {
        const modal = document.getElementById('cardModal');
        modal.classList.remove('active');
        
        if (saveChanges && this.modalActiveSide) {
            const enlargedContainer = document.getElementById('enlargedContainer');
            const enlargedCanvas = document.getElementById('enlargedCanvas');
            const mainContainer = document.getElementById(`${this.modalActiveSide}Container`);
            
            // We'll compute image-relative percentages from modal guides (prefer dataset values)
            const modalGuides = enlargedContainer.querySelectorAll('.guide');
            const mainGuides = mainContainer.querySelectorAll('.guide');

            // Modal canvas geometry (centered in enlargedContainer)
            const canvasWidth = enlargedCanvas ? enlargedCanvas.width : 0;
            const canvasHeight = enlargedCanvas ? enlargedCanvas.height : 0;
            const containerW = enlargedContainer.clientWidth;
            const containerH = enlargedContainer.clientHeight;
            const canvasLeft = (containerW - canvasWidth) / 2;
            const canvasTop = (containerH - canvasHeight) / 2;

            modalGuides.forEach(modalGuide => {
                const type = modalGuide.dataset.type;
                const mainGuide = mainContainer.querySelector(`.guide[data-type="${type}"]`);
                if (!mainGuide) return;

                // Prefer stored image-relative percent; else derive from pixel styles
                let pos = modalGuide.dataset.pos !== undefined ? parseFloat(modalGuide.dataset.pos) : NaN;
                let posV = modalGuide.dataset.posV !== undefined ? parseFloat(modalGuide.dataset.posV) : NaN;

                // Horizontal fallback from style px
                if (isNaN(pos)) {
                    if (modalGuide.style.left && modalGuide.style.left.includes('px')) {
                        const px = parseFloat(modalGuide.style.left);
                        pos = ((px - canvasLeft) / canvasWidth) * 100;
                    } else if (modalGuide.style.right && modalGuide.style.right.includes('px')) {
                        const rightPx = parseFloat(modalGuide.style.right);
                        const px = containerW - rightPx;
                        pos = ((px - canvasLeft) / canvasWidth) * 100;
                    }
                }

                // Vertical fallback from style px
                if (isNaN(posV)) {
                    if (modalGuide.style.top && modalGuide.style.top.includes('px')) {
                        const py = parseFloat(modalGuide.style.top);
                        posV = ((py - canvasTop) / canvasHeight) * 100;
                    } else if (modalGuide.style.bottom && modalGuide.style.bottom.includes('px')) {
                        const bottomPx = parseFloat(modalGuide.style.bottom);
                        const py = containerH - bottomPx;
                        posV = ((py - canvasTop) / canvasHeight) * 100;
                    }
                }

                // Clamp
                pos = Math.max(0, Math.min(100, isNaN(pos) ? 0 : pos));
                posV = Math.max(0, Math.min(100, isNaN(posV) ? 0 : posV));

                // Compute pixel position inside main container image area
                const mainImageRect = this.getImageRectLocal(this.modalActiveSide);
                const mainRect = mainContainer.getBoundingClientRect();
                if (mainImageRect) {
                    const pixelInMainX = mainImageRect.left + (pos / 100) * mainImageRect.width;
                    const pixelInMainY = mainImageRect.top + (posV / 100) * mainImageRect.height;

                    // convert to container percent
                    const containerPercentX = (pixelInMainX / mainRect.width) * 100;
                    const containerPercentY = (pixelInMainY / mainRect.height) * 100;

                    if (type.includes('left')) {
                        mainGuide.style.left = `${containerPercentX}%`;
                        mainGuide.style.right = '';
                    } else if (type.includes('right')) {
                        const rightPercent = ((mainRect.width - pixelInMainX) / mainRect.width) * 100;
                        mainGuide.style.right = `${rightPercent}%`;
                        mainGuide.style.left = '';
                    }

                    if (type.includes('top')) {
                        mainGuide.style.top = `${containerPercentY}%`;
                        mainGuide.style.bottom = '';
                    } else if (type.includes('bottom')) {
                        const bottomPercent = ((mainRect.height - pixelInMainY) / mainRect.height) * 100;
                        mainGuide.style.bottom = `${bottomPercent}%`;
                        mainGuide.style.top = '';
                    }

                    // Update dataset on main guide to maintain canonical image-relative percent
                    mainGuide.dataset.pos = pos;
                    mainGuide.dataset.posV = posV;
                }
            });
            
            this.updateCenteringCalculations();
        }
        
        this.modalActiveSide = null;
        this.dragCanvasData = null;
    }
    
    setupModalGuideDragging(canvasWidth, canvasHeight, canvasLeft, canvasTop) {
        const enlargedContainer = document.getElementById('enlargedContainer');
        const guides = enlargedContainer.querySelectorAll('.guide');
        
        guides.forEach(guide => {
            // Remove old listeners
            guide.onmousedown = null;
            guide.addEventListener('mousedown', (e) => {
                this.startModalDrag(e, guide, canvasWidth, canvasHeight, canvasLeft, canvasTop);
            });
        });
    }
    
    startModalDrag(e, guide, canvasWidth, canvasHeight, canvasLeft, canvasTop) {
        this.dragging = guide;
        guide.classList.add('dragging');
        this.dragCanvasData = { canvasWidth, canvasHeight, canvasLeft, canvasTop };
        
        e.preventDefault();
        
        const handleModalDrag = (event) => this.dragModal(event);
        const handleModalStop = () => {
            document.removeEventListener('mousemove', handleModalDrag);
            document.removeEventListener('mouseup', handleModalStop);
            this.stopDrag();
        };
        
        document.addEventListener('mousemove', handleModalDrag);
        document.addEventListener('mouseup', handleModalStop);
    }
    
    dragModal(e) {
        if (!this.dragging || !this.dragCanvasData) return;
        const container = document.getElementById('enlargedContainer');
        const rect = container.getBoundingClientRect();
        const type = this.dragging.dataset.type;
        
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const { canvasWidth, canvasHeight, canvasLeft, canvasTop } = this.dragCanvasData;

        // Compute percent relative to the image area inside modal
        const relX = ((x - canvasLeft) / canvasWidth) * 100;
        const relY = ((y - canvasTop) / canvasHeight) * 100;
        const constrainedX = Math.max(0, Math.min(100, relX));
        const constrainedY = Math.max(0, Math.min(100, relY));

        // store image-relative percent
        if (type.includes('left') || type.includes('right')) {
            this.dragging.dataset.pos = constrainedX;
        }
        if (type.includes('top') || type.includes('bottom')) {
            this.dragging.dataset.posV = constrainedY;
        }

        // Render guides as pixels positioned over the modal image
        if (type.includes('left')) {
            const px = canvasLeft + (constrainedX / 100) * canvasWidth;
            this.dragging.style.left = `${px}px`;
            this.dragging.style.right = '';
        } else if (type.includes('right')) {
            const px = canvasLeft + (constrainedX / 100) * canvasWidth;
            const rightPx = rect.width - px;
            this.dragging.style.right = `${rightPx}px`;
            this.dragging.style.left = '';
        }

        if (type.includes('top')) {
            const py = canvasTop + (constrainedY / 100) * canvasHeight;
            this.dragging.style.top = `${py}px`;
            this.dragging.style.bottom = '';
        } else if (type.includes('bottom')) {
            const py = canvasTop + (constrainedY / 100) * canvasHeight;
            const bottomPx = rect.height - py;
            this.dragging.style.bottom = `${bottomPx}px`;
            this.dragging.style.top = '';
        }
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
        const side = this.dragging.dataset.side; // front|back

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Get image-local rect for this side
        const imageRect = this.getImageRectLocal(side);

        // If imageRect available, compute percent relative to image area
        if (imageRect) {
            const imgLeft = imageRect.left;
            const imgTop = imageRect.top;
            const imgW = imageRect.width;
            const imgH = imageRect.height;

            // compute percent relative to image
            const relX = (x - imgLeft) / imgW * 100;
            const relY = (y - imgTop) / imgH * 100;
            const constrainedX = Math.max(0, Math.min(100, relX));
            const constrainedY = Math.max(0, Math.min(100, relY));

            // store image-relative percent in dataset
            if (type.includes('left') || type.includes('right')) {
                this.dragging.dataset.pos = constrainedX;
            }
            if (type.includes('top') || type.includes('bottom')) {
                this.dragging.dataset.posV = constrainedY;
            }

            // Render visual position as percentage of container (so existing CSS percent rules still work)
            const pixelX = imgLeft + (constrainedX / 100) * imgW;
            const containerPercentX = (pixelX / rect.width) * 100;
            if (type.includes('left')) {
                this.dragging.style.left = `${containerPercentX}%`;
                this.dragging.style.right = '';
            } else if (type.includes('right')) {
                const rightPercent = ((rect.width - pixelX) / rect.width) * 100;
                this.dragging.style.right = `${rightPercent}%`;
                this.dragging.style.left = '';
            }

            const pixelY = imgTop + (constrainedY / 100) * imgH;
            const containerPercentY = (pixelY / rect.height) * 100;
            if (type.includes('top')) {
                this.dragging.style.top = `${containerPercentY}%`;
                this.dragging.style.bottom = '';
            } else if (type.includes('bottom')) {
                const bottomPercent = ((rect.height - pixelY) / rect.height) * 100;
                this.dragging.style.bottom = `${bottomPercent}%`;
                this.dragging.style.top = '';
            }
        } else {
            // fallback to previous behavior (container-relative)
            const xPercent = (x / rect.width) * 100;
            const yPercent = (y / rect.height) * 100;
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

    // AI-powered border detection using Python backend
    async autoDetectBorders() {
        const btn = document.getElementById('autoDetect');
        if (this.isDetecting) return;
        
        this.isDetecting = true;
        btn.disabled = true;
        btn.textContent = '🔄 Detecting...';

        try {
            // Check if server is healthy
            const healthCheck = await fetch('http://localhost:5000/health').catch(() => null);
            if (!healthCheck) {
                throw new Error('Python server not running. Please start it with: python3 card_detector.py');
            }

            if (this.frontImage) {
                await this.detectBordersForImage('front');
            }
            
            if (this.backImage) {
                await this.detectBordersForImage('back');
            }

            this.updateCenteringCalculations();
        } catch (error) {
            console.error('Border detection error:', error);
            alert('Error: ' + error.message);
        } finally {
            this.isDetecting = false;
            btn.disabled = false;
            btn.textContent = '🤖 Auto-detect Borders';
        }
    }

    async detectBordersForImage(side) {
        const canvas = document.getElementById(`${side}Canvas`);
        const container = document.getElementById(`${side}Container`);
        
        if (!canvas || canvas.style.display === 'none') {
            return;
        }

        try {
            // Get the canvas image as base64
            const imageData = canvas.toDataURL('image/jpeg', 0.95);
            
            // Send to Python backend
            const response = await fetch('http://localhost:5000/detect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: imageData
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Border detection failed');
            }

            const borders = await response.json();
            this.applyDetectedBorders(side, borders);
        } catch (error) {
            console.error(`Error detecting borders for ${side}:`, error);
            alert(`Error detecting ${side} borders: ${error.message}`);
        }
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
    window.cardCenteringApp = new CardCenteringApp();
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