// --- EXTENSION MANAGER ---
// This class contains all the filter algorithms and image processing logic.
// The design is stateless, meaning it does not remember past states of images.
// Instead, each method takes an input image (with optional parameters) 
// and produces a new processed output image.

class ExtensionManager {
  constructor() {
    // The constructor is intentionally empty.
    // This class works more like a static utility holder,
    // where all methods act on input images and return transformed outputs.
  }

  // =============================
  // BASIC FILTERS
  // =============================

  // Converts an image into grayscale with a slight brightness boost
  // Formula: weighted average of R, G, B using human perception factors
  applyGrayscaleFilter(sourceImage) {
    let resultImage = createImage(sourceImage.width, sourceImage.height);
    resultImage.loadPixels();
    sourceImage.loadPixels();
    for (let i = 0; i < sourceImage.pixels.length; i += 4) {
      // Extract red, green, blue values
      const [r, g, b] = [sourceImage.pixels[i], sourceImage.pixels[i + 1], sourceImage.pixels[i + 2]];

      // Standard grayscale calculation with perceptual weights
      let grayscaleValue = 0.299 * r + 0.587 * g + 0.114 * b;

      // Add a brightness boost to make the grayscale look sharper
      grayscaleValue = min(grayscaleValue * 1.2, 255);

      // Assign grayscale value back to R, G, and B channels equally
      resultImage.pixels[i] = resultImage.pixels[i + 1] = resultImage.pixels[i + 2] = grayscaleValue;
      resultImage.pixels[i + 3] = 255; // Alpha channel stays fully opaque
    }
    resultImage.updatePixels();
    return resultImage;
  }

  // Splits the image into three separate images,
  // each showing only one color channel (R, G, or B)
  getChannelImages(sourceImage) {
    let rImg = createImage(sourceImage.width, sourceImage.height);
    let gImg = createImage(sourceImage.width, sourceImage.height);
    let bImg = createImage(sourceImage.width, sourceImage.height);

    rImg.loadPixels();
    gImg.loadPixels();
    bImg.loadPixels();
    sourceImage.loadPixels();

    for (let i = 0; i < sourceImage.pixels.length; i += 4) {
      const [r, g, b] = [sourceImage.pixels[i], sourceImage.pixels[i + 1], sourceImage.pixels[i + 2]];

      // Red channel only
      rImg.pixels[i] = r;
      rImg.pixels[i + 1] = 0;
      rImg.pixels[i + 2] = 0;
      rImg.pixels[i + 3] = 255;

      // Green channel only
      gImg.pixels[i] = 0;
      gImg.pixels[i + 1] = g;
      gImg.pixels[i + 2] = 0;
      gImg.pixels[i + 3] = 255;

      // Blue channel only
      bImg.pixels[i] = 0;
      bImg.pixels[i + 1] = 0;
      bImg.pixels[i + 2] = b;
      bImg.pixels[i + 3] = 255;
    }

    // Commit the changes
    rImg.updatePixels();
    gImg.updatePixels();
    bImg.updatePixels();

    return { red: rImg, green: gImg, blue: bImg };
  }

  // Creates a black-and-white threshold effect
  // Any pixel brighter than the threshold becomes white, else black
  runThresholdFilter(sourceImage, thresholdLevel) {
    if (!sourceImage) return createImage(160, 120); // Return a blank default image if no input
    let resultImage = createImage(sourceImage.width, sourceImage.height);
    resultImage.loadPixels();
    sourceImage.loadPixels();

    for (let i = 0; i < sourceImage.pixels.length; i += 4) {
      const brightness = (sourceImage.pixels[i] + sourceImage.pixels[i + 1] + sourceImage.pixels[i + 2]) / 3;
      const val = brightness > thresholdLevel ? 255 : 0; // Binary thresholding
      resultImage.pixels[i] = resultImage.pixels[i + 1] = resultImage.pixels[i + 2] = val;
      resultImage.pixels[i + 3] = 255;
    }

    resultImage.updatePixels();
    return resultImage;
  }

