// --- GLOBAL VARIABLES & P5.JS HOOKS ---
// These variables are used across the entire sketch
let app;                 // Main controller of the application, handles logic & UI
let faceapi;             // ML5 FaceMesh model instance
let modelReady = false;  // Flag to check if the FaceMesh model is loaded
let backgroundImage;     // Background image for chroma key effect

// Constants for consistent image width & height
const IMAGE_W = 160;
const IMAGE_H = 120;

function preload() {
  // Load the FaceMesh model with max 1 face at a time
  faceapi = ml5.facemesh(() => {
    console.log("FaceMesh model ready! ✅"); // Confirm model is loaded
    modelReady = true;                       // Model loaded successfully
  }, { maxFaces: 1 });

  // Load the static background image for chroma keying
  backgroundImage = loadImage('images/bg.jpeg');
}

function setup() {
  // Create the main drawing canvas based on grid layout
  const canvas = createCanvas(IMAGE_W * 3 + 20, IMAGE_H * 9 + 80);
  canvas.parent('p5-canvas-container'); // Attach canvas to HTML container

  // Initialize the main application controller
  app = new AppController(IMAGE_W, IMAGE_H);

  // Attach a listener to the HTML "capture" button
  const captureButton = document.getElementById('capture-button');
  if (captureButton) {
    captureButton.addEventListener('click', () => app.captureFrame());
  }
}

function draw() {
  // Update and render app continuously
  if (app) {
    app.update(); // Update state, apply filters
    app.render(); // Render everything on screen
  }
}

function mousePressed() {
  // Handle mouse click interactions (color picking, zooming etc.)
  if (app) app.handleMousePressed();
}

function keyPressed() {
  // Handle keyboard shortcuts (escape, filter switching)
  if (app) app.handleKeyPressed();
}

// --- MAIN APPLICATION CONTROLLER ---
// This class manages the entire app: video input, filters, face detection,
// grid rendering, live effects, and user interactions.

class AppController {
  constructor(imageWidth, imageHeight) {
    // Store base dimensions
    this.imageWidth = imageWidth;
    this.imageHeight = imageHeight;

    // Initialize helper managers
    this.gridManager = new GridManager(imageWidth, imageHeight); // Controls grid of images
    this.extensionManager = new ExtensionManager();              // Applies all image filters

    // State variables
    this.videoInput = null;           // Live webcam feed
    this.capturedImage = null;        // Saved frame from webcam
    this.isImageCaptured = false;     // Has the user taken a snapshot?
    this.detectedFaces = [];          // Stores detected faces from FaceMesh
    this.activeFaceFilter = 0;        // Which face filter is currently selected
    this.keyColor = color(0, 255, 0); // Default green color for chroma key
      

    // Buffers for special effects
    this.slitScanImage = createGraphics(imageWidth, imageHeight); // Horizontal time-slice effect
    this.slitScanX = 0;                                           // Position tracker for slit-scan
    this.faceMeltBuffer = createGraphics(imageWidth, imageHeight); // Face-melt distortion effect
    this.faceMeltBuffer.background(0);
    this.faceMeltBuffer.pixelDensity(1);
    this.kaleidoscopeBuffer = createGraphics(imageWidth, imageHeight); // ADD THIS LINE
    this.pointillismBuffer = createGraphics(imageWidth, imageHeight);

    // Sliders for user control (UI adjustments)
    this.uiSliders = {
      red: createSlider(0, 255, 50).parent('slider-red-container'),
      green: createSlider(0, 255, 50).parent('slider-green-container'),
      blue: createSlider(0, 255, 50).parent('slider-blue-container'),
      colorModel1: createSlider(0, 255, 127).parent('slider-model1-container'),
      colorModel2: createSlider(0, 255, 127).parent('slider-model2-container'),
      chroma: createSlider(0, 200, 50).parent('slider-chroma-container'),
      palette: createSlider(2, 10, 5, 1).parent('slider-palette-container')
    };
      // --- ADD THIS ENTIRE BLOCK FOR THE LIVE MASK ---
    this.faceApi = null; // Instance for the new mask's face detection
    this.liveDetections_faceApi = []; // Detections from the new model
    this.liveMaskBuffer = createGraphics(imageWidth, imageHeight); // Buffer to draw the mask into

    // Live mask state
    this.smileThreshold = 55;
    this.animatedGlow = 0;
    this.animatedShape = 0;
    this.isSmiling = false;
    this.currentMaskType = 'visor';

    // UI Controls for the Live Mask
    this.maskControls = {
        selector: document.getElementById('mask-selector-dropdown'),
        color: document.getElementById('mask-color-picker'),
        opacity: createSlider(0, 255, 200).parent('slider-mask-opacity-container'),
        glow: createSlider(0, 64, 32).parent('slider-mask-glow-container'),
    };
    this.maskControls.selector.addEventListener('change', (event) => {
        this.currentMaskType = event.target.value;
    });
    
    // Start capturing live video feed
    this.initializeVideo();
  }

