# Webcam Image Processing Toolkit

An interactive browser-based image processing application built with **JavaScript, p5.js and ml5.js** for the **CM2030 Graphics Programming** module in the University of London BSc Computer Science programme.

The application captures webcam frames and applies real-time image-processing operations, colour-space transformations, thresholding, face-region filters and several creative visual extensions.

## Features

- Webcam capture and 160×120 image processing pipeline
- Grayscale conversion with a 20% brightness increase and intensity clamping
- Red, green and blue channel separation
- Adjustable thresholding for each RGB channel
- RGB → HSV colour-space conversion
- RGB → YCbCr colour-space conversion
- Thresholding of converted colour spaces
- Face detection and bounding-box rendering
- Face-region grayscale, blur, colour conversion and pixelation
- Clickable grid with enlarged/zoomed previews
- Chroma-key background replacement
- Facial landmark visualisation
- Glitch-art effect
- ASCII-art rendering
- Water/ripple distortion
- Slit-scan effect
- Sobel edge detection
- Colour-palette extraction
- Smile-reactive live masks
- Kaleidoscope and pointillism-style effects

## Technologies

- JavaScript
- p5.js
- ml5.js / FaceMesh / FaceAPI
- HTML5
- CSS3
- Browser webcam APIs

## Project Structure

```text
.
├── index.html
├── sketch.js
├── FilterManager.js
├── GridManager.js
├── style.css
├── images/
├── libraries/
├── jsconfig.json
└── .gitignore
```

## Running Locally

Because webcam access is restricted on ordinary `file://` pages, run the project from a local web server.

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Allow camera permissions when prompted.

## Controls

- Use **Capture** to grab a webcam frame.
- Adjust the RGB and colour-space threshold sliders.
- Press **1–4** to switch the detected-face effect:
  1. Grayscale
  2. Blur
  3. Colour-space conversion
  4. Pixelation
- Click image cells to inspect them at a larger size.
- Use the live-mask controls to change mask type, colour, opacity and glow.

## Coursework Context

This repository is a cleaned portfolio version of a CM2030 Graphics Programming image-processing assignment. The original brief required webcam capture, grayscale/brightness processing, RGB channel splitting, thresholding, two colour-space conversions, face detection and face-specific privacy filters. The application also includes a substantial set of creative extensions beyond those core requirements.

## Author

**Abdullah Humayun**  
BSc Computer Science – University of London / Goldsmiths