  // Converts the color model of an image into either HSV or YCbCr
  changeColorModel(sourceImage, modelName) {
    let resultImage = createImage(sourceImage.width, sourceImage.height);
    resultImage.loadPixels();
    sourceImage.loadPixels();

    for (let i = 0; i < sourceImage.pixels.length; i += 4) {
      const [r, g, b] = [sourceImage.pixels[i], sourceImage.pixels[i + 1], sourceImage.pixels[i + 2]];
      let newPixel = modelName === 'HSV' ? this._rgbToHsv(r, g, b) : this._rgbToYcbcr(r, g, b);

      // Normalize HSV into [0–255] range so it can display properly
      if (modelName === 'HSV') {
        newPixel = [newPixel[0] / 360 * 255, newPixel[1] * 255, newPixel[2] * 255];
      }

      resultImage.pixels[i] = newPixel[0];
      resultImage.pixels[i + 1] = newPixel[1];
      resultImage.pixels[i + 2] = newPixel[2];
      resultImage.pixels[i + 3] = 255;
    }

    resultImage.updatePixels();
    return resultImage;
  }

  // =============================
  // FACE FILTERS
  // =============================

  // Applies different effects specifically to the detected face region
  applyFaceFilter(sourceImage, detectedFaces, activeFaceFilter) {
    let outputGraphics = createGraphics(sourceImage.width, sourceImage.height);
    outputGraphics.image(sourceImage, 0, 0);

    if (detectedFaces.length > 0) {
      // Extract bounding box of the first detected face
      const bbox = detectedFaces[0].boundingBox;
      const faceBox = {
        x: Math.floor(bbox.topLeft[0][0]),
        y: Math.floor(bbox.topLeft[0][1]),
        w: Math.ceil(bbox.bottomRight[0][0] - bbox.topLeft[0][0]),
        h: Math.ceil(bbox.bottomRight[0][1] - bbox.topLeft[0][1])
      };

      if (faceBox.w > 0 && faceBox.h > 0) {
        // Grab the face region as a sub-image
        let faceRegion = sourceImage.get(faceBox.x, faceBox.y, faceBox.w, faceBox.h);

        // Apply chosen filter
        switch (activeFaceFilter) {
          case 1: faceRegion.filter(GRAY); break; // Grayscale
          case 2: faceRegion.filter(BLUR, 8); break; // Blur
          case 3: faceRegion = this.changeColorModel(faceRegion, 'HSV'); break; // HSV model
          case 4: faceRegion = this.runPixelateFilter(faceRegion); break; // Pixelation
        }

        // Place processed face back into output
        outputGraphics.image(faceRegion, faceBox.x, faceBox.y, faceBox.w, faceBox.h);

        // Draw a visible rectangle around the face for clarity
        outputGraphics.stroke(0, 255, 255);
        outputGraphics.strokeWeight(2);
        outputGraphics.noFill();
        outputGraphics.rect(faceBox.x, faceBox.y, faceBox.w, faceBox.h);
      }
    } else {
      // If no face detected, overlay a red warning message
      outputGraphics.fill(255, 0, 0);
      outputGraphics.noStroke();
      outputGraphics.textAlign(CENTER, CENTER);
      outputGraphics.text("No face detected", outputGraphics.width / 2, outputGraphics.height / 2);
    }
    return outputGraphics;
  }

  // Adds artistic dots at every detected facial landmark point
  applyLandmarkArtFilter(sourceImage, detectedFaces) {
    let outputGraphics = createGraphics(sourceImage.width, sourceImage.height);
    outputGraphics.image(sourceImage, 0, 0);
    if (detectedFaces.length > 0) {
      outputGraphics.noStroke();
      outputGraphics.fill(0, 255, 255, 200);

      // Iterate over all facial keypoints
      const keypoints = detectedFaces[0].scaledMesh;
      for (let i = 0; i < keypoints.length; i++) {
        const [x, y] = keypoints[i];
        outputGraphics.ellipse(x, y, 3, 3); // Draw a small glowing dot
      }
    }
    return outputGraphics;
  }

  // =============================
  // SPECIAL EFFECTS FILTERS
  // =============================

