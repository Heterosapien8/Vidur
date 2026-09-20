/**
 * Vidur Server - Action Reasoning Service
 * Generates autonomous browser action plans using Anthropic Claude with strict PII token handling.
 */

const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are Vidur's Autonomous Web Agent Reasoning Engine.
Your objective is to complete the user's browser automation task step-by-step by analyzing the structural Screen Schema of the current web page.

KEY CAPABILITIES & CONSTRAINTS:
1. You can only see the structural schema of the page: element IDs, tags, roles, labels, types, autocomplete, and bounding boxes.
2. PRIVACY-PRESERVING TOKENS: Any sensitive Personally Identifiable Information (PII) such as passwords, emails, phone numbers, credit card numbers, or personal identity details has been redacted into scoped placeholder tokens like {{FIELD:EMAIL_1}}, {{FIELD:PASSWORD_1}}, {{FIELD:CREDIT_CARD_1}}, {{FIELD:NAME_1}}, {{FIELD:PHONE_1}}, etc.
   - You must NEVER attempt to guess, fabricate, or leak real credentials or sensitive values.
   - When filling in form fields that require credentials or user data, you MUST provide the corresponding placeholder token as the value (e.g. value: "{{FIELD:EMAIL_1}}").
   - The user's local browser extension will securely resolve placeholder tokens to actual values inside its local vault before executing the action.
3. For non-sensitive actions (e.g. typing a search query, entering a product filter, or filling non-PII text), provide the literal text string (e.g. value: "wireless headphones").
4. Every action targeting an element MUST specify a valid "elementId" that exists in the current sanitizedSchema.elements list.
5. If the goal is fully accomplished, set "done": true and return an empty actions array.
6. Allowed action types: "click", "type", "scroll", "wait".
   - "click": click an interactive element (buttons, links, checkboxes, options).
   - "type": type text or a placeholder token into an input or textarea. Specify "elementId" and "value".
   - "scroll": scroll the page (elementId can be null or a container).
   - "wait": wait for asynchronous loading/navigation.

OUTPUT FORMAT:
You MUST respond ONLY with a raw, valid JSON object matching this schema (do NOT include markdown code blocks, backticks, or extra commentary):
{
  "reasoning": "A concise explanation of your reasoning and observations for internal debug logs",
  "done": false,
  "actions": [
    {
      "type": "type",
      "elementId": "el_0",
      "value": "search query or {{FIELD:PLACEHOLDER}}"
    },
    {
      "type": "click",
      "elementId": "el_1",
      "value": null
    }
  ]
}`;

/**
 * Validates that an action plan matches the required JSON structure.
 * @param {object} plan
 * @param {Array<object>} elements - List of elements in the sanitized schema
 * @returns {{ valid: boolean, error?: string }}
 */
function validateActionPlan(plan, elements = []) {
  if (!plan || typeof plan !== 'object') {
    return { valid: false, error: 'Action plan must be a JSON object.' };
  }

  if (typeof plan.reasoning !== 'string') {
    return { valid: false, error: 'Action plan missing string "reasoning" property.' };
  }

  if (typeof plan.done !== 'boolean') {
    return { valid: false, error: 'Action plan missing boolean "done" property.' };
  }

  if (!Array.isArray(plan.actions)) {
    return { valid: false, error: 'Action plan missing array "actions" property.' };
  }

  const validElementIds = new Set(elements.map((e) => e.id));

  for (let i = 0; i < plan.actions.length; i++) {
    const action = plan.actions[i];
    if (!action || typeof action !== 'object') {
      return { valid: false, error: `Action at index ${i} is not an object.` };
    }

    if (!['click', 'type', 'scroll', 'wait'].includes(action.type)) {
      return {
        valid: false,
        error: `Action at index ${i} has invalid type "${action.type}". Allowed: click, type, scroll, wait.`
      };
    }

    if (action.type === 'type') {
      if (typeof action.value !== 'string') {
        return {
          valid: false,
          error: `Action at index ${i} (type) requires a string "value" property.`
        };
      }
      if (!action.elementId) {
        return {
          valid: false,
          error: `Action at index ${i} (type) requires a non-empty "elementId".`
        };
      }
    }

    if (action.elementId && validElementIds.size > 0 && !validElementIds.has(action.elementId)) {
      console.warn(`[Vidur Reasoner] Action targets elementId "${action.elementId}" not found in schema elements.`);
    }
  }

  return { valid: true };
}

/**
 * Parses JSON response from LLM, stripping possible markdown code blocks.
 * @param {string} rawText
 * @returns {object}
 */
function parseJSONResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty or non-string response from model.');
  }

  let cleaned = rawText.trim();
  // Remove markdown fences like ```json ... ``` or ``` ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  return JSON.parse(cleaned);
}

