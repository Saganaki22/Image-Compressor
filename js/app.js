// ===== State Management =====
const state = {
    mode: 'single',
    originalImage: null,
    compressedImage: null,
    originalFile: null,
    currentSettings: {
        rotate: 0,
        resize: {
            enabled: false,
            width: null,
            height: null,
            method: 'high',
            maintainAspect: true
        },
        encoder: {
            format: 'jpeg',
            jpeg: { quality: 75, progressive: true, optimize: false },
            png: { quality: 100 },
            webp: { quality: 75, lossless: false },
            avif: { quality: 50 }
        }
    },
    batchFiles: [],
    batchResults: [],
    useWorker: true, // Enable Web Worker for better performance
    worker: null
};

// ===== Web Worker Setup =====
function initWorker() {
    if (state.useWorker && typeof Worker !== 'undefined') {
        try {
            state.worker = new Worker('workers/compress-worker.js');
            console.log('Web Worker initialized successfully');
        } catch (error) {
            console.warn('Failed to initialize Web Worker:', error);
            state.useWorker = false;
        }
    }
}

function terminateWorker() {
    if (state.worker) {
        state.worker.terminate();
        state.worker = null;
    }
}

// ===== Utility Functions =====
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ===== Image Processing Functions =====
function rotateImage(img, degrees) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (degrees === 90 || degrees === 270) {
        canvas.width = img.height;
        canvas.height = img.width;
    } else {
        canvas.width = img.width;
        canvas.height = img.height;
    }

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((degrees * Math.PI) / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);

    return canvas;
}

function resizeImage(img, settings) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    let targetWidth = settings.width || img.width;
    let targetHeight = settings.height || img.height;

    if (settings.maintainAspect) {
        if (settings.width && !settings.height) {
            targetHeight = Math.round((img.height / img.width) * targetWidth);
        } else if (settings.height && !settings.width) {
            targetWidth = Math.round((img.width / img.height) * targetHeight);
        }
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // Set image smoothing based on method
    switch (settings.method) {
        case 'pixelated':
            ctx.imageSmoothingEnabled = false;
            break;
        case 'low':
            ctx.imageSmoothingQuality = 'low';
            break;
        case 'medium':
            ctx.imageSmoothingQuality = 'medium';
            break;
        case 'high':
        default:
            ctx.imageSmoothingQuality = 'high';
            break;
    }

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    return canvas;
}

async function processImage(img, settings) {
    let currentCanvas = document.createElement('canvas');
    let currentSource = img;

    // Apply rotation
    if (settings.rotate && settings.rotate !== 0) {
        currentCanvas = rotateImage(currentSource, settings.rotate);
        currentSource = currentCanvas;
    }

    // Apply resize
    if (settings.resize.enabled && (settings.resize.width || settings.resize.height)) {
        currentCanvas = resizeImage(currentSource, settings.resize);
    } else if (!settings.rotate || settings.rotate === 0) {
        // No rotation and no resize - just copy the image
        currentCanvas.width = img.width;
        currentCanvas.height = img.height;
        const ctx = currentCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
    }
    // If rotated but not resized, currentCanvas already has the rotated image

    return currentCanvas;
}

async function encodeImage(canvas, settings) {
    const format = settings.encoder.format;
    const options = settings.encoder[format];

    return new Promise((resolve, reject) => {
        let mimeType, quality;

        switch (format) {
            case 'jpeg':
                mimeType = 'image/jpeg';
                quality = options.quality / 100;
                break;
            case 'png':
                mimeType = 'image/png';
                quality = options.quality / 100;
                break;
            case 'webp':
                mimeType = 'image/webp';
                quality = options.lossless ? 1 : options.quality / 100;
                break;
            case 'avif':
                // Note: AVIF support varies by browser
                mimeType = 'image/avif';
                quality = options.quality / 100;
                break;
            default:
                mimeType = 'image/jpeg';
                quality = 0.75;
        }

        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error('Failed to encode image'));
            }
        }, mimeType, quality);
    });
}

