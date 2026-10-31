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
 * Validates image input
 * @param {any} input
 * @returns {boolean}
 */
export function isValidImageInput(input) {
  if (!input) return false;
  if (typeof Blob !== 'undefined' && input instanceof Blob) return true;
  if (typeof File !== 'undefined' && input instanceof File) return true;
  if (typeof input === 'string' && input.trim().length > 0) return true;
  return false;
}

/**
 * Recognizes text using Native window.TextDetector (Chrome / Android)
 * @param {File|Blob|string} fileOrDataUrl
 * @returns {Promise<string|null>}
 */
export async function tryNativeTextDetector(fileOrDataUrl) {
  if (typeof window === 'undefined' || typeof window.TextDetector !== 'function') {
    return null;
  }

  try {
    const detector = new window.TextDetector();
    let imageSource = null;

    if (typeof createImageBitmap === 'function' && (fileOrDataUrl instanceof Blob || fileOrDataUrl instanceof File)) {
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
 * @param {File|Blob|string} fileOrDataUrl
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
 * @param {File|Blob|string} fileOrDataUrl
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

  // 1. Coba TextDetector native (Chrome/Android)
  const nativeText = await tryNativeTextDetector(fileOrDataUrl);
  if (nativeText && nativeText.trim()) {
    return nativeText.trim();
  }

  // 2. Coba Tesseract via CDN
  return await tryTesseractOcr(fileOrDataUrl);
}