  initializeVideo() {
    // Start webcam capture, resize, and hide default video element
    this.videoInput = createCapture(VIDEO, () => {
      this.videoInput.size(this.imageWidth, this.imageHeight);
      this.videoInput.hide();
    });
      const faceApiOptions = { withLandmarks: true, withDescriptors: false };
          this.faceApi = ml5.faceApi(this.videoInput, faceApiOptions, () => {
              console.log('FaceAPI model for live mask ready! ✅');
              this.faceApi.detect((err, result) => this.gotLiveApiFaces(err, result));
          });
  }

  captureFrame() {
    // Handle snapshot capture
    if (!this.videoInput || !modelReady) {
      console.log("Model or video not ready yet, please wait.");
      return;
    }
    // Reset states for a fresh capture
    this.slitScanX = 0;
    this.activeFaceFilter = 0;
    this.capturedImage = this.videoInput.get();
    this.capturedImage.resize(this.imageWidth, this.imageHeight);
    this.isImageCaptured = true;
    
    // Hide instructional overlay (if any)
    const overlay = document.getElementById('instruction-overlay');
    if (overlay) overlay.style.opacity = '0';

    // Mirror and copy captured frame into face-melt buffer
    this.faceMeltBuffer.push();
    this.faceMeltBuffer.translate(this.imageWidth, 0);
    this.faceMeltBuffer.scale(-1, 1); // Flip horizontally
    this.faceMeltBuffer.image(this.capturedImage, 0, 0, this.imageWidth, this.imageHeight);
    this.faceMeltBuffer.pop();

    // Run face detection on the captured image
    faceapi.predict(this.capturedImage, (results) => this.gotFaces(results));
  }

  gotFaces(results) {
    // Store detected faces (or empty array if none)
    this.detectedFaces = Array.isArray(results) ? results : [];
    console.log(`Detected ${this.detectedFaces.length} faces.`);
    this.runAllStaticFilters(); // Update all filters that only need one run
  }

  runAllStaticFilters() {
    // Apply once-only filters on snapshot
    if (!this.capturedImage) return;
    const img = this.capturedImage;
    const gm = this.gridManager;
    const em = this.extensionManager;

    // Fill grid cells with different processed versions
    gm.updateCell(0, img);
    gm.updateCell(1, em.applyGrayscaleFilter(img));
    const channels = em.getChannelImages(img);
    gm.updateCell(3, channels.red);
    gm.updateCell(4, channels.green);
    gm.updateCell(5, channels.blue);
    gm.updateCell(9, img);
    gm.updateCell(10, em.changeColorModel(img, 'HSV'));
    gm.updateCell(11, em.changeColorModel(img, 'YCbCr'));
    gm.updateCell(12, em.applyFaceFilter(img, this.detectedFaces, this.activeFaceFilter));
    gm.updateCell(15, em.applyLandmarkArtFilter(img, this.detectedFaces));
    gm.updateCell(17, em.applyGlitchArtFilter(img));
    gm.updateCell(18, this.faceMeltBuffer);
    gm.updateCell(19, em.applyAsciiArtFilter(img));
   gm.updateCell(20, em.applyWateryFilter(img, frameCount)); 

    gm.updateCell(21, this.slitScanImage);
    gm.updateCell(22, em.applySobelFilter(img));
    
    // Run dynamic filters once as well
    this.updateDynamicFilters();
  }

