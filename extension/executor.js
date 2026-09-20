/**
 * Vidur Extension - Local Action Executor & Token Resolver
 * Resolves privacy-preserving placeholder tokens securely on-device
 * and dispatches DOM actions into the active page context.
 */

(function (root) {
  'use strict';

/**
 * Resolves a placeholder token (e.g. {{FIELD:EMAIL_1}}) against local sources.
 * Resolution Order:
 *  1. Session placeholderMap (values captured directly from current page)
 *  2. Encrypted Profile Vault by category (e.g. {{FIELD:EMAIL_*}} -> vault.email)
 *  3. Returns null if unable to resolve (flags for skipped execution without guessing).
 *
 * @param {string} token
 * @param {object} [placeholderMap={}]
 * @param {object} [vaultProfile={}]
 * @returns {string|null} Resolved string value, or null if unresolvable
 */
function resolvePlaceholder(token, placeholderMap = {}, vaultProfile = {}) {
  if (!token || typeof token !== 'string') {
    return token ?? null;
  }

  // If not a placeholder format, return literal string
  if (!token.startsWith('{{FIELD:') || !token.endsWith('}}')) {
    return token;
  }

  // 1. Check local session placeholderMap
  if (placeholderMap && Object.prototype.hasOwnProperty.call(placeholderMap, token)) {
    const directVal = placeholderMap[token];
    if (directVal !== undefined && directVal !== null && directVal !== '') {
      return directVal;
    }
  }

  // 2. Extract Category from token (e.g. {{FIELD:EMAIL_1}} -> EMAIL)
  const match = token.match(/^\{\{FIELD:([A-Z_]+)(?:_\d+)?\}\}$/);
  if (!match) {
    return null;
  }

  const category = match[1].toUpperCase();
  const vault = vaultProfile || {};

  switch (category) {
    case 'EMAIL':
      return vault.email || null;
    case 'PHONE':
    case 'TEL':
      return vault.phone || null;
    case 'NAME':
    case 'FULL_NAME':
    case 'FIRST_NAME':
      return vault.name || null;
    case 'ADDRESS':
    case 'POSTAL_CODE':
    case 'ZIP':
      return vault.address || null;
    case 'PASSWORD':
      return vault.password || null;
    case 'GOVT_ID':
    case 'AADHAAR':
      return vault.govtId || vault.aadhaar || null;
    case 'CREDIT_CARD':
      return vault.creditCard || null;
    default:
      // Check direct property match on vault (case-insensitive)
      for (const [k, v] of Object.entries(vault)) {
        if (k.toUpperCase() === category && v) return v;
      }
      return null;
  }
}

/**
 * Checks if a click action targets a destructive, financial, or submit element
 * that warrants human approval for trust and safety.
 *
 * @param {object} action
 * @param {object} element
 * @returns {boolean}
 */
function isSensitiveAction(action, element = {}) {
  if (!action || action.type !== 'click') {
    return false;
  }

  const sensitivePattern = /\b(submit|pay|payment|confirm|checkout|place\s*order|complete\s*order|delete|remove|destroy|buy\s*now|subscribe|authorize)\b/i;

  // Check element label
  if (element.label && sensitivePattern.test(element.label)) {
    return true;
  }

  // Check element type (e.g. type="submit")
  if (element.type === 'submit') {
    return true;
  }

  // Check action value or extra metadata
  if (action.value && sensitivePattern.test(action.value)) {
    return true;
  }

  return false;
}

/**
 * Injected script function executed directly within the active web page context.
 * Targets elements using robust hybrid heuristics: element ID, tag+role+label matching,
 * and bounding-box center coordinates.
 *
 * @param {object} action - { type, elementId, value }
 * @param {object} targetElement - Metadata from Screen Schema { id, tag, role, label, type, bbox }
 * @param {string|null} resolvedValue - The decrypted/resolved text to type
 * @returns {object} { success: boolean, message?: string }
 */
function executeDOMActionInPage(action, targetElement, resolvedValue) {
  // Helper to find the target element in the DOM
  function findDOMElement(meta) {
    if (!meta) return null;

    // 1. Match by standard HTML ID attribute if present
    if (meta.id && document.getElementById(meta.id)) {
      return document.getElementById(meta.id);
    }

    // 2. Try elementFromPoint at center of recorded bounding box
    if (meta.bbox && meta.bbox.width > 0 && meta.bbox.height > 0) {
      const centerX = meta.bbox.x + meta.bbox.width / 2;
      const centerY = meta.bbox.y + meta.bbox.height / 2;

      const elAtPoint = document.elementFromPoint(centerX, centerY);
      if (elAtPoint) {
        if (!meta.tag || elAtPoint.tagName.toLowerCase() === meta.tag.toLowerCase()) {
          return elAtPoint;
        }
        const matchingChild = elAtPoint.querySelector(meta.tag || '*');
        if (matchingChild) return matchingChild;
        const matchingParent = elAtPoint.closest(meta.tag || '*');
        if (matchingParent) return matchingParent;
      }
    }

    // 3. Fallback to querying by tag and matching label / placeholder / name
    const candidates = Array.from(document.querySelectorAll(meta.tag || 'input, button, a, select, textarea'));
    for (const cand of candidates) {
      const candLabel = (
        cand.getAttribute('aria-label') ||
        cand.getAttribute('placeholder') ||
        cand.getAttribute('name') ||
        cand.innerText ||
        cand.textContent ||
        ''
      ).trim().toLowerCase();

      if (meta.label && candLabel.includes(meta.label.trim().toLowerCase())) {
        return cand;
      }
    }

    return candidates[0] || null;
  }

  const el = findDOMElement(targetElement);
  if (!el) {
    return {
      success: false,
      staleElement: true,
      error: `Could not locate DOM element for elementId "${action.elementId}" (${targetElement?.label || targetElement?.tag || 'unknown'}). Element may have changed dynamically.`
    };
  }

  try {
    // 1. CLICK Action
    if (action.type === 'click') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Dispatch full mouse event sequence
      const mouseEvents = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
      for (const eventName of mouseEvents) {
        const evt = new MouseEvent(eventName, {
          bubbles: true,
          cancelable: true,
          view: window
        });
        el.dispatchEvent(evt);
      }

      // Native .click() fallback
      if (typeof el.click === 'function') {
        el.click();
      }

      return {
        success: true,
        actionType: 'click',
        elementId: action.elementId,
        label: targetElement?.label || el.tagName
      };
    }

    // 2. TYPE Action
    if (action.type === 'type') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus();

      const textToType = resolvedValue !== null && resolvedValue !== undefined ? String(resolvedValue) : '';

      // Set input value using prototype setter to ensure React / Vue synthetic events trigger
      const proto = el.tagName.toLowerCase() === 'textarea'
        ? window.HTMLTextAreaElement.prototype
        : el.tagName.toLowerCase() === 'select'
        ? window.HTMLSelectElement.prototype
        : window.HTMLInputElement.prototype;

      const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
      if (descriptor && descriptor.set) {
        descriptor.set.call(el, textToType);
      } else {
        el.value = textToType;
      }

      // Dispatch keyboard and input events
      el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

      return {
        success: true,
        actionType: 'type',
        elementId: action.elementId,
        typedLength: textToType.length
      };
    }

    // 3. SCROLL Action
    if (action.type === 'scroll') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return {
        success: true,
        actionType: 'scroll',
        elementId: action.elementId
      };
    }

    // 4. WAIT Action
    if (action.type === 'wait') {
      return {
        success: true,
        actionType: 'wait'
      };
    }

    return {
      success: false,
      error: `Unsupported action type: ${action.type}`
    };
  } catch (err) {
    return {
      success: false,
      error: `Execution error on element ${action.elementId}: ${err.message}`
    };
  }
}