/**
 * Smart heuristic rule-based planner used as fallback when no API key is set.
 * Ensures offline/testing reliability without breaking development flow.
 * @param {string} task
 * @param {object} sanitizedSchema
 * @param {Array} actionHistory
 * @returns {object}
 */
function generateHeuristicPlan(task, sanitizedSchema, actionHistory = []) {
  const elements = sanitizedSchema.elements || [];
  const lowerTask = (task || '').toLowerCase();

  // 1. Search Tasks (e.g. "search for wireless headphones")
  if (lowerTask.includes('search') || lowerTask.includes('find') || lowerTask.includes('look for')) {
    const searchMatch = task.match(/(?:search(?:\s+for)?|find|look\s+for)\s+["']?([^"']+)["']?/i);
    const searchQuery = searchMatch ? searchMatch[1].trim() : task;

    const searchInput = elements.find(
      (e) =>
        e.type === 'search' ||
        (e.tag === 'input' && e.type === 'text' && /search|query|find|q/i.test(e.label || e.id || '')) ||
        (e.tag === 'input' && e.type === 'text')
    );

    const submitBtn = elements.find(
      (e) =>
        (e.tag === 'button' || (e.tag === 'input' && e.type === 'submit')) &&
        (/search|find|go|submit/i.test(e.label || '') || e.type === 'submit')
    );

    const actions = [];
    if (searchInput) {
      actions.push({
        type: 'type',
        elementId: searchInput.id,
        value: searchQuery
      });
    }
    if (submitBtn) {
      actions.push({
        type: 'click',
        elementId: submitBtn.id,
        value: null
      });
    }

    return {
      reasoning: `Identified search input ${searchInput ? searchInput.id : 'unknown'} and submit action. Typed "${searchQuery}" and triggered search.`,
      done: actions.length === 0,
      actions: actions
    };
  }

  // 2. Login Tasks (e.g. "log in with my account", "sign in", "login")
  if (
    lowerTask.includes('log in') ||
    lowerTask.includes('login') ||
    lowerTask.includes('sign in') ||
    lowerTask.includes('signin') ||
    lowerTask.includes('authenticate')
  ) {
    const emailInput = elements.find(
      (e) => e.type === 'email' || /email|username/i.test(e.label || '')
    );
    const passwordInput = elements.find(
      (e) => e.type === 'password' || /password/i.test(e.label || '')
    );
    const submitBtn = elements.find(
      (e) => e.type === 'submit' || /sign in|log in|submit/i.test(e.label || '')
    );

    const actions = [];
    if (emailInput) {
      actions.push({
        type: 'type',
        elementId: emailInput.id,
        value: emailInput.value && emailInput.value.startsWith('{{FIELD:') ? emailInput.value : '{{FIELD:EMAIL_1}}'
      });
    }
    if (passwordInput) {
      actions.push({
        type: 'type',
        elementId: passwordInput.id,
        value: passwordInput.value && passwordInput.value.startsWith('{{FIELD:') ? passwordInput.value : '{{FIELD:PASSWORD_1}}'
      });
    }
    if (submitBtn) {
      actions.push({
        type: 'click',
        elementId: submitBtn.id,
        value: null
      });
    }

    return {
      reasoning: 'Detected login credentials form. Populated email and password using privacy-preserving tokens, then clicked submit.',
      done: false,
      actions: actions
    };
  }

  // 3. Generic Action Fallback
  const firstInteractive = elements.find((e) => ['button', 'a', 'input'].includes(e.tag));
  return {
    reasoning: `Analyzing current viewport with ${elements.length} elements. Preparing next step for task: "${task}".`,
    done: false,
    actions: firstInteractive
      ? [{ type: 'click', elementId: firstInteractive.id, value: null }]
      : []
  };
}

