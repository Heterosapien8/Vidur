const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const {
  validateActionPlan,
  parseJSONResponse,
  generateHeuristicPlan,
  planAction
} = require(path.resolve(__dirname, '../src/services/reasoner.js'));

describe('Reasoning & Action Planning Service', () => {

  describe('Action Plan Validation & JSON Parsing', () => {
    test('validateActionPlan accepts valid action plan', () => {
      const plan = {
        reasoning: 'Typed query and submitted form',
        done: false,
        actions: [
          { type: 'type', elementId: 'el_0', value: 'wireless headphones' },
          { type: 'click', elementId: 'el_1', value: null }
        ]
      };
      const elements = [{ id: 'el_0' }, { id: 'el_1' }];
      const result = validateActionPlan(plan, elements);
      assert.strictEqual(result.valid, true);
    });

    test('validateActionPlan rejects invalid plan structures', () => {
      // Missing reasoning
      assert.strictEqual(validateActionPlan({ done: false, actions: [] }).valid, false);

      // Missing actions array
      assert.strictEqual(validateActionPlan({ reasoning: 'test', done: false }).valid, false);

      // Invalid action type
      assert.strictEqual(
        validateActionPlan({
          reasoning: 'test',
          done: false,
          actions: [{ type: 'invalid_action', elementId: 'el_0' }]
        }).valid,
        false
      );

      // Type action missing value
      assert.strictEqual(
        validateActionPlan({
          reasoning: 'test',
          done: false,
          actions: [{ type: 'type', elementId: 'el_0', value: null }]
        }).valid,
        false
      );
    });

    test('parseJSONResponse correctly parses raw JSON and strips markdown fences', () => {
      const rawJson = '{"reasoning": "test", "done": true, "actions": []}';
      assert.deepStrictEqual(parseJSONResponse(rawJson), { reasoning: 'test', done: true, actions: [] });

      const markdownJson = '```json\n{"reasoning": "fenced", "done": false, "actions": []}\n```';
      assert.deepStrictEqual(parseJSONResponse(markdownJson), { reasoning: 'fenced', done: false, actions: [] });
    });
  });

  describe('Action Planning for Search & Login Tasks', () => {
    test('1. Search task: plans typing query into search box and clicking submit button', async () => {
      const searchSchema = {
        schemaVersion: '1.0',
        capturedAt: '2026-09-20T12:00:00.000Z',
        viewport: { width: 1920, height: 1080 },
        domain: 'shop.example.com',
        elements: [
          {
            id: 'el_0',
            source: 'dom',
            tag: 'input',
            role: 'searchbox',
            label: 'Search catalog',
            type: 'text',
            autocomplete: 'off',
            bbox: { x: 100, y: 50, width: 400, height: 40 },
            value: null,
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
            bbox: { x: 510, y: 50, width: 80, height: 40 },
            value: null,
            text: null
          }
        ]
      };

      const plan = await planAction({
        task: 'search for wireless headphones',
        sanitizedSchema: searchSchema,
        actionHistory: []
      });

      assert.strictEqual(typeof plan.reasoning, 'string');
      assert.strictEqual(typeof plan.done, 'boolean');
      assert.ok(Array.isArray(plan.actions));
      assert.ok(plan.actions.length >= 1);

      const typeAction = plan.actions.find((a) => a.type === 'type');
      assert.ok(typeAction, 'Plan should contain a type action');
      assert.strictEqual(typeAction.elementId, 'el_0');
      assert.strictEqual(typeAction.value, 'wireless headphones');

      const clickAction = plan.actions.find((a) => a.type === 'click');
      assert.ok(clickAction, 'Plan should contain a click action for search button');
      assert.strictEqual(clickAction.elementId, 'el_1');
    });

    test('2. Login task: preserves and uses privacy tokens ({{FIELD:EMAIL_1}}, {{FIELD:PASSWORD_1}})', async () => {
      const loginSchema = {
        schemaVersion: '1.0',
        capturedAt: '2026-09-20T12:00:00.000Z',
        viewport: { width: 1920, height: 1080 },
        domain: 'portal.example.com',
        elements: [
          {
            id: 'el_0',
            source: 'dom',
            tag: 'input',
            role: 'textbox',
            label: 'Email',
            type: 'email',
            autocomplete: 'email',
            bbox: { x: 100, y: 100, width: 250, height: 40 },
            value: '{{FIELD:EMAIL_1}}',
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
            bbox: { x: 100, y: 150, width: 250, height: 40 },
            value: '{{FIELD:PASSWORD_1}}',
            text: null
          },
          {
            id: 'el_2',
            source: 'dom',
            tag: 'button',
            role: 'button',
            label: 'Sign In',
            type: 'submit',
            autocomplete: null,
            bbox: { x: 100, y: 200, width: 120, height: 40 },
            value: null,
            text: null
          }
        ]
      };

      const plan = await planAction({
        task: 'log in to my account',
        sanitizedSchema: loginSchema,
        actionHistory: []
      });

      assert.strictEqual(typeof plan.reasoning, 'string');
      assert.ok(Array.isArray(plan.actions));

      // Assert that values used are privacy tokens, not fabricated credentials
      const emailAction = plan.actions.find((a) => a.elementId === 'el_0');
      assert.ok(emailAction);
      assert.strictEqual(emailAction.value, '{{FIELD:EMAIL_1}}');

      const passwordAction = plan.actions.find((a) => a.elementId === 'el_1');
      assert.ok(passwordAction);
      assert.strictEqual(passwordAction.value, '{{FIELD:PASSWORD_1}}');

      const submitAction = plan.actions.find((a) => a.elementId === 'el_2');
      assert.ok(submitAction);
      assert.strictEqual(submitAction.type, 'click');
    });
  });

});