// ===== Image Comparison Slider =====
function initComparisonSlider() {
    const sliderWrapper = document.querySelector('.slider-wrapper');
    const sliderDivider = document.getElementById('slider-divider');
    const comparisonCanvas = document.getElementById('comparison-canvas');

    if (!sliderWrapper || !sliderDivider || !comparisonCanvas) return;

    let isDragging = false;

    function updateSlider(x) {
        const rect = sliderWrapper.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
        sliderDivider.style.left = `${percent * 100}%`;
        drawComparison(percent);
    }

    function drawComparison(percent) {
        if (!state.originalImage || !state.compressedImage) return;

        const ctx = comparisonCanvas.getContext('2d');
        const width = comparisonCanvas.width;
        const height = comparisonCanvas.height;

        ctx.clearRect(0, 0, width, height);

        // Draw original on the left
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, width * percent, height);
        ctx.clip();
        ctx.drawImage(state.originalImage, 0, 0, width, height);
        ctx.restore();

        // Draw compressed on the right
        ctx.save();
        ctx.beginPath();
        ctx.rect(width * percent, 0, width * (1 - percent), height);
        ctx.clip();
        ctx.drawImage(state.compressedImage, 0, 0, width, height);
        ctx.restore();
    }

    sliderWrapper.addEventListener('mousedown', (e) => {
        isDragging = true;
        updateSlider(e.clientX);
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            updateSlider(e.clientX);
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    sliderWrapper.addEventListener('touchstart', (e) => {
        isDragging = true;
        updateSlider(e.touches[0].clientX);
    });

    document.addEventListener('touchmove', (e) => {
        if (isDragging) {
            updateSlider(e.touches[0].clientX);
        }
    });

    document.addEventListener('touchend', () => {
        isDragging = false;
    });
}

// ===== Single Image Mode =====
async function handleImageUpload(file) {
    if (!file || !file.type.startsWith('image/')) {
        showToast('Please select a valid image file', 'error');
        return;
    }

    try {
        state.originalFile = file;
        const img = await loadImage(file);
        state.originalImage = img;

        // Show comparison view
        document.getElementById('drop-zone').classList.add('hidden');
        document.getElementById('comparison-view').classList.remove('hidden');

        // Display original image
        const originalCanvas = document.getElementById('original-canvas');
        originalCanvas.width = img.width;
        originalCanvas.height = img.height;
        const originalCtx = originalCanvas.getContext('2d');
        originalCtx.drawImage(img, 0, 0);

        // Update original info
        document.getElementById('original-size').textContent = formatFileSize(file.size);
        document.getElementById('original-dimensions').textContent = `${img.width} × ${img.height}`;

        // Process and compress image
        await compressImage();

        showToast('Image loaded successfully', 'success');
    } catch (error) {
        console.error('Error loading image:', error);
        showToast('Error loading image', 'error');
    }
}

async function compressImage() {
    if (!state.originalImage) return;

    try {
        // Process image (rotate, resize)
        const processedCanvas = await processImage(state.originalImage, state.currentSettings);

        // Encode image
        const blob = await encodeImage(processedCanvas, state.currentSettings);

        // Create image from blob
        const compressedImg = await loadImage(new File([blob], 'compressed', { type: blob.type }));
        state.compressedImage = compressedImg;

        // Display compressed image
        const compressedCanvas = document.getElementById('compressed-canvas');
        compressedCanvas.width = compressedImg.width;
        compressedCanvas.height = compressedImg.height;
        const compressedCtx = compressedCanvas.getContext('2d');
        compressedCtx.drawImage(compressedImg, 0, 0);

        // Update compressed info
        const compressedSize = blob.size;
        const originalSize = state.originalFile.size;
        const ratio = Math.round((1 - compressedSize / originalSize) * 100);

        document.getElementById('compressed-size').textContent = formatFileSize(compressedSize);
        document.getElementById('compressed-dimensions').textContent = `${compressedImg.width} × ${compressedImg.height}`;
        document.getElementById('compression-ratio').textContent = `${ratio}% smaller`;

        // Setup comparison slider - maintain aspect ratio
        const comparisonCanvas = document.getElementById('comparison-canvas');

        // Use the compressed image dimensions (which may be rotated/resized)
        comparisonCanvas.width = compressedImg.width;
        comparisonCanvas.height = compressedImg.height;

        // Initial draw (50/50 split)
        const ctx = comparisonCanvas.getContext('2d');
        const width = comparisonCanvas.width;
        const height = comparisonCanvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw original on left half
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, width * 0.5, height);
        ctx.clip();
        ctx.drawImage(state.originalImage, 0, 0, width, height);
        ctx.restore();

        // Draw compressed on right half
        ctx.save();
        ctx.beginPath();
        ctx.rect(width * 0.5, 0, width * 0.5, height);
        ctx.clip();
        ctx.drawImage(compressedImg, 0, 0, width, height);
        ctx.restore();

        // Store blob for download
        state.compressedBlob = blob;

    } catch (error) {
        console.error('Error compressing image:', error);
        showToast('Error compressing image', 'error');
    }
}