  // Main update loop for both live and static effects
update() {
    // This part runs every frame, regardless of snapshots
    this.updateLiveEffects(); // Updates slit-scan and face melt
    
    // --- LIVE MASK LOGIC (MOVED HERE) ---
    // This logic now runs continuously for a true live stream effect.
    if (this.liveDetections_faceApi && this.liveDetections_faceApi.length > 0) {
        const landmarks = this.liveDetections_faceApi[0].landmarks.positions;
        const mouthLeft = landmarks[48], mouthRight = landmarks[54];
        const eyeOuterLeft = landmarks[36], eyeOuterRight = landmarks[45];
        
        const mouthWidth = dist(mouthLeft._x, mouthLeft._y, mouthRight._x, mouthRight._y);
        const eyeDistance = dist(eyeOuterLeft._x, eyeOuterLeft._y, eyeOuterRight._x, eyeOuterRight._y);
        
        const normalizedMouthWidth = (mouthWidth / eyeDistance) * 100;
        this.isSmiling = normalizedMouthWidth > this.smileThreshold;

        // Smoothly animate values
        this.animatedGlow = lerp(this.animatedGlow, this.isSmiling ? 1 : 0, 0.1);
        this.animatedShape = lerp(this.animatedShape, this.isSmiling ? 1 : 0, 0.1);
    }
    
    // Package controls to send to the filter manager
    const maskRenderControls = {
        maskType: this.currentMaskType,
        color: this.maskControls.color.value,
        opacity: this.maskControls.opacity.value(),
        glow: this.maskControls.glow.value(),
        animatedShape: this.animatedShape,
        animatedGlow: this.animatedGlow
    };

    // Generate the mask image and update the grid cell on every frame
    this.liveMaskBuffer = this.extensionManager.applyLiveMaskFilter(this.videoInput, this.liveDetections_faceApi, maskRenderControls);
    this.gridManager.updateCell(24, this.liveMaskBuffer);
    
     // --- THE KALEIDOSCOPE ---
    this.kaleidoscopeBuffer = this.extensionManager.applyKaleidoscopeFilter(this.videoInput);
    this.gridManager.updateCell(25, this.kaleidoscopeBuffer);
    
     // ---  POINTILLISM FILTER ---
    this.pointillismBuffer = this.extensionManager.applyPointillismFilter(this.videoInput);
    this.gridManager.updateCell(26, this.pointillismBuffer);
    
    // --- SNAPSHOT LOGIC ---
    // This part ONLY runs after you click the "Capture" button.
    if (this.isImageCaptured) {
      this.updateDynamicFilters();
        this.gridManager.updateCell(20, this.extensionManager.applyWateryFilter(this.capturedImage, frameCount));
    }
}
  render() {
    // Pass rendering responsibility to grid manager
    this.gridManager.render(this.videoInput, this.isImageCaptured);
  }

  updateDynamicFilters() {
    // Update filters that depend on sliders and change continuously
    const gm = this.gridManager;
    const em = this.extensionManager;
    gm.updateCell(6, em.runThresholdFilter(gm.getCell(3), this.uiSliders.red.value()));
    gm.updateCell(7, em.runThresholdFilter(gm.getCell(4), this.uiSliders.green.value()));
    gm.updateCell(8, em.runThresholdFilter(gm.getCell(5), this.uiSliders.blue.value()));
    gm.updateCell(13, em.runThresholdFilter(gm.getCell(10), this.uiSliders.colorModel1.value()));
    gm.updateCell(14, em.runThresholdFilter(gm.getCell(11), this.uiSliders.colorModel2.value()));
    gm.updateCell(16, em.applyChromaKeyFilter(this.capturedImage, backgroundImage, this.keyColor, this.uiSliders.chroma.value()));
    gm.updateCell(23, em.applyPaletteExtractor(this.capturedImage, this.uiSliders.palette.value()));
  }

  updateLiveEffects() {
    // Slit-scan effect: constantly slicing and pasting live feed
    if (this.videoInput) {
      const sx = floor(this.imageWidth / 2); // Take slice from center column
      let slice = this.videoInput.get(sx, 0, 1, this.imageHeight);
      if (slice) {
        this.slitScanImage.image(slice, this.slitScanX, 0);
        this.slitScanX = (this.slitScanX + 1) % this.imageWidth;
      }
    }
    // Face melt runs only after snapshot & if face detected
    if (this.isImageCaptured && this.detectedFaces.length > 0) {
      this._updateFaceMeltFilter();
    }
  }

  _updateFaceMeltFilter() {
    // Create the "melting face" effect by stretching pixels downward
    const keypoints = this.detectedFaces[0].scaledMesh; // Face landmark points
    const w = this.imageWidth, h = this.imageHeight;

    // Find bounding box around detected face
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (const [x, y] of keypoints) {
      const mirroredX = w - x; // Account for mirrored image
      minX = Math.min(minX, mirroredX);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, mirroredX);
      maxY = Math.max(maxY, y);
    }

    // Expand box slightly to cover more area
    minX = Math.max(0, minX - 10);
    maxX = Math.min(w, maxX + 10);
    minY = Math.max(0, minY - 10);
    maxY = Math.min(h, maxY + 10);

