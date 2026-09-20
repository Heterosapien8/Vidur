const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { JSDOM } = require('jsdom');

const {
  resolvePlaceholder,
  isSensitiveAction
} = require(path.resolve(__dirname, '../../extension/executor.js'));

const {
  buildScreenSchema
} = require(path.resolve(__dirname, '../../extension/screen-schema.js'));

const {
  sanitizeSchema
} = require(path.resolve(__dirname, '../../extension/sanitizer.js'));

const {
  planAction
} = require(path.resolve(__dirname, '../src/services/reasoner.js'));

describe('End-to-End Orchestration Loop Simulation', () => {

  test('Full Agent Loop: Search Product -> Plan -> Resolve & Execute -> Results rendered', async () => {
    // 1. Load HTML for search test page
    const htmlPath = path.resolve(__dirname, '../../extension/test-page/search-test.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    const dom = new JSDOM(htmlContent, {
      url: 'http://localhost:3000/test/search-test.html',
      runScripts: 'dangerously'
    });
    const { document, window } = dom.window;

    // 2. Extract DOM elements
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const checkoutBtn = document.getElementById('checkout-btn');

    assert.ok(searchInput, 'Search input must exist');
    assert.ok(searchButton, 'Search button must exist');

    const extractedElements = [
      {
        id: 'el_0',
        tag: 'input',
        role: 'searchbox',
        label: 'Search products, e.g. wireless headphones...',
        type: 'search',
        autocomplete: 'off',
        bbox: { x: 100, y: 50, width: 400, height: 40 },
        value: null
      },
      {
        id: 'el_1',
        tag: 'button',
        role: 'button',
        label: 'Search',
        type: 'submit',
        autocomplete: null,
        bbox: { x: 510, y: 50, width: 80, height: 40 },
        value: null
      },
      {
        id: 'el_2',
        tag: 'button',
        role: 'button',
        label: 'Submit Order & Pay $99',
        type: 'submit',
        autocomplete: null,
        bbox: { x: 100, y: 400, width: 200, height: 40 },
        value: null
      }
    ];

    // 3. Build Unified Screen Schema & Sanitize
    const rawSchema = buildScreenSchema(extractedElements, [], { width: 1920, height: 1080 }, 'http://localhost:3000/test/search-test.html');
    const { sanitizedSchema, placeholderMap } = sanitizeSchema(rawSchema);

    assert.strictEqual(sanitizedSchema.domain, 'localhost');
    assert.strictEqual(sanitizedSchema.elements.length, 3);

    // 4. Request Action Plan from Reasoning Engine
    const task = 'search for wireless headphones';
    const plan = await planAction({
      task: task,
      sanitizedSchema: sanitizedSchema,
      actionHistory: []
    });

    assert.strictEqual(typeof plan.reasoning, 'string');
    assert.ok(plan.actions.length >= 2, 'Should generate type and click actions');

    // 5. Execute Action 1: Type query into search box
    const typeAction = plan.actions.find((a) => a.type === 'type');
    assert.ok(typeAction);
    const resolvedSearchQuery = resolvePlaceholder(typeAction.value, placeholderMap, {});
    assert.strictEqual(resolvedSearchQuery, 'wireless headphones');

    // Simulate input in DOM
    searchInput.value = resolvedSearchQuery;
    searchInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    assert.strictEqual(searchInput.value, 'wireless headphones');

    // 6. Execute Action 2: Click Search Button
    const clickAction = plan.actions.find((a) => a.type === 'click');
    assert.ok(clickAction);
    assert.strictEqual(clickAction.elementId, 'el_1');

    // Trigger form submit / click
    searchButton.click();

    // 7. Verify Search Results rendered dynamically on page
    const resultsCount = document.getElementById('results-count');
    assert.ok(resultsCount.textContent.includes('wireless headphones'), 'Results header should reflect search query');

    const productCards = document.querySelectorAll('#results-grid .product-card');
    assert.strictEqual(productCards.length, 3, 'Should render 3 matching product cards');

    // 8. Verify Safety Check on Sensitive Checkout Button
    const sensitiveAction = { type: 'click', elementId: 'el_2', value: null };
    const sensitiveElement = extractedElements.find((e) => e.id === 'el_2');
    const requiresApproval = isSensitiveAction(sensitiveAction, sensitiveElement);

    assert.strictEqual(requiresApproval, true, 'Submit/Pay action must require safety approval');
  });

  test('Vault Token Resolution: Login Form resolves credentials without leaking raw PII to server', async () => {
    // 1. Vault profile
    const vault = {
      name: 'Jane Doe',
      email: 'jane.developer@vidur.ai',
      password: 'VaultSecurePassword999!'
    };

    // 2. Sanitized schema with privacy tokens
    const loginSanitizedSchema = {
      schemaVersion: '1.0',
      capturedAt: new Date().toISOString(),
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
          value: '{{FIELD:EMAIL_1}}'
        },
        {
          id: 'el_1',
          source: 'dom',
          tag: 'input',
          role: 'textbox',
          label: 'Password',
          type: 'password',
          value: '{{FIELD:PASSWORD_1}}'
        },
        {
          id: 'el_2',
          source: 'dom',
          tag: 'button',
          role: 'button',
          label: 'Sign In',
          type: 'submit',
          value: null
        }
      ]
    };

    // 3. Plan action on server
    const plan = await planAction({
      task: 'log in to my account',
      sanitizedSchema: loginSanitizedSchema,
      actionHistory: []
    });

    // 4. Server receives only {{FIELD:EMAIL_1}} and responds with token preserved
    const emailAction = plan.actions.find((a) => a.elementId === 'el_0');
    const passwordAction = plan.actions.find((a) => a.elementId === 'el_1');

    assert.strictEqual(emailAction.value, '{{FIELD:EMAIL_1}}');
    assert.strictEqual(passwordAction.value, '{{FIELD:PASSWORD_1}}');

    // 5. Client resolves tokens from local vault
    const resolvedEmail = resolvePlaceholder(emailAction.value, {}, vault);
    const resolvedPassword = resolvePlaceholder(passwordAction.value, {}, vault);

    assert.strictEqual(resolvedEmail, 'jane.developer@vidur.ai');
    assert.strictEqual(resolvedPassword, 'VaultSecurePassword999!');
  });

});