// ===== Batch Mode =====
function handleBatchFilesSelected(files) {
    state.batchFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

    if (state.batchFiles.length === 0) {
        showToast('No valid image files selected', 'error');
        return;
    }

    // Show settings and file list
    document.querySelector('.batch-drop-zone').style.display = 'none';
    document.getElementById('batch-settings').classList.remove('hidden');
    document.getElementById('batch-file-list').classList.remove('hidden');

    // Update file count
    document.getElementById('file-count').textContent = state.batchFiles.length;

    // Display file list
    const fileListContainer = document.getElementById('file-list-container');
    fileListContainer.innerHTML = '';

    state.batchFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <div class="file-icon">${index + 1}</div>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
            </div>
            <div class="file-status pending" data-index="${index}">Pending</div>
        `;
        fileListContainer.appendChild(fileItem);
    });

    showToast(`${state.batchFiles.length} files selected`, 'success');
}

async function startBatchConversion() {
    const format = document.getElementById('batch-format').value;
    const quality = parseInt(document.getElementById('batch-quality').value);
    const resizeEnabled = document.getElementById('batch-resize').checked;
    const maxWidth = parseInt(document.getElementById('batch-max-width').value) || null;

    // Hide settings, show progress
    document.getElementById('batch-settings').classList.add('hidden');
    document.getElementById('batch-progress').classList.remove('hidden');

    state.batchResults = [];
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;

    const progressBar = document.getElementById('progress-bar');
    const progressCount = document.getElementById('progress-count');
    const currentFileEl = document.getElementById('current-file');

    for (let i = 0; i < state.batchFiles.length; i++) {
        const file = state.batchFiles[i];

        // Update progress
        progressCount.textContent = `${i + 1} / ${state.batchFiles.length}`;
        currentFileEl.textContent = file.name;
        progressBar.style.width = `${((i + 1) / state.batchFiles.length) * 100}%`;

        // Update file status
        const statusEl = document.querySelector(`.file-status[data-index="${i}"]`);
        statusEl.textContent = 'Processing';
        statusEl.className = 'file-status processing';

        try {
            // Load image
            const img = await loadImage(file);

            // Create settings
            const settings = {
                rotate: 0,
                resize: {
                    enabled: resizeEnabled,
                    width: maxWidth,
                    height: null,
                    method: 'high',
                    maintainAspect: true
                },
                encoder: {
                    format: format,
                    jpeg: { quality: quality, progressive: true, optimize: false },
                    png: { quality: quality },
                    webp: { quality: quality, lossless: false },
                    avif: { quality: quality }
                }
            };

            // Process and encode
            const processedCanvas = await processImage(img, settings);
            const blob = await encodeImage(processedCanvas, settings);

            // Store result
            const extension = format === 'jpeg' ? 'jpg' : format;
            const newFileName = file.name.replace(/\.[^/.]+$/, `.${extension}`);

            state.batchResults.push({
                name: newFileName,
                blob: blob,
                originalSize: file.size,
                compressedSize: blob.size
            });

            totalOriginalSize += file.size;
            totalCompressedSize += blob.size;

            // Update status
            statusEl.textContent = 'Completed';
            statusEl.className = 'file-status completed';

        } catch (error) {
            console.error(`Error processing ${file.name}:`, error);
            statusEl.textContent = 'Failed';
            statusEl.className = 'file-status error';
        }

        // Small delay to show animation
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Update totals
    const savedSize = totalOriginalSize - totalCompressedSize;
    const savedPercent = Math.round((savedSize / totalOriginalSize) * 100);

    document.getElementById('total-original-size').textContent = formatFileSize(totalOriginalSize);
    document.getElementById('total-compressed-size').textContent = formatFileSize(totalCompressedSize);
    document.getElementById('total-saved').textContent = `${formatFileSize(savedSize)} (${savedPercent}%)`;

    // Show download button
    document.getElementById('download-all-btn').classList.remove('hidden');

    showToast('Batch conversion completed!', 'success');
}

async function downloadAllAsZip() {
    if (!window.JSZip) {
        // Fallback: download files individually if JSZip is not loaded
        showToast('Downloading files individually...', 'success');
        state.batchResults.forEach((result, index) => {
            setTimeout(() => {
                const url = URL.createObjectURL(result.blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = result.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, index * 100);
        });
        return;
    }

    try {
        showToast('Creating ZIP archive...', 'success');

        const zip = new JSZip();

        // Add all compressed images to ZIP
        state.batchResults.forEach((result) => {
            zip.file(result.name, result.blob);
        });

        // Generate ZIP file
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        // Download the ZIP
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `compressed-images-${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(`ZIP downloaded with ${state.batchResults.length} images!`, 'success');
    } catch (error) {
        console.error('Error creating ZIP:', error);
        showToast('Error creating ZIP file', 'error');
    }
}