  // Green screen effect (chroma key) to replace a given background color
  applyChromaKeyFilter(sourceImage, backgroundImage, keyColor, threshold) {
    let resultImage = createImage(sourceImage.width, sourceImage.height);

    // If no background provided, return a red placeholder
    if (!backgroundImage || !backgroundImage.width) {
      resultImage.background(255, 0, 0);
      return resultImage;
    }

    sourceImage.loadPixels();
    resultImage.loadPixels();
    backgroundImage.loadPixels();

    // Extract target color values
    const keyR = red(keyColor);
    const keyG = green(keyColor);
    const keyB = blue(keyColor);

    for (let i = 0; i < sourceImage.pixels.length; i += 4) {
      const r = sourceImage.pixels[i];
      const g = sourceImage.pixels[i + 1];
      const b = sourceImage.pixels[i + 2];

      // Calculate distance between current pixel and target chroma key color
      const colorDist = dist(r, g, b, keyR, keyG, keyB);

      if (colorDist < threshold) {
        // If pixel matches key color → replace with background
        resultImage.pixels[i] = backgroundImage.pixels[i] || 0;
        resultImage.pixels[i + 1] = backgroundImage.pixels[i + 1] || 0;
        resultImage.pixels[i + 2] = backgroundImage.pixels[i + 2] || 0;
      } else {
        // Otherwise, keep original pixel
        resultImage.pixels[i] = r;
        resultImage.pixels[i + 1] = g;
        resultImage.pixels[i + 2] = b;
      }
      resultImage.pixels[i + 3] = 255;
    }

    resultImage.updatePixels();
    return resultImage;
  }

