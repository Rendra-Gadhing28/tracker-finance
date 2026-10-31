/**
 * OCR Helper Module for Receipt Text Extraction
 * Supports Native Shape Detection API (TextDetector) & Tesseract.js via CDN fallback
 */

const TESSERACT_CDN_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

let tesseractLoadingPromise = null;

/**
 * Loads Tesseract.js script dynamically from CDN if not already loaded.
 * @param {string} [src]
 * @returns {Promise<any>}
 */
export function loadTesseractScript(src = TESSERACT_CDN_URL) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window tidak tersedia di environment non-browser'));
  }

  if (window.Tesseract) {
    return Promise.resolve(window.Tesseract);
  }

  if (tesseractLoadingPromise) {
    return tesseractLoadingPromise;
  }

  tesseractLoadingPromise = new Promise((resolve, reject) => {
    // Check if script tag already exists in DOM
    let script = document.querySelector(`script[src="${src}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = src;
      script.async = true;
      document.head.appendChild(script);
    }

    const onLoad = () => {
      cleanup();
      if (window.Tesseract) {
        resolve(window.Tesseract);
      } else {
        tesseractLoadingPromise = null;
        reject(new Error('Tidak dapat memuat OCR otomatis. Silakan gunakan input teks.'));
      }
    };

    const onError = () => {
      cleanup();
      tesseractLoadingPromise = null;
      reject(new Error('Tidak dapat memuat OCR otomatis. Silakan gunakan input teks.'));
    };

    function cleanup() {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    }

    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
  });

  return tesseractLoadingPromise;
}

/**
 * Pre-processes receipt image using an in-memory Canvas:
 * - Scales resolution proportionally to optimal 900–1200px width
 * - Converts to grayscale (0.299*R + 0.587*G + 0.114*B)
 * - Contrast boost & binarization/thresholding based on mean luminance
 *
 * @param {any} imageSource
 * @returns {Promise<HTMLCanvasElement|any>}
 */
export async function preprocessReceiptImage(imageSource) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return imageSource;
  }

  try {
    let img;
    let cleanupUrl = null;

    if (typeof HTMLImageElement !== 'undefined' && imageSource instanceof HTMLImageElement && imageSource.complete) {
      img = imageSource;
    } else if (typeof HTMLCanvasElement !== 'undefined' && imageSource instanceof HTMLCanvasElement) {
      img = imageSource;
    } else if (typeof Blob !== 'undefined' && imageSource instanceof Blob) {
      const url = URL.createObjectURL(imageSource);
      cleanupUrl = url;
      img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = url;
      });
    } else if (typeof imageSource === 'string') {
      img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = imageSource;
      });
    } else {
      return imageSource;
    }

    const origW = img.naturalWidth || img.width || 0;
    const origH = img.naturalHeight || img.height || 0;

    if (origW === 0 || origH === 0) {
      if (cleanupUrl) URL.revokeObjectURL(cleanupUrl);
      return imageSource;
    }

    // Scale resolution proportionally to optimal width 900–1200px
    let targetW = origW;
    if (origW < 900) {
      targetW = 900;
    } else if (origW > 1200) {
      targetW = 1200;
    }
    const targetH = Math.round((origH / origW) * targetW);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      if (cleanupUrl) URL.revokeObjectURL(cleanupUrl);
      return imageSource;
    }

    ctx.drawImage(img, 0, 0, targetW, targetH);
    if (cleanupUrl) URL.revokeObjectURL(cleanupUrl);

    // Image processing: grayscale, contrast boost & binarization/thresholding
    const imgData = ctx.getImageData(0, 0, targetW, targetH);
    const data = imgData.data;

    let totalLum = 0;
    const totalPixels = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      totalLum += gray;
    }
    const meanLum = totalLum / totalPixels;
    // Pixels darker than threshold -> 0 (sharp black text), lighter -> 255 (white background)
    const threshold = Math.max(70, Math.min(190, meanLum * 0.95));

    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const val = gray < threshold ? 0 : 255;
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  } catch (err) {
    console.warn('Receipt image preprocessing failed, using original:', err);
    return imageSource;
  }
}

/**
 * Validates image input
 * @param {any} input
 * @returns {boolean}
 */
export function isValidImageInput(input) {
  if (!input) return false;
  if (typeof HTMLCanvasElement !== 'undefined' && input instanceof HTMLCanvasElement) return true;
  if (typeof Blob !== 'undefined' && input instanceof Blob) return true;
  if (typeof File !== 'undefined' && input instanceof File) return true;
  if (typeof input === 'string' && input.trim().length > 0) return true;
  return false;
}

/**
 * Recognizes text using Native window.TextDetector (Chrome / Android)
 * @param {File|Blob|string|HTMLCanvasElement} fileOrDataUrl
 * @returns {Promise<string|null>}
 */
export async function tryNativeTextDetector(fileOrDataUrl) {
  if (typeof window === 'undefined' || typeof window.TextDetector !== 'function') {
    return null;
  }

  try {
    const detector = new window.TextDetector();
    let imageSource = null;

    if (typeof HTMLCanvasElement !== 'undefined' && fileOrDataUrl instanceof HTMLCanvasElement) {
      imageSource = fileOrDataUrl;
    } else if (typeof createImageBitmap === 'function' && (fileOrDataUrl instanceof Blob || fileOrDataUrl instanceof File)) {
      imageSource = await createImageBitmap(fileOrDataUrl);
    } else if (typeof fileOrDataUrl === 'string') {
      imageSource = await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = fileOrDataUrl;
      });
    }

    if (!imageSource) return null;

    const detected = await detector.detect(imageSource);
    if (detected && detected.length > 0) {
      const texts = detected.map(d => d.rawValue || '').filter(Boolean);
      const combined = texts.join('\n').trim();
      if (combined) return combined;
    }
  } catch (err) {
    console.warn('Native TextDetector failed or not supported for this image, falling back to Tesseract:', err);
  }

  return null;
}

/**
 * Recognizes text using Tesseract.js loaded from CDN
 * @param {File|Blob|string|HTMLCanvasElement} fileOrDataUrl
 * @returns {Promise<string>}
 */
export async function tryTesseractOcr(fileOrDataUrl) {
  try {
    const tesseract = await loadTesseractScript();
    let res;
    try {
      res = await tesseract.recognize(fileOrDataUrl, 'ind+eng');
    } catch {
      res = await tesseract.recognize(fileOrDataUrl, 'eng');
    }
    const text = res?.data?.text || '';
    return text.trim();
  } catch {
    throw new Error('Tidak dapat memuat OCR otomatis. Silakan gunakan input teks.');
  }
}

/**
 * Main OCR Extraction function
 * @param {File|Blob|string|HTMLCanvasElement} fileOrDataUrl
 * @returns {Promise<string>}
 */
export async function extractTextFromImage(fileOrDataUrl) {
  if (!isValidImageInput(fileOrDataUrl)) {
    throw new Error('File atau gambar tidak valid');
  }

  // Non-browser / Node.js test environment support
  if (typeof window === 'undefined') {
    if (typeof fileOrDataUrl === 'string' && !fileOrDataUrl.startsWith('data:')) {
      return fileOrDataUrl.trim();
    }
    return '';
  }

  // Pre-processing Canvas sebelum dikirim ke TextDetector atau Tesseract
  const processedSource = await preprocessReceiptImage(fileOrDataUrl);

  // 1. Coba TextDetector native (Chrome/Android)
  const nativeText = await tryNativeTextDetector(processedSource);
  if (nativeText && nativeText.trim()) {
    return nativeText.trim();
  }

  // 2. Coba Tesseract via CDN
  return await tryTesseractOcr(processedSource);
}
