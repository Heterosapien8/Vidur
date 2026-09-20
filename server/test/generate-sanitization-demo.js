const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { buildScreenSchema } = require('../../shared/screen-schema.js');
const { sanitizeSchema } = require('../../shared/sanitizer.js');

const htmlContent = fs.readFileSync(path.resolve(__dirname, '../../extension/test-page/login-test.html'), 'utf8');
const contentScriptCode = fs.readFileSync(path.resolve(__dirname, '../../extension/content-script.js'), 'utf8');

const dom = new JSDOM(htmlContent, {
  url: 'http://localhost:3000/test/login-test.html',
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

const rawSchema = buildScreenSchema(
  domElements,
  [],
  { width: 2048, height: 1146 },
  'http://localhost:3000/test/login-test.html',
  '2026-09-20T14:30:00.000Z'
);

const { sanitizedSchema, placeholderMap, piiCount, piiCategories, sessionId } = sanitizeSchema(
  rawSchema,
  'session_demo_98231'
);

console.log('=== RAW ORIGINAL SCHEMA (BEFORE) ===');
console.log(JSON.stringify(rawSchema, null, 2));

console.log('\n=== SANITIZED CLOUD-SAFE SCHEMA (AFTER) ===');
console.log(JSON.stringify(sanitizedSchema, null, 2));

console.log('\n=== LOCAL SECRET PLACEHOLDER MAP (INDEXEDDB VAULT ONLY) ===');
console.log(JSON.stringify(placeholderMap, null, 2));

console.log('\n=== PII SUMMARY ===');
console.log(`Total PII Redacted: ${piiCount}`);
console.log('Categories:', piiCategories);
console.log('Session ID:', sessionId);
