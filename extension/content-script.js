/**
 * Vidur Extension - Content Script
 * Extracts structured accessibility & interactive DOM tree from the active page.
 */

console.log('[Vidur] Content script loaded');

/**
 * Checks if an element is currently visible in the viewport.
 * @param {Element} el
 * @param {DOMRect} rect
 * @returns {boolean}
 */
function isElementVisible(el, rect) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return false;

  // Check if within viewport coordinates
  const inViewport = (
    rect.bottom > 0 &&
    rect.top < window.innerHeight &&
    rect.right > 0 &&
    rect.left < window.innerWidth
  );
  if (!inViewport) return false;

  // Check computed CSS styles
  try {
    const style = window.getComputedStyle(el);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.visibility === 'collapse' ||
      parseFloat(style.opacity) === 0
    ) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

/**
 * Resolves the explicit or implicit ARIA role of an element.
 * @param {Element} el
 * @param {string} tag
 * @param {string|null} type
 * @returns {string|null}
 */
function resolveElementRole(el, tag, type) {
  const explicitRole = el.getAttribute('role');
  if (explicitRole) return explicitRole.trim();

  switch (tag) {
    case 'input': {
      const inputType = (type || 'text').toLowerCase();
      if (['button', 'submit', 'reset', 'image'].includes(inputType)) return 'button';
      if (['checkbox'].includes(inputType)) return 'checkbox';
      if (['radio'].includes(inputType)) return 'radio';
      if (['search'].includes(inputType)) return 'searchbox';
      if (['range'].includes(inputType)) return 'slider';
      if (['number', 'tel', 'email', 'url', 'text', 'password'].includes(inputType)) return 'textbox';
      return 'textbox';
    }
    case 'button':
      return 'button';
    case 'a':
      return el.hasAttribute('href') ? 'link' : null;
    case 'select':
      return 'combobox';
    case 'textarea':
      return 'textbox';
    case 'summary':
      return 'button';
    case 'dialog':
      return 'dialog';
    default:
      return null;
  }
}

/**
 * Extracts visible text content from a label node, ignoring child input elements.
 * @param {Element} labelNode
 * @returns {string}
 */
function getLabelNodeText(labelNode) {
  if (!labelNode) return '';
  // Clone node to safely remove input/select/textarea children before reading text
  try {
    const clone = labelNode.cloneNode(true);
    const inputs = clone.querySelectorAll('input, select, textarea, button');
    inputs.forEach(i => i.remove());
    return (clone.innerText || clone.textContent || '').trim();
  } catch {
    return (labelNode.innerText || labelNode.textContent || '').trim();
  }
}

/**
 * Safely queries a label by for="id" attribute.
 * @param {string} id
 * @returns {Element|null}
 */