/**
 * Executes a single action from an Action Plan on the specified browser tab.
 *
 * @param {number} tabId - Active Chrome tab ID
 * @param {object} action - { type: 'click'|'type'|'scroll'|'wait', elementId: string, value: string|null }
 * @param {object} screenSchema - Current Screen Schema
 * @param {object} options - { placeholderMap, vaultProfile, approved }
 * @returns {Promise<object>} Execution result
 */
async function executeAction(tabId, action, screenSchema, options = {}) {
  const { placeholderMap = {}, vaultProfile = {}, approved = false } = options;
  const elements = screenSchema?.elements || [];
  const targetElement = elements.find((e) => e.id === action.elementId) || null;

  // 1. Safety Check: Sensitive Click Actions Require User Approval
  if (action.type === 'click' && isSensitiveAction(action, targetElement)) {
    if (!approved) {
      return {
        success: false,
        requiresApproval: true,
        action: action,
        element: targetElement,
        reason: `Action requires user confirmation: "${targetElement?.label || 'Submit Action'}" is a sensitive operation.`
      };
    }
  }

  // 2. Token Resolution for "type" actions
  let resolvedValue = null;
  let resolutionSource = null;

  if (action.type === 'type') {
    if (!action.value) {
      return {
        success: false,
        skipped: true,
        error: `Type action missing value on element ${action.elementId}`
      };
    }

    resolvedValue = resolvePlaceholder(action.value, placeholderMap, vaultProfile);

    if (resolvedValue === null) {
      // Resolution failure: Skip action and report to agent log rather than hallucinating
      return {
        success: false,
        skipped: true,
        token: action.value,
        error: `Failed to resolve placeholder token "${action.value}" from local vault or page map. Action skipped.`
      };
    }

    if (action.value.startsWith('{{FIELD:')) {
      resolutionSource = placeholderMap[action.value] ? 'session_placeholder_map' : 'encrypted_vault';
    }
  }

  // 3. Handle "wait" action locally without script injection
  if (action.type === 'wait') {
    await new Promise((res) => setTimeout(res, 1000));
    return {
      success: true,
      actionType: 'wait',
      duration: 1000
    };
  }

  // 4. Inject and execute in target page context
  try {
    if (typeof chrome !== 'undefined' && chrome.scripting && chrome.scripting.executeScript) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: executeDOMActionInPage,
        args: [action, targetElement, resolvedValue]
      });

      const execResult = results?.[0]?.result || { success: false, error: 'No response from script injection.' };

      return {
        ...execResult,
        resolvedToken: action.value?.startsWith('{{FIELD:') ? action.value : null,
        resolutionSource: resolutionSource
      };
    } else {
      // Fallback for Node.js / offline test environments
      return {
        success: true,
        actionType: action.type,
        elementId: action.elementId,
        resolvedValue: resolvedValue,
        resolutionSource: resolutionSource
      };
    }
  } catch (err) {
    return {
      success: false,
      error: `Failed to execute action via chrome.scripting: ${err.message}`
    };
  }
}

  const VidurExecutor = {
    resolvePlaceholder,
    isSensitiveAction,
    executeDOMActionInPage,
    executeAction
  };

  root.VidurExecutor = VidurExecutor;
  root.resolvePlaceholder = resolvePlaceholder;
  root.isSensitiveAction = isSensitiveAction;
  root.executeDOMActionInPage = executeDOMActionInPage;
  root.executeAction = executeAction;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = VidurExecutor;
  }
})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : globalThis);

