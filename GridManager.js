// --- GRID MANAGER ---
// This class manages how all the images/filters are shown on screen in a grid.
// It takes care of placing images into cells, drawing them, handling clicks
// (like zooming in or picking a key color), and rendering an overlay when zoomed in.

class GridManager {
  constructor(imageWidth, imageHeight) {
    // Store the dimensions for each cell
    this.imageWidth = imageWidth;
    this.imageHeight = imageHeight;

    // The grid has 24 "slots" (cells) that can hold processed images
    this.displayGrid = new Array(27).fill(null);

    // Zoom state: -1 means no cell is zoomed in
    this.zoomedIndex = -1;

    // How much bigger the zoom should be compared to normal size
    this.zoomFactor = 3;

    // Padding space around the zoomed image
    this.zoomPadding = 20;

    // Labels to describe what each cell represents (matches filter order)
    this.labels = [
      "Webcam Image (Click to set Key)", "Grayscale & Brightness", "",
      "Red Channel", "Green Channel", "Blue Channel",
      "Threshold (Red)", "Threshold (Green)", "Threshold (Blue)",
      "Webcam Image (Repeat)", "Color Space 1 (HSV)", "Color Space 2 (YCbCr)",
      "Interactive Face Filter", "Threshold (Space 1)", "Threshold (Space 2)",
      "Extension: Landmark Art", "Extension: Chroma Key", "Extension: Glitch Art",
      "Extension: Face Melt",
      "Extension: ASCII Art",
      "Extension: Water Art",
      "Extension: Slit-Scan (Live)",
      "Extension: Edge Detection",
      "Extension: Color Palette",
      "Extension: Live Smile Mask",
      "Extension: Kaleidoscope",
      "Extension: Pointillism"
    ];
  }

  // Place an image into a grid cell at a specific index
  updateCell(index, image) {
    if (index >= 0 && index < this.displayGrid.length) {
      this.displayGrid[index] = image;
    }
  }

  // Get an image from a specific cell
  getCell(index) {
    if (index >= 0 && index < this.displayGrid.length) {
      return this.displayGrid[index];
    }
    return null;
  }

  // Main render function: draws the entire grid to the canvas
  render(videoInput, isImageCaptured) {
    background(30); // Dark background for contrast

    // If no snapshot taken, show live webcam in first slot
    if (!isImageCaptured && videoInput) {
      image(videoInput, 0, 0, this.imageWidth, this.imageHeight);
    }

    // Loop through all grid cells
    for (let i = 0; i < this.displayGrid.length; i++) {
      const bounds = this.getCellBounds(i); // Calculate where the cell goes

      // Draw background rectangle for the cell
      fill(45);
      noStroke();
      rect(bounds.x, bounds.y, bounds.w, bounds.h);

      // If an image exists for this cell, draw it
      if (this.displayGrid[i]) {
        image(this.displayGrid[i], bounds.x, bounds.y);
      }

      // Add text label under each cell
      fill(200);
      textSize(10);
      textAlign(CENTER, BOTTOM);
      text(this.labels[i] || '', bounds.x + bounds.w / 2, bounds.y + bounds.h - 2);

      // If this cell is zoomed, highlight it with a yellow border
      if (this.zoomedIndex === i) {
        noFill();
        stroke(255, 200, 0);
        strokeWeight(2);
        rect(bounds.x, bounds.y, bounds.w, bounds.h);
      }
    }

    // If a cell is zoomed, draw the zoom overlay on top
    if (this.zoomedIndex >= 0) {
      this._renderZoomOverlay();
    }
  }

  // Calculate the position and size of a specific grid cell
  getCellBounds(i) {
    const cols = 3;                       // Grid has 3 columns
    const col = i % cols;                 // Column position
    const row = floor(i / cols);          // Row position
    const x = col * (this.imageWidth + 10); // X position with spacing
    const y = row * (this.imageHeight + 10); // Y position with spacing
    return { x, y, w: this.imageWidth, h: this.imageHeight };
  }

