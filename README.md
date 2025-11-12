# Modern Lightweight Image Compression

A sleek, modern HTML/CSS/JS reimagining of the Squoosh image compressor with ultra-modern UI, dark theme, and advanced features.

## Features

### 🎨 Ultra-Modern UI
- **Dark Theme**: Beautiful dark color scheme with purple gradient accents
- **Grid Background**: Animated grid background with radial gradient overlay
- **Sleek Design**: Modern glassmorphism effects and smooth animations
- **Responsive**: Works perfectly on desktop and mobile devices

### 🖼️ Single Image Mode
- **Drag & Drop**: Simply drag an image onto the drop zone
- **Image Comparison Slider**: Interactive slider to compare original vs compressed images side-by-side
- **Real-time Preview**: See compression results instantly
- **Detailed Stats**: View file sizes, dimensions, and compression ratios

### 📦 Batch Conversion Mode
- **Multi-file Support**: Select multiple images at once
- **Folder Upload**: Upload entire folders of images
- **Live Progress Bar**: Real-time progress tracking with animated progress bar
- **Batch Statistics**: See total size savings across all files
- **Individual Status**: Track each file's conversion status

### ⚙️ Preprocessing Options
- **Rotate**: Rotate images by 0°, 90°, 180°, or 270°
- **Resize**: Optional image resizing with:
  - Custom width/height
  - Maintain aspect ratio option
  - Multiple quality methods (High, Medium, Low, Pixelated)

### 🔧 Encoder Support
- **JPEG (MozJPEG-style)**: Adjustable quality, progressive encoding options
- **PNG**: Browser-native PNG encoding with quality control
- **WebP**: Google's WebP format with lossy/lossless options
- **AVIF**: Modern AVIF format (browser support varies)

## How to Use

### Single Image Mode

1. **Upload an Image**:
   - Click the drop zone or drag an image onto it
   - Supported formats: JPEG, PNG, WebP, and more

2. **Compare Images**:
   - Use the interactive slider in the center to compare original vs compressed
   - Drag the slider left/right to see the difference

3. **Adjust Settings**:
   - **Preprocessing**: Rotate the image if needed
   - **Resize**: Enable resizing and set custom dimensions
   - **Encoder**: Choose format and adjust quality settings

4. **Download**:
   - Click "Download" to save the compressed image

### Batch Conversion Mode

1. **Select Files**:
   - Click "Select Files" for individual file selection
   - Click "Select Folder" to upload an entire folder
   - Or drag and drop multiple files/folders

2. **Configure Settings**:
   - Choose output format (JPEG, PNG, WebP, AVIF)
   - Set quality level (0-100)
   - Optional: Enable resize with max width

3. **Start Conversion**:
   - Click "Start Batch Conversion"
   - Watch the live progress bar
   - See individual file status updates

4. **Download Results**:
   - Click "Download All as ZIP" (files download individually)
   - View total size savings

## Technical Details

### Architecture
- **Pure HTML/CSS/JS**: No build tools or frameworks required
- **Browser APIs**: Uses native Canvas API for image processing
- **Client-side Processing**: All compression happens locally - no server uploads
- **Privacy First**: Your images never leave your device

### Image Processing
- **Canvas-based**: Leverages HTML5 Canvas for manipulation
- **Quality Settings**: Adjustable compression quality per format
- **Smart Resizing**: Multiple interpolation methods available
- **Real-time Updates**: Settings changes trigger instant recompression

### Performance
- **Efficient Processing**: Optimized canvas operations
- **Batch Queue**: Sequential processing with progress tracking
- **Memory Management**: Proper cleanup of canvas and blob objects

## Browser Support

- **Modern Browsers**: Chrome, Edge, Firefox, Safari (latest versions)
- **AVIF Support**: Limited to browsers that support AVIF encoding
- **WebP Support**: Widely supported in modern browsers
- **File System API**: Folder upload requires modern browser support

## Comparison with Original Squoosh

### Similarities
- Same core compression methods
- Browser-based processing (client-side)
- Multiple encoder support
- Image preprocessing options
- Privacy-focused approach

### Enhancements
- **Ultra-modern UI**: Sleek dark theme with grid backgrounds
- **Batch Mode**: Process multiple images at once
- **Live Progress**: Real-time progress tracking
- **Improved UX**: Smoother animations and interactions
- **Simpler Architecture**: Pure HTML/CSS/JS (no build process)

### Limitations
- **No WASM Encoders**: Uses browser APIs instead of optimized WASM codecs
- **Limited Formats**: Relies on browser support for encoding formats
- **No Advanced Features**: Simplified version without all original features
- **Quality Differences**: Browser encoding may differ from MozJPEG/OxiPNG

## Getting Started

Simply open `index.html` in a modern web browser. No installation or build process required!

```bash
# Option 1: Open directly
open index.html

# Option 2: Use a simple HTTP server
python -m http.server 8000
# Then visit http://localhost:8000

# Option 3: Use Node.js http-server
npx http-server
```

## Future Enhancements

Potential improvements for future versions:

1. **WebAssembly Integration** (would require Web Workers):
   - Integrate original Squoosh WASM codecs
   - MozJPEG for better JPEG compression
   - OxiPNG for optimized PNG output
   - Move heavy processing off main thread

2. **Advanced Features**:
   - Color quantization
   - Image filters
   - Batch export as ZIP (using JSZip)
   - Settings presets
   - Multi-threaded batch processing with Web Workers

3. **PWA Features**:
   - Service Worker for offline support
   - Install as standalone app
   - Share target integration

4. **Additional Encoders**:
   - JPEG XL support
   - QOI format
   - WebP2 (when stable)

## Acknowledgements

This project is inspired by and based on the incredible work of the Google Chrome Labs team on the original [Squoosh](https://github.com/GoogleChromeLabs/squoosh) project.

**Original Squoosh:**
- Repository: https://github.com/GoogleChromeLabs/squoosh
- Live App: https://squoosh.app
- Team: Google Chrome Labs

The original Squoosh pioneered client-side image compression with WebAssembly and set the standard for privacy-focused image optimization tools. This HTML version pays homage to that groundbreaking work while exploring a simplified, modern UI approach.

Special thanks to the Squoosh contributors for:
- Pioneering WASM-based image codecs in the browser
- Demonstrating best practices for client-side image processing
- Creating an open-source foundation for image compression tools
- Prioritizing user privacy with local processing

## License

This is a reimagined version of Google Chrome Labs' Squoosh project.
Original Squoosh: https://github.com/GoogleChromeLabs/squoosh

## Privacy

All image processing happens locally in your browser. No images are uploaded to any server. Your privacy is completely protected.
