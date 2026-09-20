const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { buildScreenSchema } = require('../../shared/screen-schema.js');

const htmlContent = fs.readFileSync(path.resolve(__dirname, '../../extension/test-page/login-test.html'), 'utf8');
const contentScriptCode = fs.readFileSync(path.resolve(__dirname, '../../extension/content-script.js'), 'utf8');

const dom = new JSDOM(htmlContent, {
  url: 'http://localhost:3000/test/login-test.html?debug=true&user=demo',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});
const { window } = dom;

window.chrome = { runtime: { onMessage: { addListener: () => {} } } };
window.innerHeight = 1146;
window.innerWidth = 2048;
window.getComputedStyle = () => ({ display: 'block', visibility: 'visible', opacity: '1' });
window.HTMLElement.prototype.getBoundingClientRect = function() {
  return { x: 100, y: 150, width: 300, height: 45, top: 150, left: 100, right: 400, bottom: 195 };
};

window.eval(contentScriptCode);
const domElements = window.extractAccessibilityTree();

// Realistic OCR results:
// 1. Text overlapping with DOM button "Sign In to Vidur" -> Deduplicated (IoU / Overlap > 50%)
// 2. Text in a canvas badge / watermark -> Non-overlapping, so it is preserved as an OCR element
const ocrResults = [
  { text: 'Sign In to Vidur', confidence: 98.2, bbox: { x: 105, y: 155, width: 140, height: 25 } },
  { text: 'SOC2 Type II Certified', confidence: 91.5, bbox: { x: 920, y: 840, width: 180, height: 32 } }
];

const schema = buildScreenSchema(
  domElements,
  ocrResults,
  { width: 2048, height: 1146 },
  'http://localhost:3000/test/login-test.html?debug=true&user=demo',
  '2026-09-20T11:45:00.000Z'
);

console.log(JSON.stringify(schema, null, 2));
