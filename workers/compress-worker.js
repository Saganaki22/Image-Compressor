// ===== Image Compression Web Worker =====
// This worker handles heavy image processing off the main thread
// to keep the UI responsive during batch conversions

// ===== Helper Functions =====
function rotateImage(imageData, degrees, originalWidth, originalHeight) {
    const canvas = new OffscreenCanvas(
        degrees === 90 || degrees === 270 ? originalHeight : originalWidth,
        degrees === 90 || degrees === 270 ? originalWidth : originalHeight
    );
    const ctx = canvas.getContext('2d');

    // Create ImageBitmap from ImageData
    return createImageBitmap(imageData).then(bitmap => {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((degrees * Math.PI) / 180);
        ctx.drawImage(bitmap, -originalWidth / 2, -originalHeight / 2);

        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    });
}

function resizeImage(imageData, settings, originalWidth, originalHeight) {
    let targetWidth = settings.width || originalWidth;
    let targetHeight = settings.height || originalHeight;

    if (settings.maintainAspect) {
        if (settings.width && !settings.height) {
            targetHeight = Math.round((originalHeight / originalWidth) * targetWidth);
        } else if (settings.height && !settings.width) {
            targetWidth = Math.round((originalWidth / originalHeight) * targetHeight);
        }
    }

    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');

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

    return createImageBitmap(imageData).then(bitmap => {
        ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
        return ctx.getImageData(0, 0, targetWidth, targetHeight);
    });
}

async function processAndEncode(imageData, settings, originalWidth, originalHeight) {
    let currentImageData = imageData;
    let currentWidth = originalWidth;
    let currentHeight = originalHeight;

    // Apply rotation
    if (settings.rotate && settings.rotate !== 0) {
        currentImageData = await rotateImage(currentImageData, settings.rotate, currentWidth, currentHeight);
        if (settings.rotate === 90 || settings.rotate === 270) {
            [currentWidth, currentHeight] = [currentHeight, currentWidth];
        }
    }

    // Apply resize
    if (settings.resize.enabled && (settings.resize.width || settings.resize.height)) {
        currentImageData = await resizeImage(currentImageData, settings.resize, currentWidth, currentHeight);
        currentWidth = currentImageData.width;
        currentHeight = currentImageData.height;
    }

    // Create canvas for encoding
    const canvas = new OffscreenCanvas(currentWidth, currentHeight);
    const ctx = canvas.getContext('2d');
    ctx.putImageData(currentImageData, 0, 0);

    // Encode to blob
    const format = settings.encoder.format;
    const options = settings.encoder[format];

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
            mimeType = 'image/avif';
            quality = options.quality / 100;
            break;
        default:
            mimeType = 'image/jpeg';
            quality = 0.75;
    }

    const blob = await canvas.convertToBlob({ type: mimeType, quality });
    return blob;
}

// ===== Message Handler =====
self.addEventListener('message', async (event) => {
    const { type, data } = event.data;

    try {
        if (type === 'compress') {
            const { imageData, settings, originalWidth, originalHeight, fileName } = data;

            // Process and compress the image
            const blob = await processAndEncode(imageData, settings, originalWidth, originalHeight);

            // Send back the compressed blob
            self.postMessage({
                type: 'success',
                data: {
                    blob,
                    fileName,
                    width: blob.width || originalWidth,
                    height: blob.height || originalHeight
                }
            });
        }
    } catch (error) {
        self.postMessage({
            type: 'error',
            error: error.message
        });
    }
});
