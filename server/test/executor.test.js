const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const {
  resolvePlaceholder,
  isSensitiveAction,
  executeAction
} = require(path.resolve(__dirname, '../../extension/executor.js'));

describe('Local Action Executor & Token Resolver', () => {

  describe('1. resolvePlaceholder Resolution Hierarchy', () => {
    test('Returns literal text as-is when not a placeholder token', () => {
      assert.strictEqual(resolvePlaceholder('wireless headphones'), 'wireless headphones');
      assert.strictEqual(resolvePlaceholder('Sony WH-1000XM5'), 'Sony WH-1000XM5');
      assert.strictEqual(resolvePlaceholder(''), '');
      assert.strictEqual(resolvePlaceholder(null), null);
    });

    test('Resolves directly from session placeholderMap when present', () => {
      const placeholderMap = {
        '{{FIELD:EMAIL_1}}': 'captured@vidur.ai',
        '{{FIELD:PASSWORD_1}}': 'SessionPass999!'
      };
      const vault = {
        email: 'vault@vidur.ai',
        password: 'VaultPass123!'
      };

      // Direct map should take priority over vault
      assert.strictEqual(
        resolvePlaceholder('{{FIELD:EMAIL_1}}', placeholderMap, vault),
        'captured@vidur.ai'
      );
      assert.strictEqual(
        resolvePlaceholder('{{FIELD:PASSWORD_1}}', placeholderMap, vault),
        'SessionPass999!'
      );
    });

    test('Falls back to Encrypted Profile Vault by category when not in placeholderMap', () => {
      const emptyMap = {};
      const vault = {
        name: 'Jane Doe',
        email: 'jane.vault@vidur.ai',
        phone: '+91 9876543210',
        address: '456 Innovation Park, Bengaluru',
        password: 'SuperSecretVaultPassword!',
        govtId: '4567 8901 2345',
        creditCard: '4532 0150 0000 0000'
      };

      assert.strictEqual(
        resolvePlaceholder('{{FIELD:EMAIL_1}}', emptyMap, vault),
        'jane.vault@vidur.ai'
      );
      assert.strictEqual(
        resolvePlaceholder('{{FIELD:NAME_1}}', emptyMap, vault),
        'Jane Doe'
      );
      assert.strictEqual(
        resolvePlaceholder('{{FIELD:PHONE_1}}', emptyMap, vault),
        '+91 9876543210'
      );
      assert.strictEqual(
        resolvePlaceholder('{{FIELD:ADDRESS_1}}', emptyMap, vault),
        '456 Innovation Park, Bengaluru'
      );
      assert.strictEqual(
        resolvePlaceholder('{{FIELD:PASSWORD_1}}', emptyMap, vault),
        'SuperSecretVaultPassword!'
      );
      assert.strictEqual(
        resolvePlaceholder('{{FIELD:GOVT_ID_1}}', emptyMap, vault),
        '4567 8901 2345'
      );
      assert.strictEqual(
        resolvePlaceholder('{{FIELD:CREDIT_CARD_1}}', emptyMap, vault),
        '4532 0150 0000 0000'
      );
    });

    test('Returns null when token cannot be resolved from map or vault (no guessing)', () => {
      const emptyMap = {};
      const emptyVault = {};

      assert.strictEqual(
        resolvePlaceholder('{{FIELD:EMAIL_1}}', emptyMap, emptyVault),
        null
      );
      assert.strictEqual(
        resolvePlaceholder('{{FIELD:UNKNOWN_CATEGORY_99}}', emptyMap, emptyVault),
        null
      );
    });
  });

  describe('2. isSensitiveAction Safety Check Classifier', () => {
    test('Identifies sensitive / destructive / financial submit actions', () => {
      assert.strictEqual(
        isSensitiveAction({ type: 'click' }, { label: 'Submit Order & Pay $99', type: 'submit' }),
        true
      );
      assert.strictEqual(
        isSensitiveAction({ type: 'click' }, { label: 'Confirm Payment', type: 'button' }),
        true
      );
      assert.strictEqual(
        isSensitiveAction({ type: 'click' }, { label: 'Delete Account Permanently', type: 'button' }),
        true
      );
      assert.strictEqual(
        isSensitiveAction({ type: 'click' }, { label: 'Checkout Now', type: 'button' }),
        true
      );
      assert.strictEqual(
        isSensitiveAction({ type: 'click' }, { label: 'Sign In', type: 'submit' }),
        true
      );
    });

    test('Allows non-sensitive actions without requiring safety flag', () => {
      assert.strictEqual(
        isSensitiveAction({ type: 'click' }, { label: 'Search catalog', type: 'button' }),
        false
      );
      assert.strictEqual(
        isSensitiveAction({ type: 'click' }, { label: 'In Stock Only', type: 'checkbox' }),
        false
      );
      assert.strictEqual(
        isSensitiveAction({ type: 'type', value: 'wireless headphones' }, { label: 'Search', type: 'text' }),
        false
      );
      assert.strictEqual(
        isSensitiveAction({ type: 'scroll' }, {}),
        false
      );
    });
  });

  describe('3. executeAction Execution & Safety Gates', () => {
    const mockSchema = {
      elements: [
        { id: 'el_0', tag: 'input', type: 'text', label: 'Search box' },
        { id: 'el_1', tag: 'button', type: 'submit', label: 'Submit Order & Pay $99' },
        { id: 'el_2', tag: 'input', type: 'email', label: 'Email Address' }
      ]
    };

    test('Requires approval when executing sensitive action if approved is false', async () => {
      const sensitiveAction = { type: 'click', elementId: 'el_1', value: null };
      const result = await executeAction(1, sensitiveAction, mockSchema, { approved: false });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.requiresApproval, true);
      assert.ok(result.reason.includes('sensitive operation'));
    });

    test('Allows sensitive action when approved is true', async () => {
      const sensitiveAction = { type: 'click', elementId: 'el_1', value: null };
      const result = await executeAction(1, sensitiveAction, mockSchema, { approved: true });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.actionType, 'click');
    });

    test('Executes type action with token resolution', async () => {
      const typeAction = { type: 'type', elementId: 'el_2', value: '{{FIELD:EMAIL_1}}' };
      const vault = { email: 'developer@vidur.ai' };

      const result = await executeAction(1, typeAction, mockSchema, {
        placeholderMap: {},
        vaultProfile: vault
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.resolvedValue, 'developer@vidur.ai');
      assert.strictEqual(result.resolutionSource, 'encrypted_vault');
    });

    test('Skips type action and reports error if placeholder token is unresolvable', async () => {
      const typeAction = { type: 'type', elementId: 'el_2', value: '{{FIELD:EMAIL_99}}' };

      const result = await executeAction(1, typeAction, mockSchema, {
        placeholderMap: {},
        vaultProfile: {}
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.skipped, true);
      assert.ok(result.error.includes('Failed to resolve placeholder token'));
    });
  });

});