    // Pixel manipulation: gradually smear pixels downward
    this.faceMeltBuffer.loadPixels();
    for (let x = floor(minX); x < floor(maxX); x++) {
      for (let y = floor(maxY) - 1; y > floor(minY); y--) {
        const aboveIndex = ((y - 1) * w + x) * 4;
        const cAbove = color(
          this.faceMeltBuffer.pixels[aboveIndex],
          this.faceMeltBuffer.pixels[aboveIndex + 1],
          this.faceMeltBuffer.pixels[aboveIndex + 2]
        );
        const currentIndex = (y * w + x) * 4;
        const cCurrent = color(
          this.faceMeltBuffer.pixels[currentIndex],
          this.faceMeltBuffer.pixels[currentIndex + 1],
          this.faceMeltBuffer.pixels[currentIndex + 2]
        );
        const blendedColor = lerpColor(cCurrent, cAbove, 0.05);
        this.faceMeltBuffer.pixels[currentIndex] = red(blendedColor);
        this.faceMeltBuffer.pixels[currentIndex + 1] = green(blendedColor);
        this.faceMeltBuffer.pixels[currentIndex + 2] = blue(blendedColor);
      }
    }
    this.faceMeltBuffer.updatePixels();
  }

  setKeyColor(x, y) {
    // Allow user to pick chroma-key color from captured image
    if (this.capturedImage) {
      const sx = constrain(floor(x), 0, this.capturedImage.width - 1);
      const sy = constrain(floor(y), 0, this.capturedImage.height - 1);
      this.keyColor = this.capturedImage.get(sx, sy);
      console.log("New Key Color set:", this.keyColor);
      this.updateDynamicFilters(); // Refresh filters with new key color
    }
  }

  handleMousePressed() {
    // When user clicks on grid, set chroma-key color
    this.gridManager.handleGridClick(mouseX, mouseY, (x, y) => this.setKeyColor(x, y));
  }

  handleKeyPressed() {
    // Handle escape key and filter shortcuts
    if (keyCode === ESCAPE) {
      this.gridManager.closeZoom(); // Close zoom view
      return;
    }
    if (this.isImageCaptured && key >= '1' && key <= '4') {
      this.activeFaceFilter = parseInt(key); // Switch to different face filter
      this.gridManager.updateCell(12,
        this.extensionManager.applyFaceFilter(
          this.capturedImage,
          this.detectedFaces,
          this.activeFaceFilter
        )
      );
    }
  }
    gotLiveApiFaces(error, result) {
        if (error) {
            console.error(error);
            return;
        }
        this.liveDetections_faceApi = result;
        // Continue the loop
        this.faceApi.detect((err, result) => this.gotLiveApiFaces(err, result));
    }
}


/*
----COMMENTRY----

Thresholding individual R, G, and B channels is often unreliable, as an object's brightness varies across the spectrum, leading to noisy or incomplete segmentation. A more robust method is to convert the image to a color space like HSV, which separates pixel intensity (Value) from color information (Hue and Saturation). By thresholding the 'Value' channel, we can segment the image based on overall brightness, isolating illumination from color. This is more effective for identifying shapes and outlines regardless of their color.

The project was completed successfully, but not without challenges. The primary goal was to maintain a high level of code organization to manage the complexity of numerous filters. The solution was to adopt an Object-Oriented structure from the outset, separating the application's logic (AppController), rendering (GridManager), and image processing algorithms (FilterManager). This modular approach was critical for integrating new features without breaking existing ones. Another key challenge was performance; while a few extensions run live, applying all filters to the video stream in real-time was not feasible due to hardware limitations, necessitating the snapshot-based system for the main grid.

The most technically demanding features to implement were the "Face Melt" and "Live Smile Mask" extensions. The "Face Melt" required direct pixel manipulation within a bounding box defined by facial landmarks. The main challenge was to efficiently read, blend, and write pixel data in every frame to create a smooth 'melting' animation without a significant performance drop.

The "Live Smile Mask" was even more complex, as it involved running a second, separate ML model (faceApi) in a continuous loop to get live landmark data. A key difficulty was devising a reliable heuristic to detect a "smile" by calculating the ratio between mouth width and eye distance. Implementing smooth animations on the mask's properties in response to this detection using lerp added another layer of complexity.

This project goes far beyond the requirements by implementing a suite of twelve unique extensions. These additions showcase a wide range of graphics programming techniques, from creative live filters to complex algorithmic processes. The extensions include Landmark Art, Chroma Keying, Glitch Art, ASCII Art, a Watery effect, Sobel Edge Detection, Kleidoscope filter, Pointelism filter and a Color Palette Extractor.

The most innovative and technically challenging extensions are the interactive and live filters. The "Live Smile Mask" is a standout feature, combining real-time machine learning, geometric analysis of facial features, and procedural animation to create an interactive experience. The "Face Melt" filter is similarly advanced, demonstrating a command of low-level pixel processing to achieve a dynamic, stateful visual effect. The live Kaleidoscope and Pointillism filters were built to explore real-time artistic rendering. The Kaleidoscope effect was achieved by using a clipping mask to isolate a wedge of the video, which is then repeatedly rotated and mirrored to generate symmetrical patterns. The Pointillism filter reinterprets the video by sampling it on a grid and drawing circles whose diameters are mapped to the brightness of the underlying pixels, transforming the feed into an impressionistic style.

*/