function findLabelForId(id) {
  if (!id) return null;
  try {
    if (typeof CSS !== 'undefined' && CSS.escape) {
      return document.querySelector(`label[for="${CSS.escape(id)}"]`);
    }
    const escaped = id.replace(/(["'\\])/g, '\\$1');
    return document.querySelector(`label[for="${escaped}"]`);
  } catch {
    return null;
  }
}

/**
 * Resolves an accessible label for an element.
 * Checks aria-label, aria-labelledby, associated <label>, placeholder, title, and innerText.
 * @param {Element} el
 * @param {string} tag
 * @returns {string|null}
 */
function resolveElementLabel(el, tag) {
  // 1. Check aria-label
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) {
    return cleanLabel(ariaLabel);
  }

  // 2. Check aria-labelledby
  const ariaLabelledBy = el.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const ids = ariaLabelledBy.trim().split(/\s+/);
    const textParts = [];
    for (const id of ids) {
      const target = document.getElementById(id);
      if (target) {
        const text = (target.innerText || target.textContent || '').trim();
        if (text) textParts.push(text);
      }
    }
    if (textParts.length > 0) {
      return cleanLabel(textParts.join(' '));
    }
  }

  // 3. For form controls: check associated <label>, HTML5 labels, parent <label>, placeholder
  if (['input', 'select', 'textarea'].includes(tag)) {
    // Check <label for="id">
    if (el.id) {
      const labelFor = findLabelForId(el.id);
      if (labelFor) {
        const text = getLabelNodeText(labelFor);
        if (text) return cleanLabel(text);
      }
    }

    // HTML5 labels property
    if (el.labels && el.labels.length > 0) {
      const labelTexts = Array.from(el.labels)
        .map(l => getLabelNodeText(l))
        .filter(Boolean);
      if (labelTexts.length > 0) {
        return cleanLabel(labelTexts.join(' '));
      }
    }

    // Enclosing <label>
    const parentLabel = el.closest('label');
    if (parentLabel) {
      const text = getLabelNodeText(parentLabel);
      if (text) return cleanLabel(text);
    }

    // Placeholder
    const placeholder = el.getAttribute('placeholder');
    if (placeholder && placeholder.trim()) {
      return cleanLabel(placeholder);
    }
  }

  // 4. For buttons, links, summary: check innerText / textContent or child alt
  if (['button', 'a', 'summary'].includes(tag) || el.getAttribute('role') === 'button') {
    const text = (el.innerText || el.textContent || '').trim();
    if (text) {
      return cleanLabel(text);
    }

    // Check alt text of child images
    const imgChild = el.querySelector('img[alt]');
    if (imgChild) {
      const alt = imgChild.getAttribute('alt');
      if (alt && alt.trim()) {
        return cleanLabel(alt);
      }
    }
  }

  // 5. Check title attribute
  const title = el.getAttribute('title');
  if (title && title.trim()) {
    return cleanLabel(title);
  }

  // 6. Generic innerText fallback for meaningfully-labeled custom elements
  if (el.getAttribute('role') || el.hasAttribute('aria-label')) {
    const text = (el.innerText || el.textContent || '').trim();
    if (text) {
      return cleanLabel(text);
    }
  }

  return null;
}

/**
 * Truncates and cleans label string up to 100 characters.
 * @param {string} str
 * @returns {string|null}
 */
function cleanLabel(str) {
  if (!str) return null;
  const cleaned = str.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned.length > 100 ? cleaned.slice(0, 100) : cleaned;
}

/**
 * Determines if an element is interactive or meaningfully labeled.
 * Skips generic layout divs/spans with no role, no label, and no interactive behavior.
 * @param {Element} el
 * @param {string} tag
 * @param {string|null} role
 * @param {string|null} label
 * @returns {boolean}
 */
function isInteractiveOrMeaningful(el, tag, role, label) {
  // Standard interactive tags
  if (['input', 'button', 'select', 'textarea'].includes(tag)) {
    // Skip hidden inputs
    if (tag === 'input' && el.getAttribute('type') === 'hidden') {
      return false;
    }
    return true;
  }

  // Links with href
  if (tag === 'a' && el.hasAttribute('href')) {
    return true;
  }

  // Elements with explicit ARIA roles
  if (el.hasAttribute('role')) {
    const explicitRole = el.getAttribute('role');
    const interactiveRoles = [
      'button', 'link', 'checkbox', 'radio', 'textbox', 'searchbox',
      'combobox', 'listbox', 'option', 'tab', 'tabpanel', 'menuitem',
      'menuitemcheckbox', 'menuitemradio', 'switch', 'slider', 'dialog'
    ];
    if (interactiveRoles.includes(explicitRole) || label) {
      return true;
    }
  }

  // Elements with aria-label or aria-labelledby
  if (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')) {
    return true;
  }

  // Contenteditable
  if (el.getAttribute('contenteditable') === 'true') {
    return true;
  }

  // Tabindex >= 0
  const tabIndex = el.getAttribute('tabindex');
  if (tabIndex !== null && parseInt(tabIndex, 10) >= 0) {
    return true;
  }

  // Summary tag
  if (tag === 'summary') {
    return true;
  }

  return false;
}

/**
 * Walks the visible DOM and extracts structured accessibility tree metadata.
 * @returns {Array<object>}
 */
function extractAccessibilityTree() {
  const elements = [];
  const allElements = document.querySelectorAll(
    'input, button, select, textarea, a, summary, [role], [aria-label], [aria-labelledby], [contenteditable="true"], [tabindex]'
  );

  let idCounter = 0;

  for (const el of allElements) {
    const tag = el.tagName.toLowerCase();
    const rect = el.getBoundingClientRect();

    // Check viewport visibility
    if (!isElementVisible(el, rect)) {
      continue;
    }

    const typeAttr = el.getAttribute('type');
    const role = resolveElementRole(el, tag, typeAttr);
    const label = resolveElementLabel(el, tag);

    // Filter out non-interactive layout containers
    if (!isInteractiveOrMeaningful(el, tag, role, label)) {
      continue;
    }

    // Determine type
    let type = null;
    if (tag === 'input') {
      type = (typeAttr || el.type || 'text').toLowerCase();
    } else if (tag === 'select') {
      type = 'select';
    } else if (tag === 'textarea') {
      type = 'textarea';
    } else if (tag === 'button') {
      type = (typeAttr || 'button').toLowerCase();
    }

    // Determine value
    let value = null;
    if (['input', 'textarea', 'select'].includes(tag)) {
      if (type === 'checkbox' || type === 'radio') {
        value = el.checked ? (el.value || 'on') : null;
      } else {
        value = el.value !== undefined && el.value !== '' ? el.value : (el.getAttribute('value') || null);
      }
    }

    const autocomplete = el.getAttribute('autocomplete') || null;

    elements.push({
      id: `el_${idCounter++}`,
      tag: tag,
      role: role,
      label: label,
      type: type,
      autocomplete: autocomplete,
      bbox: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },
      value: value
    });
  }

  return elements;
}

// Attach extractAccessibilityTree globally for scripting.executeScript support
if (typeof window !== 'undefined') {
  window.extractAccessibilityTree = extractAccessibilityTree;
} else if (typeof globalThis !== 'undefined') {
  globalThis.extractAccessibilityTree = extractAccessibilityTree;
}

// Listener for runtime messages from background service worker
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Vidur Content Script] Received message:', message);

  if (message.type === 'EXTRACT_DOM' || message.type === 'CAPTURE' || message.type === 'CAPTURE_SCREEN') {
    try {
      const elements = extractAccessibilityTree();
      console.log(`[Vidur Content Script] Extracted ${elements.length} elements`);
      sendResponse({
        status: 'success',
        elements: elements,
        count: elements.length,
        url: window.location.href,
        title: document.title,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      });
    } catch (err) {
      console.error('[Vidur Content Script] Extraction failed:', err);
      sendResponse({
        status: 'error',
        message: err.message || 'Failed to extract DOM accessibility tree'
      });
    }
    return true;
  }
});
}


