/**
 * Unified Screen Schema Builder
 * Merges DOM Accessibility tree and OCR perception results with IoU deduplication.
 */

/**
 * Calculates the Intersection over Union (IoU) between two bounding boxes.
 * @param {{ x: number, y: number, width: number, height: number }} boxA
 * @param {{ x: number, y: number, width: number, height: number }} boxB
 * @returns {number} IoU value between 0 and 1
 */
function calculateIoU(boxA, boxB) {
  if (!boxA || !boxB) return 0;

  const ax1 = boxA.x;
  const ay1 = boxA.y;
  const ax2 = boxA.x + boxA.width;
  const ay2 = boxA.y + boxA.height;
  const areaA = boxA.width * boxA.height;

  const bx1 = boxB.x;
  const by1 = boxB.y;
  const bx2 = boxB.x + boxB.width;
  const by2 = boxB.y + boxB.height;
  const areaB = boxB.width * boxB.height;

  if (areaA <= 0 || areaB <= 0) return 0;

  const interX1 = Math.max(ax1, bx1);
  const interY1 = Math.max(ay1, by1);
  const interX2 = Math.min(ax2, bx2);
  const interY2 = Math.min(ay2, by2);

  const interWidth = Math.max(0, interX2 - interX1);
  const interHeight = Math.max(0, interY2 - interY1);
  const interArea = interWidth * interHeight;

  const unionArea = areaA + areaB - interArea;
  if (unionArea <= 0) return 0;

  return interArea / unionArea;
}

/**
 * Checks if an OCR bounding box significantly overlaps with a DOM element's bounding box.
 * Considers both standard IoU (> 0.5) and containment / intersection over OCR box area (> 0.5).
 * @param {{ x: number, y: number, width: number, height: number }} ocrBox
 * @param {{ x: number, y: number, width: number, height: number }} domBox
 * @param {number} [threshold=0.5]
 * @returns {boolean}
 */
function hasSignificantOverlap(ocrBox, domBox, threshold = 0.5) {
  if (!ocrBox || !domBox) return false;

  const iou = calculateIoU(ocrBox, domBox);
  if (iou > threshold) return true;

  // Check if OCR text is >50% contained within the DOM element
  const x1 = Math.max(ocrBox.x, domBox.x);
  const y1 = Math.max(ocrBox.y, domBox.y);
  const x2 = Math.min(ocrBox.x + ocrBox.width, domBox.x + domBox.width);
  const y2 = Math.min(ocrBox.y + ocrBox.height, domBox.y + domBox.height);

  const interW = Math.max(0, x2 - x1);
  const interH = Math.max(0, y2 - y1);
  const interArea = interW * interH;
  const ocrArea = ocrBox.width * ocrBox.height;

  if (ocrArea > 0 && (interArea / ocrArea) > threshold) {
    return true;
  }

  return false;
}

/**
 * Extracts clean domain/hostname from a URL string, stripping query params, paths, and ports.
 * @param {string} urlOrDomain
 * @returns {string}
 */
function extractDomain(urlOrDomain) {
  if (!urlOrDomain) return 'unknown';

  try {
    if (urlOrDomain.includes('://')) {
      const parsed = new URL(urlOrDomain);
      return parsed.hostname || 'unknown';
    }
    const parsed = new URL(`http://${urlOrDomain}`);
    return parsed.hostname || 'unknown';
  } catch {
    const withoutQuery = urlOrDomain.split('?')[0].split('#')[0];
    const withoutProtocol = withoutQuery.replace(/^https?:\/\//i, '').replace(/^\/\//, '');
    const hostname = withoutProtocol.split('/')[0].split(':')[0].trim();
    return hostname || 'unknown';
  }
}

/**
 * Builds the unified Screen Schema by combining DOM AX elements and non-overlapping OCR results.
 * @param {Array<object>} axTreeElements - Extracted DOM accessibility tree elements
 * @param {Array<object>} [ocrResults=[]] - High-confidence OCR text items
 * @param {{ width: number, height: number }} [viewport={ width: 0, height: 0 }] - Viewport dimensions
 * @param {string} [domainOrUrl=''] - Page URL or domain name
 * @param {string} [customTimestamp] - Optional ISO timestamp override (useful for testing)
 * @returns {object} Final unified Screen Schema
 */
function buildScreenSchema(axTreeElements = [], ocrResults = [], viewport = { width: 0, height: 0 }, domainOrUrl = '', customTimestamp) {
  const mergedElements = [];

  // 1. Include all DOM AX elements as-is
  let domIndex = 0;
  for (const el of axTreeElements) {
    mergedElements.push({
      id: el.id || `dom_${domIndex++}`,
      source: 'dom',
      tag: el.tag || null,
      role: el.role || null,
      label: el.label || null,
      type: el.type || null,
      autocomplete: el.autocomplete || null,
      bbox: el.bbox || { x: 0, y: 0, width: 0, height: 0 },
      value: el.value !== undefined ? el.value : null,
      text: null
    });
  }

  // 2. Filter OCR results: only add if bbox doesn't significantly overlap (>50% IoU) with any DOM element
  let ocrIndex = 0;
  for (const ocr of ocrResults) {
    if (!ocr || !ocr.bbox || !ocr.text) continue;

    const overlapsWithDOM = axTreeElements.some((domEl) =>
      hasSignificantOverlap(ocr.bbox, domEl.bbox, 0.5)
    );

    if (!overlapsWithDOM) {
      mergedElements.push({
        id: `ocr_${ocrIndex++}`,
        source: 'ocr',
        tag: null,
        role: null,
        label: null,
        type: null,
        autocomplete: null,
        bbox: {
          x: Math.round(ocr.bbox.x),
          y: Math.round(ocr.bbox.y),
          width: Math.round(ocr.bbox.width),
          height: Math.round(ocr.bbox.height)
        },
        value: null,
        text: ocr.text.trim()
      });
    }
  }

  return {
    schemaVersion: '1.0',
    capturedAt: customTimestamp || new Date().toISOString(),
    viewport: {
      width: viewport?.width || 0,
      height: viewport?.height || 0
    },
    domain: extractDomain(domainOrUrl),
    elements: mergedElements
  };
}

// Export for browser window and Node.js environments
if (typeof window !== 'undefined') {
  window.calculateIoU = calculateIoU;
  window.hasSignificantOverlap = hasSignificantOverlap;
  window.extractDomain = extractDomain;
  window.buildScreenSchema = buildScreenSchema;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateIoU,
    hasSignificantOverlap,
    extractDomain,
    buildScreenSchema
  };
}