/**
 * Main reasoning function to generate an action plan for a browser task.
 * @param {object} params
 * @param {string} params.task - The user's requested goal
 * @param {object} params.sanitizedSchema - The sanitized screen schema
 * @param {Array} [params.actionHistory=[]] - Previous actions in the loop
 * @returns {Promise<object>} Action plan JSON
 */
async function planAction({ task, sanitizedSchema, actionHistory = [] }) {
  const elements = sanitizedSchema?.elements || [];
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const modelName = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

  // Format schema payload for LLM (compact representation)
  const compactElements = elements.map((el) => ({
    id: el.id,
    tag: el.tag,
    role: el.role,
    label: el.label,
    type: el.type,
    autocomplete: el.autocomplete,
    value: el.value,
    text: el.text,
    bbox: el.bbox
  }));

  const userPrompt = JSON.stringify(
    {
      task: task,
      domain: sanitizedSchema.domain || 'unknown',
      viewport: sanitizedSchema.viewport || { width: 0, height: 0 },
      actionHistory: actionHistory,
      elements: compactElements
    },
    null,
    2
  );

  // If no Anthropic API key is provided, use the smart deterministic fallback
  if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
    console.log('[Vidur Reasoner] ANTHROPIC_API_KEY not configured. Using deterministic action planner.');
    const heuristicPlan = generateHeuristicPlan(task, sanitizedSchema, actionHistory);
    const validation = validateActionPlan(heuristicPlan, elements);
    if (!validation.valid) {
      throw new Error(`Heuristic action plan validation failed: ${validation.error}`);
    }
    return heuristicPlan;
  }

  // Initialize Anthropic client
  const client = new Anthropic({ apiKey });

  const messages = [
    {
      role: 'user',
      content: `Here is the current Screen Schema and the user task. Generate the next action plan.\n\n${userPrompt}`
    }
  ];

  let rawResponseText = '';
  let parsedPlan = null;
  let validation = { valid: false };

  // Attempt 1: Call Claude model
  try {
    const response = await client.messages.create({
      model: modelName,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages,
      temperature: 0.1
    });

    rawResponseText = response.content?.[0]?.text || '';
    parsedPlan = parseJSONResponse(rawResponseText);
    validation = validateActionPlan(parsedPlan, elements);
  } catch (err) {
    console.warn('[Vidur Reasoner] Initial LLM attempt encountered parsing or API error:', err.message);
    validation = { valid: false, error: err.message };
  }

  // Attempt 2 (Retry once if output was invalid or failed validation)
  if (!validation.valid) {
    console.log('[Vidur Reasoner] Retrying with error correction prompt...');
    try {
      messages.push({ role: 'assistant', content: rawResponseText || '{}' });
      messages.push({
        role: 'user',
        content: `Your previous response was invalid: ${validation.error || 'Failed to parse valid JSON'}. Please correct your response and output ONLY a valid JSON object matching { "reasoning": string, "done": boolean, "actions": [...] }.`
      });

      const retryResponse = await client.messages.create({
        model: modelName,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: messages,
        temperature: 0.1
      });

      const retryText = retryResponse.content?.[0]?.text || '';
      parsedPlan = parseJSONResponse(retryText);
      validation = validateActionPlan(parsedPlan, elements);

      if (!validation.valid) {
        throw new Error(`Model response validation failed after retry: ${validation.error}`);
      }
    } catch (retryErr) {
      console.warn('[Vidur Reasoner] Retry failed. Falling back to heuristic planner:', retryErr.message);
      parsedPlan = generateHeuristicPlan(task, sanitizedSchema, actionHistory);
    }
  }

  return parsedPlan;
}

module.exports = {
  SYSTEM_PROMPT,
  validateActionPlan,
  parseJSONResponse,
  generateHeuristicPlan,
  planAction
};