function resetBatch() {
    state.batchFiles = [];
    state.batchResults = [];

    document.querySelector('.batch-drop-zone').style.display = 'block';
    document.getElementById('batch-settings').classList.add('hidden');
    document.getElementById('batch-progress').classList.add('hidden');
    document.getElementById('batch-file-list').classList.add('hidden');
    document.getElementById('download-all-btn').classList.add('hidden');

    document.getElementById('progress-bar').style.width = '0%';
}

// ===== Event Listeners =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    console.log('Single mode element:', document.getElementById('single-mode'));
    console.log('Batch mode element:', document.getElementById('batch-mode'));
    console.log('Batch drop zone:', document.querySelector('.batch-drop-zone'));

    // Initialize Web Worker for batch processing
    // Note: Worker is optional - current browser APIs are already async
    // Uncomment below to enable worker-based processing for very large batches
    // initWorker();

    // Mode switching
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            console.log('Switching to mode:', mode);
            state.mode = mode;

            // Update active button
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Switch mode
            document.querySelectorAll('.mode-container').forEach(container => {
                container.classList.remove('active');
                console.log('Removed active from:', container.id);
            });

            const targetMode = document.getElementById(`${mode}-mode`);
            if (targetMode) {
                targetMode.classList.add('active');
                console.log('Added active to:', `${mode}-mode`);
            } else {
                console.error('Could not find element:', `${mode}-mode`);
            }
        });
    });

    // Single image mode - File input
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleImageUpload(e.target.files[0]);
        }
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleImageUpload(e.dataTransfer.files[0]);
        }
    });

    // Reset button
    document.getElementById('reset-btn').addEventListener('click', () => {
        state.originalImage = null;
        state.compressedImage = null;
        state.originalFile = null;

        document.getElementById('drop-zone').classList.remove('hidden');
        document.getElementById('comparison-view').classList.add('hidden');

        fileInput.value = '';
    });

    // Download button
    document.getElementById('download-btn').addEventListener('click', () => {
        if (state.compressedBlob && state.originalFile) {
            const format = state.currentSettings.encoder.format;
            const extension = format === 'jpeg' ? 'jpg' : format;

            // Get original filename without extension
            const originalName = state.originalFile.name.replace(/\.[^/.]+$/, '');

            // Create new filename: originalname-format.ext
            const fileName = `${originalName}-${format}.${extension}`;

            const url = URL.createObjectURL(state.compressedBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showToast('Image downloaded!', 'success');
        }
    });

    // Rotate buttons
    document.querySelectorAll('[data-rotate]').forEach(btn => {
        btn.addEventListener('click', () => {
            const rotation = parseInt(btn.dataset.rotate);
            state.currentSettings.rotate = rotation;

            document.querySelectorAll('[data-rotate]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (state.originalImage) {
                compressImage();
            }
        });
    });

    // Resize options
    document.getElementById('resize-enabled').addEventListener('change', (e) => {
        const enabled = e.target.checked;
        state.currentSettings.resize.enabled = enabled;
        document.getElementById('resize-options').classList.toggle('hidden', !enabled);

        if (state.originalImage) {
            compressImage();
        }
    });

    document.getElementById('resize-width').addEventListener('input', (e) => {
        state.currentSettings.resize.width = e.target.value ? parseInt(e.target.value) : null;
        if (state.originalImage) {
            compressImage();
        }
    });

    document.getElementById('resize-height').addEventListener('input', (e) => {
        state.currentSettings.resize.height = e.target.value ? parseInt(e.target.value) : null;
        if (state.originalImage) {
            compressImage();
        }
    });

    document.getElementById('resize-method').addEventListener('change', (e) => {
        state.currentSettings.resize.method = e.target.value;
        if (state.originalImage) {
            compressImage();
        }
    });

    document.getElementById('resize-maintain-aspect').addEventListener('change', (e) => {
        state.currentSettings.resize.maintainAspect = e.target.checked;
        if (state.originalImage) {
            compressImage();
        }
    });

    // Encoder format
    document.getElementById('encoder-format').addEventListener('change', (e) => {
        const format = e.target.value;
        state.currentSettings.encoder.format = format;

        // Hide all encoder options
        document.querySelectorAll('.encoder-options').forEach(el => el.classList.add('hidden'));

        // Show selected encoder options
        document.getElementById(`${format}-options`).classList.remove('hidden');

        if (state.originalImage) {
            compressImage();
        }
    });

    // JPEG options
    document.getElementById('jpeg-quality').addEventListener('input', (e) => {
        const quality = parseInt(e.target.value);
        state.currentSettings.encoder.jpeg.quality = quality;
        document.getElementById('jpeg-quality-value').textContent = quality;
        if (state.originalImage) compressImage();
    });

    document.getElementById('jpeg-progressive').addEventListener('change', (e) => {
        state.currentSettings.encoder.jpeg.progressive = e.target.checked;
        if (state.originalImage) compressImage();
    });

    document.getElementById('jpeg-optimize').addEventListener('change', (e) => {
        state.currentSettings.encoder.jpeg.optimize = e.target.checked;
        if (state.originalImage) compressImage();
    });

    // PNG options
    document.getElementById('png-quality').addEventListener('input', (e) => {
        const quality = parseInt(e.target.value);
        state.currentSettings.encoder.png.quality = quality;
        document.getElementById('png-quality-value').textContent = quality;
        if (state.originalImage) compressImage();
    });

    // WebP options
    document.getElementById('webp-quality').addEventListener('input', (e) => {
        const quality = parseInt(e.target.value);
        state.currentSettings.encoder.webp.quality = quality;
        document.getElementById('webp-quality-value').textContent = quality;
        if (state.originalImage) compressImage();
    });

    document.getElementById('webp-lossless').addEventListener('change', (e) => {
        state.currentSettings.encoder.webp.lossless = e.target.checked;
        if (state.originalImage) compressImage();
    });

    // AVIF options
    document.getElementById('avif-quality').addEventListener('input', (e) => {
        const quality = parseInt(e.target.value);
        state.currentSettings.encoder.avif.quality = quality;
        document.getElementById('avif-quality-value').textContent = quality;
        if (state.originalImage) compressImage();
    });

    // Initialize comparison slider
    initComparisonSlider();

    // ===== Batch Mode Event Listeners =====
    const batchDropZone = document.querySelector('.batch-drop-zone');
    const batchFileInput = document.getElementById('batch-file-input');
    const batchFolderInput = document.getElementById('batch-folder-input');

    document.getElementById('select-files-btn').addEventListener('click', () => {
        console.log('Select files button clicked');
        batchFileInput.click();
    });

    document.getElementById('select-folder-btn').addEventListener('click', () => {
        console.log('Select folder button clicked');
        batchFolderInput.click();
    });

    batchFileInput.addEventListener('change', (e) => {
        console.log('Batch files selected:', e.target.files.length);
        if (e.target.files.length > 0) {
            handleBatchFilesSelected(e.target.files);
        } else {
            showToast('No files selected', 'warning');
        }
    });

    batchFolderInput.addEventListener('change', (e) => {
        console.log('Batch folder selected:', e.target.files.length);
        if (e.target.files.length > 0) {
            handleBatchFilesSelected(e.target.files);
        } else {
            showToast('No files selected', 'warning');
        }
    });

    // Batch drag and drop
    batchDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        batchDropZone.classList.add('drag-over');
    });

    batchDropZone.addEventListener('dragleave', () => {
        batchDropZone.classList.remove('drag-over');
    });

    batchDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        batchDropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleBatchFilesSelected(e.dataTransfer.files);
        }
    });

    // Batch settings
    document.getElementById('batch-quality').addEventListener('input', (e) => {
        document.getElementById('batch-quality-value').textContent = e.target.value;
    });

    document.getElementById('batch-resize').addEventListener('change', (e) => {
        const enabled = e.target.checked;
        document.getElementById('batch-max-width').disabled = !enabled;
    });

    document.getElementById('start-batch-btn').addEventListener('click', startBatchConversion);
    document.getElementById('download-all-btn').addEventListener('click', downloadAllAsZip);
    document.getElementById('reset-batch-btn').addEventListener('click', resetBatch);
});
