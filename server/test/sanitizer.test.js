const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const {
  isValidLuhn,
  isAadhaarNumber,
  isEmailAddress,
  isPhoneNumber,
  detectPIICategory,
  sanitizeSchema
} = require(path.resolve(__dirname, '../../shared/sanitizer.js'));

describe('Privacy Sanitization & PII Redaction Module', () => {

  describe('Luhn Algorithm & PII Detectors', () => {
    test('isValidLuhn correctly validates credit card numbers', () => {
      // Valid cards (Canonical Stripe Visa test card 4242..., valid test cards)
      assert.strictEqual(isValidLuhn('4242 4242 4242 4242'), true); // Stripe Visa
      assert.strictEqual(isValidLuhn('4532-0150-1234-5671'), true); // Valid Visa test
      assert.strictEqual(isValidLuhn('378282246310005'), true);      // Amex 15-digits


      // Invalid cards (tampered check digit, too short, non-numeric)
      assert.strictEqual(isValidLuhn('4532 0150 1234 5679'), false);
      assert.strictEqual(isValidLuhn('1234567890'), false);
      assert.strictEqual(isValidLuhn(''), false);
      assert.strictEqual(isValidLuhn(null), false);
    });

    test('isAadhaarNumber identifies valid 12-digit Indian Aadhaar patterns', () => {
      assert.strictEqual(isAadhaarNumber('2345 6789 0123'), true);
      assert.strictEqual(isAadhaarNumber('987654321098'), true);

      // Cannot start with 0 or 1
      assert.strictEqual(isAadhaarNumber('0123 4567 8901'), false);
      assert.strictEqual(isAadhaarNumber('1123 4567 8901'), false);

      // Repeated digits
      assert.strictEqual(isAadhaarNumber('9999 9999 9999'), false);
    });

    test('isEmailAddress and isPhoneNumber detect standard formats', () => {
      assert.strictEqual(isEmailAddress('engineer@vidur.ai'), true);
      assert.strictEqual(isEmailAddress('not-an-email'), false);

      assert.strictEqual(isPhoneNumber('+1 (555) 234-5678'), true);
      assert.strictEqual(isPhoneNumber('+91 9876543210'), true);
      assert.strictEqual(isPhoneNumber('123'), false);
    });
  });

  describe('Form Sanitization Tests', () => {

    test('1. Login form: Sanitizes Email and Password fields into scoped placeholders', () => {
      const loginSchema = {
        schemaVersion: '1.0',
        capturedAt: '2026-09-20T12:00:00.000Z',
        viewport: { width: 1920, height: 1080 },
        domain: 'auth.example.com',
        elements: [
          {
            id: 'el_0',
            source: 'dom',
            tag: 'input',
            role: 'textbox',
            label: 'Email Address',
            type: 'email',
            autocomplete: 'email',
            bbox: { x: 100, y: 100, width: 280, height: 40 },
            value: 'admin@company.org',
            text: null
          },
          {
            id: 'el_1',
            source: 'dom',
            tag: 'input',
            role: 'textbox',
            label: 'Password',
            type: 'password',
            autocomplete: 'current-password',
            bbox: { x: 100, y: 160, width: 280, height: 40 },
            value: 'SuperSecretPass#99',
            text: null
          },
          {
            id: 'el_2',
            source: 'dom',
            tag: 'button',
            role: 'button',
            label: 'Log In',
            type: 'submit',
            autocomplete: null,
            bbox: { x: 100, y: 220, width: 120, height: 40 },
            value: null,
            text: null
          }
        ]
      };

      const result = sanitizeSchema(loginSchema, 'test-login-session');

      // Assertions on sanitized schema
      assert.strictEqual(result.sanitizedSchema.elements[0].value, '{{FIELD:EMAIL_1}}');
      assert.strictEqual(result.sanitizedSchema.elements[0].label, 'Email Address'); // Label preserved
      assert.strictEqual(result.sanitizedSchema.elements[0].type, 'email');

      assert.strictEqual(result.sanitizedSchema.elements[1].value, '{{FIELD:PASSWORD_1}}');
      assert.strictEqual(result.sanitizedSchema.elements[1].label, 'Password');

      assert.strictEqual(result.sanitizedSchema.elements[2].value, null); // Button unchanged

      // Assertions on secret local placeholderMap (NEVER sent to cloud)
      assert.strictEqual(result.placeholderMap['{{FIELD:EMAIL_1}}'], 'admin@company.org');
      assert.strictEqual(result.placeholderMap['{{FIELD:PASSWORD_1}}'], 'SuperSecretPass#99');

      assert.strictEqual(result.piiCount, 2);
      assert.deepStrictEqual(result.piiCategories, { EMAIL: 1, PASSWORD: 1 });
    });

    test('2. Payment form: Redacts valid Credit Card numbers with Luhn check', () => {
      const paymentSchema = {
        schemaVersion: '1.0',
        capturedAt: '2026-09-20T12:00:00.000Z',
        viewport: { width: 1920, height: 1080 },
        domain: 'checkout.stripe.com',
        elements: [
          {
            id: 'el_0',
            source: 'dom',
            tag: 'input',
            role: 'textbox',
            label: 'Card Number',
            type: 'text',
            autocomplete: 'cc-number',
            bbox: { x: 50, y: 50, width: 300, height: 40 },
            value: '4242 4242 4242 4242', // Valid Stripe Visa test card
            text: null
          },
          {
            id: 'el_1',
            source: 'dom',
            tag: 'input',
            role: 'textbox',
            label: 'Security Code (CVV)',
            type: 'text',
            autocomplete: 'off',
            bbox: { x: 50, y: 110, width: 100, height: 40 },
            value: '849',
            text: null
          }
        ]
      };

      const result = sanitizeSchema(paymentSchema, 'test-payment-session');

      assert.strictEqual(result.sanitizedSchema.elements[0].value, '{{FIELD:CREDIT_CARD_1}}');
      assert.strictEqual(result.sanitizedSchema.elements[1].value, '{{FIELD:GENERIC_SENSITIVE_1}}');

      assert.strictEqual(result.placeholderMap['{{FIELD:CREDIT_CARD_1}}'], '4242 4242 4242 4242');
      assert.strictEqual(result.placeholderMap['{{FIELD:GENERIC_SENSITIVE_1}}'], '849');
      assert.strictEqual(result.piiCount, 2);
    });

    test('3. Government ID, Address, and Name detection', () => {
      const formSchema = {
        schemaVersion: '1.0',
        capturedAt: '2026-09-20T12:00:00.000Z',
        viewport: { width: 1920, height: 1080 },
        domain: 'kyc.bank.in',
        elements: [
          {
            id: 'el_0',
            source: 'dom',
            tag: 'input',
            role: 'textbox',
            label: 'Full Legal Name',
            type: 'text',
            autocomplete: 'name',
            bbox: { x: 10, y: 10, width: 250, height: 40 },
            value: 'Aarav Patel',
            text: null
          },
          {
            id: 'el_1',
            source: 'dom',
            tag: 'input',
            role: 'textbox',
            label: 'Aadhaar Number',
            type: 'text',
            autocomplete: 'off',
            bbox: { x: 10, y: 60, width: 250, height: 40 },
            value: '3456 7890 1234',
            text: null
          },
          {
            id: 'el_2',
            source: 'dom',
            tag: 'input',
            role: 'textbox',
            label: 'Residential Address',
            type: 'text',
            autocomplete: 'street-address',
            bbox: { x: 10, y: 110, width: 250, height: 40 },
            value: 'Flat 402, Lotus Residency, Mumbai',
            text: null
          },
          {
            id: 'el_3',
            source: 'dom',
            tag: 'input',
            role: 'textbox',
            label: 'Mobile Number',
            type: 'tel',
            autocomplete: 'tel',
            bbox: { x: 10, y: 160, width: 250, height: 40 },
            value: '+91 9876543210',
            text: null
          }
        ]
      };

      const result = sanitizeSchema(formSchema, 'test-kyc-session');

      assert.strictEqual(result.sanitizedSchema.elements[0].value, '{{FIELD:NAME_1}}');
      assert.strictEqual(result.sanitizedSchema.elements[1].value, '{{FIELD:GOVT_ID_1}}');
      assert.strictEqual(result.sanitizedSchema.elements[2].value, '{{FIELD:ADDRESS_1}}');
      assert.strictEqual(result.sanitizedSchema.elements[3].value, '{{FIELD:PHONE_1}}');

      assert.strictEqual(result.placeholderMap['{{FIELD:NAME_1}}'], 'Aarav Patel');
      assert.strictEqual(result.placeholderMap['{{FIELD:GOVT_ID_1}}'], '3456 7890 1234');
      assert.strictEqual(result.placeholderMap['{{FIELD:ADDRESS_1}}'], 'Flat 402, Lotus Residency, Mumbai');
      assert.strictEqual(result.placeholderMap['{{FIELD:PHONE_1}}'], '+91 9876543210');
      assert.strictEqual(result.piiCount, 4);
    });

    test('4. Page with NO PII: Leaves all schema elements unchanged and placeholderMap empty', () => {
      const searchSchema = {
        schemaVersion: '1.0',
        capturedAt: '2026-09-20T12:00:00.000Z',
        viewport: { width: 1920, height: 1080 },
        domain: 'search.example.com',
        elements: [
          {
            id: 'el_0',
            source: 'dom',
            tag: 'input',
            role: 'searchbox',
            label: 'Search queries and documents',
            type: 'search',
            autocomplete: 'off',
            bbox: { x: 200, y: 100, width: 500, height: 50 },
            value: 'TypeScript monorepo architecture',
            text: null
          },
          {
            id: 'el_1',
            source: 'dom',
            tag: 'button',
            role: 'button',
            label: 'Search',
            type: 'submit',
            autocomplete: null,
            bbox: { x: 720, y: 100, width: 100, height: 50 },
            value: null,
            text: null
          },
          {
            id: 'ocr_0',
            source: 'ocr',
            tag: null,
            role: null,
            label: null,
            type: null,
            autocomplete: null,
            bbox: { x: 50, y: 20, width: 120, height: 40 },
            value: null,
            text: 'Acme Search Engine'
          }
        ]
      };

      const result = sanitizeSchema(searchSchema, 'test-non-pii-session');

      // Schema should be completely unchanged
      assert.deepStrictEqual(result.sanitizedSchema, searchSchema);
      assert.deepStrictEqual(result.placeholderMap, {});
      assert.strictEqual(result.piiCount, 0);
    });

  });

});