  // Handles mouse clicks on the grid
  handleGridClick(mx, my, keyColorCallback) {
    // If zoomed in, check if click is inside zoom overlay first
    if (this.zoomedIndex !== -1) {
      if (this._handleZoomClick(mx, my, keyColorCallback)) return;
    }

    // Otherwise, check if a grid cell itself was clicked
    for (let i = 0; i < this.displayGrid.length; i++) {
      let bounds = this.getCellBounds(i);
      if (mx > bounds.x && mx < bounds.x + bounds.w && my > bounds.y && my < bounds.y + bounds.h) {
        if (i === 0) { 
          // Special case: clicking webcam cell lets user pick key color
          keyColorCallback(mx, my);
        } else {
          // Otherwise, toggle zoom: zoom in if not already zoomed, zoom out if same cell clicked again
          this.zoomedIndex = (this.zoomedIndex === i) ? -1 : i;
        }
        return;
      }
    }
  }

  // Handles clicks when zoom overlay is active
  _handleZoomClick(mx, my, keyColorCallback) {
    if (this.zoomedIndex < 0) return false;
    const { ox, oy, targetW, targetH } = this._getZoomDimensions();

    // Position of the close "X" button
    const closeSize = 20;
    const closeX = ox + targetW - closeSize - 4;
    const closeY = oy - closeSize - 4;

    // If click was on close button, exit zoom
    if (mx >= closeX && mx <= closeX + closeSize && my >= closeY && my <= closeY + closeSize) {
      this.closeZoom();
      return true;
    }

    // If click is inside zoomed image, map coordinates and use them for key color picking
    if (mx >= ox && mx <= ox + targetW && my >= oy && my <= oy + targetH) {
      const srcX = floor(map(mx - ox, 0, targetW, 0, this.imageWidth));
      const srcY = floor(map(my - oy, 0, targetH, 0, this.imageHeight));
      keyColorCallback(srcX, srcY);
      return true;
    }
    return false;
  }

  // Draws the zoom overlay (enlarged image + dim background + close button)
  _renderZoomOverlay() {
    if (this.zoomedIndex < 0) return;
    const zoomImg = this.displayGrid[this.zoomedIndex];
    const { ox, oy, targetW, targetH } = this._getZoomDimensions();

    push();
    // Dim entire background
    fill(0, 150);
    rect(0, 0, width, height);

    // Draw border box around zoomed image
    fill(40);
    stroke(200);
    strokeWeight(1);
    rect(ox - 6, oy - 6, targetW + 12, targetH + 12, 8);

    // Draw zoomed image if available, otherwise placeholder text
    if (zoomImg) {
      image(zoomImg, ox, oy, targetW, targetH);
    } else {
      fill(80);
      rect(ox, oy, targetW, targetH);
      fill(255);
      textSize(16);
      textAlign(CENTER, CENTER);
      text('No preview available', ox + targetW / 2, oy + targetH / 2);
    }

    // Instruction text above zoomed image
    fill(255);
    noStroke();
    textSize(14);
    textAlign(LEFT, BOTTOM);
    text('Zoomed View - Press ESC or click outside to close.', ox, oy - 10);

    // Close button (red box with X)
    const closeSize = 20;
    const closeX = ox + targetW - closeSize - 4;
    const closeY = oy - closeSize - 4;
    fill(180, 50, 50);
    rect(closeX, closeY, closeSize, closeSize, 4);
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(12);
    text('X', closeX + closeSize / 2, closeY + closeSize / 2);
    pop();
  }

  // Calculate the dimensions and position for zoom overlay
  _getZoomDimensions() {
    const maxW = width - this.zoomPadding * 2; // Limit width so it fits in screen
    const targetW = min(maxW, this.imageWidth * this.zoomFactor);
    const targetH = floor(targetW * this.imageHeight / this.imageWidth);
    const ox = (width - targetW) / 2; // Center horizontally
    const oy = (height - targetH) / 2; // Center vertically
    return { ox, oy, targetW, targetH };
  }

  // Reset zoom back to "no zoom"
  closeZoom() {
    this.zoomedIndex = -1;
  }
}
