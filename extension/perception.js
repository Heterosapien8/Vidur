/**
 * Vidur Extension - Perception Layer (OCR)
 * Runs Tesseract OCR on screenshot data URLs and returns high-confidence text tokens with bounding boxes.
 */

/**
 * Executes OCR on the provided screenshot image data URL.
 * @param {string} screenshotDataUrl - base64 data URL of the screenshot
 * @returns {Promise<Array<{ text: string, bbox: { x: number, y: number, width: number, height: number }, confidence: number }>>}
 */
async function runOCR(screenshotDataUrl) {
  if (!screenshotDataUrl) {
    return [];
  }

  // Resolve Tesseract library in browser or Node.js environment
  let tesseractLib = null;
  if (typeof window !== 'undefined' && window.Tesseract) {
    tesseractLib = window.Tesseract;
  } else if (typeof global !== 'undefined' && global.Tesseract) {
    tesseractLib = global.Tesseract;
  } else if (typeof require === 'function') {
    try {
      tesseractLib = require('tesseract.js');
    } catch (e) {
      console.warn('[Vidur OCR] Could not load tesseract.js via require:', e);
    }
  }

  if (!tesseractLib) {
    console.warn('[Vidur OCR] Tesseract library not found in runtime environment.');
    return [];
  }

  try {
    console.log('[Vidur OCR] Starting OCR processing...');
    const result = await tesseractLib.recognize(screenshotDataUrl, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text' && m.progress) {
          console.log(`[Vidur OCR Progress] ${(m.progress * 100).toFixed(0)}%`);
        }
      }
    });

    if (!result || !result.data) {
      return [];
    }

    const ocrItems = [];
    const words = result.data.words || [];

    for (const w of words) {
      const cleanText = (w.text || '').trim();
      const confidence = typeof w.confidence === 'number' ? w.confidence : 0;

      // Filter out low confidence (< 60) and empty strings
      if (confidence >= 60 && cleanText.length > 0 && w.bbox) {
        const width = Math.max(0, Math.round(w.bbox.x1 - w.bbox.x0));
        const height = Math.max(0, Math.round(w.bbox.y1 - w.bbox.y0));

        if (width > 0 && height > 0) {
          ocrItems.push({
            text: cleanText,
            confidence: Math.round(confidence * 10) / 10,
            bbox: {
              x: Math.round(w.bbox.x0),
              y: Math.round(w.bbox.y0),
              width: width,
              height: height
            }
          });
        }
      }
    }

    console.log(`[Vidur OCR] Complete. Found ${ocrItems.length} high-confidence text tokens.`);
    return ocrItems;
  } catch (err) {
    console.error('[Vidur OCR] Error running Tesseract OCR:', err);
    return [];
  }
}

// Export for browser window and Node.js environments
if (typeof window !== 'undefined') {
  window.runOCR = runOCR;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runOCR };
}
