const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const {
  calculateIoU,
  hasSignificantOverlap,
  extractDomain,
  buildScreenSchema
} = require(path.resolve(__dirname, '../../shared/screen-schema.js'));

describe('Screen Schema & Bounding Box Deduplication', () => {

  test('calculateIoU correctly computes IoU for disjoint, identical, and partial overlap boxes', () => {
    // 1. Identical boxes
    const boxA = { x: 10, y: 10, width: 100, height: 100 };
    const boxIdentical = { x: 10, y: 10, width: 100, height: 100 };
    assert.strictEqual(calculateIoU(boxA, boxIdentical), 1.0);

    // 2. Disjoint boxes (no overlap)
    const boxDisjoint = { x: 200, y: 200, width: 50, height: 50 };
    assert.strictEqual(calculateIoU(boxA, boxDisjoint), 0.0);

    // 3. Partial overlap (> 50% IoU)
    // Box 1: (0,0, 100x100), Box 2: (20,0, 100x100) -> Inter: 80x100=8000, Union: 10000+10000-8000=12000 -> IoU = 8000/12000 = 0.666...
    const box1 = { x: 0, y: 0, width: 100, height: 100 };
    const box2 = { x: 20, y: 0, width: 100, height: 100 };
    const iou = calculateIoU(box1, box2);
    assert.ok(iou > 0.66 && iou < 0.67, `Expected ~0.666 IoU, got ${iou}`);
  });

  test('hasSignificantOverlap identifies contained and high-IoU OCR text bounding boxes', () => {
    // DOM Button at (100, 200, 200, 50)
    const domButton = { x: 100, y: 200, width: 200, height: 50 };

    // OCR text token inside the button at (120, 210, 60, 20) -> 100% contained in DOM button
    const ocrInside = { x: 120, y: 210, width: 60, height: 20 };
    assert.strictEqual(hasSignificantOverlap(ocrInside, domButton), true);

    // OCR text on an external canvas element at (600, 500, 150, 40)
    const ocrExternalCanvas = { x: 600, y: 500, width: 150, height: 40 };
    assert.strictEqual(hasSignificantOverlap(ocrExternalCanvas, domButton), false);
  });

  test('buildScreenSchema deduplicates OCR tokens overlapping with DOM elements and retains canvas/image OCR tokens', () => {
    const axTreeElements = [
      {
        id: 'el_0',
        tag: 'input',
        role: 'textbox',
        label: 'Email Address',
        type: 'email',
        autocomplete: 'email',
        bbox: { x: 100, y: 100, width: 300, height: 40 },
        value: 'user@example.com'
      },
      {
        id: 'el_1',
        tag: 'button',
        role: 'button',
        label: 'Submit',
        type: 'submit',
        autocomplete: null,
        bbox: { x: 100, y: 200, width: 150, height: 45 },
        value: null
      }
    ];

    const ocrResults = [
      // OCR token 1: Inside email input (Overlapping -> Should be deduplicated)
      {
        text: 'user@example.com',
        confidence: 95.5,
        bbox: { x: 110, y: 110, width: 120, height: 20 }
      },
      // OCR token 2: Inside submit button (Overlapping -> Should be deduplicated)
      {
        text: 'Submit',
        confidence: 98.0,
        bbox: { x: 130, y: 210, width: 80, height: 25 }
      },
      // OCR token 3: Text rendered inside an HTML5 Canvas graph / Image (Non-overlapping -> Should be kept)
      {
        text: 'Quarterly Revenue: $1.2M',
        confidence: 89.2,
        bbox: { x: 500, y: 350, width: 220, height: 30 }
      }
    ];

    const viewport = { width: 1920, height: 1080 };
    const url = 'https://portal.company.com:8080/dashboard?tab=analytics&user=123';
    const testTimestamp = '2026-09-20T12:00:00.000Z';

    const schema = buildScreenSchema(axTreeElements, ocrResults, viewport, url, testTimestamp);

    // Assert top-level schema attributes
    assert.strictEqual(schema.schemaVersion, '1.0');
    assert.strictEqual(schema.capturedAt, testTimestamp);
    assert.strictEqual(schema.domain, 'portal.company.com');
    assert.deepStrictEqual(schema.viewport, { width: 1920, height: 1080 });

    // Assert merged elements: 2 DOM elements + 1 OCR element (2 OCR tokens deduplicated)
    assert.strictEqual(schema.elements.length, 3);

    const domElements = schema.elements.filter(e => e.source === 'dom');
    const ocrElements = schema.elements.filter(e => e.source === 'ocr');

    assert.strictEqual(domElements.length, 2);
    assert.strictEqual(ocrElements.length, 1);

    // Verify DOM element preservation
    assert.strictEqual(domElements[0].id, 'el_0');
    assert.strictEqual(domElements[0].tag, 'input');
    assert.strictEqual(domElements[0].label, 'Email Address');
    assert.strictEqual(domElements[0].text, null);

    // Verify OCR element structure
    assert.strictEqual(ocrElements[0].source, 'ocr');
    assert.strictEqual(ocrElements[0].text, 'Quarterly Revenue: $1.2M');
    assert.strictEqual(ocrElements[0].tag, null);
    assert.strictEqual(ocrElements[0].role, null);
    assert.deepStrictEqual(ocrElements[0].bbox, { x: 500, y: 350, width: 220, height: 30 });
  });

  test('extractDomain correctly isolates clean hostname without protocols, query params, paths, or ports', () => {
    assert.strictEqual(extractDomain('https://example.com/path?foo=bar#hash'), 'example.com');
    assert.strictEqual(extractDomain('http://localhost:3000/test/login.html?token=123'), 'localhost');
    assert.strictEqual(extractDomain('app.vidur.ai/workspace/1'), 'app.vidur.ai');
    assert.strictEqual(extractDomain(''), 'unknown');
  });

});