  // Creates a glitchy RGB displacement effect by randomly shifting channels
  applyGlitchArtFilter(sourceImage) {
    let resultImage = createImage(sourceImage.width, sourceImage.height);
    sourceImage.loadPixels();
    resultImage.loadPixels();

    const w = sourceImage.width;
    const h = sourceImage.height;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const index = (y * w + x) * 4;
        const xOffset = floor(random(-15, 15)); // Random channel shift
        const g = sourceImage.pixels[index + 1];

        // Red shifted left or right
        let rx = x + xOffset;
        let r = (rx >= 0 && rx < w) ? sourceImage.pixels[(y * w + rx) * 4] : 0;

        // Blue shifted opposite direction
        let bx = x - xOffset;
        let b = (bx >= 0 && bx < w) ? sourceImage.pixels[(y * w + bx) * 4 + 2] : 0;

        resultImage.pixels[index] = r;
        resultImage.pixels[index + 1] = g;
        resultImage.pixels[index + 2] = b;
        resultImage.pixels[index + 3] = 255;
      }
    }
    resultImage.updatePixels();
    return resultImage;
  }

  // Converts an image into ASCII-art style text blocks
  applyAsciiArtFilter(sourceImage) {
    let resultGraphics = createGraphics(sourceImage.width, sourceImage.height);

    // Preprocess: grayscale + posterize to simplify tones
    let contrastImage = sourceImage.get();
    contrastImage.filter(GRAY);
    contrastImage.filter(POSTERIZE, 5);

    resultGraphics.background(0);
    resultGraphics.fill(255);
    resultGraphics.textFont('monospace');

    const blockSize = 3; // Size of text cells
    resultGraphics.textSize(blockSize * 1.5);

    // Density of characters from darkest to lightest
    const density = '█▇▆▅▄▃▂ ';

    contrastImage.loadPixels();
    for (let y = 0; y < contrastImage.height; y += blockSize) {
      for (let x = 0; x < contrastImage.width; x += blockSize) {
        const index = (y * contrastImage.width + x) * 4;
        const brightness = contrastImage.pixels[index];

        // Map brightness to a character index
        const charIndex = floor(map(brightness, 0, 255, density.length - 1, 0));
        resultGraphics.text(density.charAt(charIndex), x, y);
      }
    }
    return resultGraphics;
  }

 // --- NEW WATERY FILTER ---
  applyWateryFilter(sourceImage, frameCount) {
      let resultImage = createImage(sourceImage.width, sourceImage.height);
      resultImage.loadPixels();
      sourceImage.loadPixels();

      // Guard against running on an empty pixels array
      if (sourceImage.pixels.length === 0) {
          return resultImage;
      }

      // Parameters adjusted for the smaller canvas size and desired effect
      const waveSpeed = frameCount * 0.05;
      const waveFrequency = 0.1;
      const waveAmplitude = 10;
      const width = sourceImage.width;
      const height = sourceImage.height;

      // Iterate through every pixel on the canvas
      for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
              
              // Calculate a distortion offset using sine waves for a ripple effect
              const offsetX = sin(y * waveFrequency + waveSpeed) * waveAmplitude;
              const offsetY = sin(x * waveFrequency + waveSpeed) * waveAmplitude;

              // Calculate the source coordinates to sample from
              const srcX = floor(x + offsetX);
              const srcY = floor(y + offsetY);

              // Check if the source coordinates are within the image bounds
              if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
                  // Get the color from the source pixel in the snapshot
                  const srcIndex = (srcX + srcY * width) * 4;
                  const r = sourceImage.pixels[srcIndex];
                  const g = sourceImage.pixels[srcIndex + 1];
                  const b = sourceImage.pixels[srcIndex + 2];

                  // Set the color of the current pixel in our result image
                  const destIndex = (x + y * width) * 4;
                  resultImage.pixels[destIndex] = r;
                  resultImage.pixels[destIndex + 1] = g;
                  resultImage.pixels[destIndex + 2] = b;
                  resultImage.pixels[destIndex + 3] = 255;
              }
          }
      }
      // Apply all the pixel changes
      resultImage.updatePixels();
      return resultImage;
  }

  // Edge detection using Sobel operator (detects horizontal/vertical intensity changes)
  applySobelFilter(sourceImage) {
    let resultImage = createImage(sourceImage.width, sourceImage.height);

    // Work on grayscale copy to simplify
    let grayImage = sourceImage.get();
    grayImage.filter(GRAY);

    // Sobel kernels
    const kernelX = [ [-1, 0, 1], [-2, 0, 2], [-1, 0, 1] ];
    const kernelY = [ [-1, -2, -1], [0, 0, 0], [1, 2, 1] ];

    grayImage.loadPixels();
    resultImage.loadPixels();

    const w = grayImage.width;
    const h = grayImage.height;

    for (let x = 1; x < w - 1; x++) {
      for (let y = 1; y < h - 1; y++) {
        let sumX = 0, sumY = 0;

        // Apply kernel convolution
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            const val = grayImage.pixels[((y + j - 1) * w + (x + i - 1)) * 4];
            sumX += val * kernelX[j][i];
            sumY += val * kernelY[j][i];
          }
        }

        // Gradient magnitude gives edge intensity
        const magnitude = constrain(floor(sqrt(sumX * sumX + sumY * sumY)), 0, 255);
        const index = (y * w + x) * 4;
        resultImage.pixels[index] = resultImage.pixels[index + 1] = resultImage.pixels[index + 2] = magnitude;
        resultImage.pixels[index + 3] = 255;
      }
    }

    resultImage.updatePixels();
    return resultImage;
  }


  applyPaletteExtractor(sourceImage, numColors) {
    // Create an off-screen graphics buffer the same size as the source image
    let resultGraphics = createGraphics(sourceImage.width, sourceImage.height);
    resultGraphics.image(sourceImage, 0, 0);

    // Limit number of colors to at least 2, convert to integer
    const k = max(2, floor(numColors));

    // Dictionary to store buckets of similar colors
    const colorBuckets = {};
    sourceImage.loadPixels();

    // Iterate over all pixels in the image
    for (let i = 0; i < sourceImage.pixels.length; i += 4) {
      const r = sourceImage.pixels[i], 
            g = sourceImage.pixels[i + 1], 
            b = sourceImage.pixels[i + 2];

      // Quantize colors by dividing into bins (32-step quantization)
      const key = `${floor(r/32)},${floor(g/32)},${floor(b/32)}`;

      // Initialize bucket if it doesn't exist
      if (!colorBuckets[key]) 
        colorBuckets[key] = { sum_r: 0, sum_g: 0, sum_b: 0, count: 0 };

      // Accumulate sums for averaging later
      colorBuckets[key].sum_r += r;
      colorBuckets[key].sum_g += g;
      colorBuckets[key].sum_b += b;
      colorBuckets[key].count++;
    }

    // Sort buckets by how many pixels fall into them (most frequent colors first)
    const sortedBuckets = Object.values(colorBuckets).sort((a, b) => b.count - a.count);

    // Take the top-k buckets and calculate their average RGB values
    const dominantColors = sortedBuckets.slice(0, k).map(b => 
      color(b.sum_r / b.count, b.sum_g / b.count, b.sum_b / b.count)
    );

    // Draw swatches of the dominant colors on the result graphic
    resultGraphics.noStroke();
    const swatchHeight = 15;
    const swatchWidth = sourceImage.width / max(1, dominantColors.length);
    dominantColors.forEach((c, i) => {
      resultGraphics.fill(c);
      resultGraphics.rect(i * swatchWidth, sourceImage.height - swatchHeight, swatchWidth, swatchHeight);
    });

    // Return the modified graphic (original image + swatches)
    return resultGraphics;
  }

  // --- FIXED: This filter now correctly calculates the average color of each block ---
  runPixelateFilter(sourceImage) {
    // Create a new image to store the result
    let resultImage = createImage(sourceImage.width, sourceImage.height);
    const pixelBlockSize = 8; // Size of each pixel block (controls pixelation strength)

    sourceImage.loadPixels();
    resultImage.loadPixels();

    // Loop through the image in block-sized steps
    for (let y = 0; y < sourceImage.height; y += pixelBlockSize) {
      for (let x = 0; x < sourceImage.width; x += pixelBlockSize) {

        // --- Calculate the average color of the block ---
        let totalR = 0, totalG = 0, totalB = 0;
        let pixelCount = 0;

        for (let j = 0; j < pixelBlockSize; j++) {
          for (let i = 0; i < pixelBlockSize; i++) {
            const px = x + i;
            const py = y + j;

            // Ensure pixel is within bounds
            if (px < sourceImage.width && py < sourceImage.height) {
              const index = (py * sourceImage.width + px) * 4;
              totalR += sourceImage.pixels[index];
              totalG += sourceImage.pixels[index + 1];
              totalB += sourceImage.pixels[index + 2];
              pixelCount++;
            }
          }
        }

        // Compute block's average RGB values
        const avgR = pixelCount > 0 ? totalR / pixelCount : 0;
        const avgG = pixelCount > 0 ? totalG / pixelCount : 0;
        const avgB = pixelCount > 0 ? totalB / pixelCount : 0;

        // --- Paint the block with the average color ---
        for (let j = 0; j < pixelBlockSize; j++) {
          for (let i = 0; i < pixelBlockSize; i++) {
            const px = x + i;
            const py = y + j;

            // Ensure pixel is within result image bounds
            if (px < resultImage.width && py < resultImage.height) {
              const index = (py * resultImage.width + px) * 4;
              resultImage.pixels[index] = avgR;
              resultImage.pixels[index + 1] = avgG;
              resultImage.pixels[index + 2] = avgB;
              resultImage.pixels[index + 3] = 255; // Full opacity
            }
          }
        }
      }
    }

    // Apply the changes to result image
    resultImage.updatePixels();
    return resultImage;
  }


  // --- PRIVATE HELPER FUNCTIONS ---
  _rgbToHsv(r, g, b) {
    // Convert RGB values (0–255) to HSV color space
    r /= 255; g /= 255; b /= 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;
    let d = max - min;
    s = max == 0 ? 0 : d / max;

    if (max == min) {
      h = 0; // No hue if grayscale
    } else {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return [h * 360, s, v]; // Hue in degrees, saturation/value as ratio
  }

  _rgbToYcbcr(r, g, b) {
    // Convert RGB to YCbCr color space (used in compression/video processing)
    const y  = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    return [y, cb, cr];
  }
 // --- NEW METHODS FOR LIVE MASK FILTER ---

  // This is the main function that will be called from sketch.js
  // It draws the video and the mask overlay into a buffer.
  applyLiveMaskFilter(video, detections, controls) {
    let buffer = createGraphics(video.width, video.height);
    
    // Draw mirrored video background
    buffer.push();
    buffer.translate(buffer.width, 0);
    buffer.scale(-1, 1);
    buffer.image(video, 0, 0);
    buffer.pop();

    if (detections.length > 0) {
        // We need to mirror the landmark points as well
        const mirroredDetections = this._mirrorDetections(detections, video.width);
        
        const c = this.applySharedStyles(controls);
        buffer.drawingContext.shadowBlur = c.shadowBlur;
        buffer.drawingContext.shadowColor = c.shadowColor;

        // --- FIX: APPLY COLOR & OPACITY ---
        // The p5.Color object 'c.p5Color' contains the correct opacity.
        // We set the fill and stroke for the buffer here, so all subsequent
        // drawing commands will use it.
        buffer.fill(c.p5Color);
        buffer.stroke(c.p5Color);
        // --- END OF FIX ---

        for (let i = 0; i < mirroredDetections.length; i++) {
            const landmarks = mirroredDetections[i].landmarks.positions;
            
            switch (controls.maskType) {
                case 'visor': this.drawVisorMask(landmarks, controls.animatedShape, buffer); break;
                case 'tribal': this.drawTribalMask(landmarks, controls.animatedShape, buffer); break;
                case 'glasses': this.drawGlassesMask(landmarks, controls.animatedShape, buffer); break;
                case 'cateye': this.drawCatEyeMask(landmarks, controls.animatedShape, buffer); break;
            }
        }
    }
    return buffer;
  }

 // Helper to flip detection points horizontally
 _mirrorDetections(detections, videoWidth) {
    // This is a robust, manual deep copy. It creates a new array and new objects,
    // ensuring the original data is never modified (which prevents flickering)
    // and that the complex ml5 object is copied correctly (which prevents crashes).
    const mirrored = detections.map(face => {
      // Check if the necessary data exists before trying to access it
      if (!face.landmarks || !face.landmarks.positions) {
        // If no landmarks are found for this face, return a valid but empty structure
        return { landmarks: { positions: [] } };
      }

      // Create a new face object containing a new landmarks object
      return {
        landmarks: {
          // Create a new 'positions' array by mapping over the original
          positions: face.landmarks.positions.map(p => ({
            // For each point, create a new point object with the mirrored x-coordinate
            _x: videoWidth - p._x,
            _y: p._y
          }))
        }
        // We only copy the data we need, avoiding the complex parts that cause errors.
      };
    });

    return mirrored;
  }
  applySharedStyles(controls) {
    const userColor = controls.color;
    const userOpacity = controls.opacity;
    const userGlow = controls.glow;
    const c = color(userColor);
    c.setAlpha(userOpacity);

    const totalGlow = lerp(userGlow, userGlow * 3.0, controls.animatedGlow);
    return {
        p5Color: c,
        shadowBlur: totalGlow,
        shadowColor: userColor
    };
  }
  
  // The original mask drawing functions, adapted to draw on a buffer
  drawVisorMask(landmarks, animatedShape, buffer) {
    // Redundant styling removed. Now it just draws.
    buffer.noStroke();
    buffer.beginShape();
    const smileOffset = lerp(0, 8, animatedShape);
    for (let j = 17; j <= 26; j++) buffer.vertex(landmarks[j]._x, landmarks[j]._y);
    for (let j = 16; j >= 0; j--) buffer.vertex(landmarks[j]._x, landmarks[j]._y + smileOffset);
    buffer.endShape(CLOSE);
    buffer.drawingContext.shadowBlur = 0;
  }

  drawTribalMask(landmarks, animatedShape, buffer) {
    // Styling handled externally; function only draws shape.
    buffer.noFill();
    buffer.strokeWeight(6);
    const smileOffset = lerp(0, 30, animatedShape);
    buffer.line(landmarks[27]._x, landmarks[27]._y, landmarks[28]._x, landmarks[28]._y);
    const leftOuterEye = landmarks[36];
    const rightOuterEye = landmarks[45];
    buffer.line(leftOuterEye._x, leftOuterEye._y + 5, leftOuterEye._x, leftOuterEye._y + 25 + smileOffset);
    buffer.line(rightOuterEye._x, rightOuterEye._y + 5, rightOuterEye._x, rightOuterEye._y + 25 + smileOffset);
    buffer.drawingContext.shadowBlur = 0;
  }

  drawGlassesMask(landmarks, animatedShape, buffer) {
    // Redundant styling removed.
    buffer.noFill();
    buffer.strokeWeight(2); // Increased from 2 for better visibility
    const leftEyeCenter = this._getCenterPoint(landmarks, 36, 39);
    const rightEyeCenter = this._getCenterPoint(landmarks, 42, 45);
    const baseRadius = dist(landmarks[36]._x, landmarks[36]._y, landmarks[39]._x, landmarks[39]._y) * 1.8;
    const animatedRadius = lerp(baseRadius, baseRadius * 1.3, animatedShape);
    buffer.circle(leftEyeCenter.x, leftEyeCenter.y, animatedRadius);
    buffer.circle(rightEyeCenter.x, rightEyeCenter.y, animatedRadius);
    buffer.line(landmarks[39]._x, landmarks[39]._y, landmarks[42]._x, landmarks[42]._y);
    buffer.drawingContext.shadowBlur = 0;
  }

 drawCatEyeMask(landmarks, animatedShape, buffer) {
    // Redundant styling removed.
    buffer.noStroke();

    const wingExtension = lerp(30, 60, animatedShape);
    // Make the wing slant upwards for a classic cat-eye look
    const wingSlant = wingExtension * 0.5;

    // SHAPE 1: Person's Right Eye (which appears on the LEFT of the canvas)
    buffer.beginShape();
    for (let i = 45; i >= 42; i--) buffer.vertex(landmarks[i]._x, landmarks[i]._y);
    for (let i = 22; i <= 26; i++) buffer.vertex(landmarks[i]._x, landmarks[i]._y);
    buffer.vertex(landmarks[45]._x - wingExtension, landmarks[45]._y - wingSlant);
    buffer.endShape(CLOSE);

    // SHAPE 2: Person's Left Eye (which appears on the RIGHT of the canvas)
    buffer.beginShape();
    for (let i = 36; i <= 39; i++) buffer.vertex(landmarks[i]._x, landmarks[i]._y);
    for (let i = 21; i >= 17; i--) buffer.vertex(landmarks[i]._x, landmarks[i]._y);
    buffer.vertex(landmarks[36]._x + wingExtension, landmarks[36]._y - wingSlant);
    buffer.endShape(CLOSE);

    buffer.drawingContext.shadowBlur = 0;
  }

  _getCenterPoint(landmarks, index1, index2) {
      const p1 = landmarks[index1];
      const p2 = landmarks[index2];
      return { x: (p1._x + p2._x) / 2, y: (p1._y + p2._y) / 2 };
  }
    // --- KALEIDOSCOPE FILTER ---

  applyKaleidoscopeFilter(sourceVideo) {
      let buffer = createGraphics(sourceVideo.width, sourceVideo.height);
      
      const symmetry = 6;
      const angle = 360 / symmetry;
      
      // Create a slightly larger angle for the clipping shape.
      // This makes each wedge overlap its neighbor, hiding the rendering gaps.
      const drawAngle = angle + 1; 

      buffer.angleMode(DEGREES);
      buffer.translate(buffer.width / 2, buffer.height / 2);

      for (let i = 0; i < symmetry; i++) {
          // We still rotate by the EXACT angle to maintain perfect symmetry.
          buffer.rotate(angle); 
          
          if (i % 2 == 1) {
              buffer.scale(1, -1);
          }
          
          buffer.push();
          buffer.beginClip();
          const radius = buffer.width * 1.5; // A large radius ensures we cover the corners.
          
          // We use the slightly larger 'drawAngle' ONLY for creating the clipping triangle.
          buffer.triangle(0, 0, radius, 0, radius * cos(drawAngle), radius * sin(drawAngle));
          buffer.endClip();

          buffer.image(sourceVideo, -buffer.width / 2, -buffer.height / 2, buffer.width, buffer.height);
          buffer.pop(); // This restores the context and, importantly, removes the clip for the next loop.

          if (i % 2 == 1) {
              buffer.scale(1, -1);
          }
      }
      return buffer;
  }
    applyPointillismFilter(sourceVideo) {
      let buffer = createGraphics(sourceVideo.width, sourceVideo.height);
      
      // We use a smaller step size because the canvas cell is smaller
      const stepSize = 8;

      // Set up the drawing environment for the buffer
      buffer.colorMode(HSB, 360, 100, 100);
      buffer.noStroke();
      buffer.background(0, 0, 100); // A white background in HSB color mode

      // Load the video's pixels to be read
      sourceVideo.loadPixels();

      // Guard against running on an empty pixels array
      if (sourceVideo.pixels.length === 0) {
          return buffer;
      }

      // Iterate over the video on a grid
      for (let y = 0; y < sourceVideo.height; y += stepSize) {
          for (let x = 0; x < sourceVideo.width; x += stepSize) {
              const index = (x + y * sourceVideo.width) * 4;
              
              // Get the color of the pixel
              const r = sourceVideo.pixels[index];
              const g = sourceVideo.pixels[index + 1];
              const b = sourceVideo.pixels[index + 2];
              const c = color(r, g, b); // p5.color can be used globally

              // Get the brightness and map it to a diameter
              const brightnessValue = brightness(c);
              const diameter = map(brightnessValue, 0, 100, 1, stepSize * 1.6);
              
              // Draw the circle onto the buffer
              buffer.fill(c);
              buffer.circle(x, y, diameter);
          }
      }
      return buffer;
  }
}