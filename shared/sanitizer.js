/**
 * Vidur Privacy Sanitization Module
 * Detects and redacts Personally Identifiable Information (PII) before cloud transmission.
 */

/**
 * Validates a number string using the Luhn Algorithm (Mod 10).
 * Standard for credit cards (Visa, MasterCard, Amex, Discover, RuPay, etc.).
 * @param {string} numStr
 * @returns {boolean}
 */
function isValidLuhn(numStr) {
  if (!numStr) return false;
  const cleaned = numStr.replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(cleaned)) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned.charAt(i), 10);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Checks if a string matches a valid Indian Aadhaar number format.
 * 12 digits, cannot start with 0 or 1, optionally separated by spaces or hyphens every 4 digits.
 * @param {string} str
 * @returns {boolean}
 */
function isAadhaarNumber(str) {
  if (!str) return false;
  const cleaned = str.replace(/[\s-]/g, '');
  if (!/^[2-9]\d{11}$/.test(cleaned)) return false;

  // Reject obvious repeated digits like 999999999999 or 222222222222
  if (/^(\d)\1{11}$/.test(cleaned)) return false;

  return true;
}

/**
 * Checks if a string matches an email address format.
 * @param {string} str
 * @returns {boolean}
 */
function isEmailAddress(str) {
  if (!str) return false;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(str.trim());
}

/**
 * Checks if a string matches a phone number format (10 to 15 digits with optional country code).
 * @param {string} str
 * @returns {boolean}
 */
function isPhoneNumber(str) {
  if (!str) return false;
  const cleaned = str.replace(/[\s().+-]/g, '');
  // Phone numbers usually have 10-15 digits
  if (!/^\d{10,15}$/.test(cleaned)) return false;

  // Exclude credit cards or aadhaar from being misclassified as generic phone
  if (isValidLuhn(str)) return false;
  if (isAadhaarNumber(str)) return false;

  return true;
}

/**
 * Detects the PII category for a given DOM/OCR element and its value/text.
 * @param {object} element - Schema element
 * @param {string} valueOrText - Content to evaluate
 * @returns {'EMAIL'|'PHONE'|'PASSWORD'|'CREDIT_CARD'|'NAME'|'ADDRESS'|'GOVT_ID'|'GENERIC_SENSITIVE'|null}
 */
function detectPIICategory(element, valueOrText) {
  const type = (element.type || '').toLowerCase();
  const autocomplete = (element.autocomplete || '').toLowerCase();
  const label = (element.label || '').toLowerCase();
  const rawValue = (valueOrText || '').trim();

  // 1. PASSWORD: Always redact unconditionally
  if (type === 'password' || autocomplete.includes('password') || /^(password|current-password|new-password)$/i.test(autocomplete)) {
    return 'PASSWORD';
  }

  // If there is no value or text, nothing to redact
  if (!rawValue) {
    return null;
  }

  // 2. EMAIL
  if (type === 'email' || autocomplete.includes('email') || isEmailAddress(rawValue)) {
    return 'EMAIL';
  }

  // 3. CREDIT CARD (Luhn check or cc autocomplete)
  if (
    autocomplete.includes('cc-number') ||
    autocomplete.includes('cc-') ||
    /credit.?card|card.?number|debit.?card/i.test(label) ||
    isValidLuhn(rawValue)
  ) {
    if (isValidLuhn(rawValue) || /^\d{13,19}$/.test(rawValue.replace(/[\s-]/g, '')) || autocomplete.includes('cc-number')) {
      return 'CREDIT_CARD';
    }
  }

  // 4. GOVT_ID / AADHAAR
  if (isAadhaarNumber(rawValue) || /aadhaar|aadhar|govt.?id|national.?id|pan.?card|ssn/i.test(label)) {
    if (isAadhaarNumber(rawValue) || /^\d{9,12}$/.test(rawValue.replace(/[\s-]/g, ''))) {
      return 'GOVT_ID';
    }
  }

  // 5. PHONE
  if (type === 'tel' || autocomplete.includes('tel') || isPhoneNumber(rawValue)) {
    return 'PHONE';
  }

  // 6. NAME (Redact value, keep label)
  if (
    ['name', 'given-name', 'family-name', 'additional-name', 'nickname', 'username'].includes(autocomplete) ||
    (type === 'text' && /^(full.?name|first.?name|last.?name)$/i.test(label) && rawValue.length > 1)
  ) {
    return 'NAME';
  }

  // 7. ADDRESS
  if (
    autocomplete.startsWith('address-') ||
    ['postal-code', 'country', 'country-name', 'street-address', 'address-line1', 'address-line2'].includes(autocomplete)
  ) {
    return 'ADDRESS';
  }

  // 8. GENERIC_SENSITIVE: autocomplete="off" + text type + sensitive label
  if (
    autocomplete === 'off' &&
    (type === 'text' || !type) &&
    /ssn|passport|account.?number|tax.?id|pin|cvv|secret|token/i.test(label)
  ) {
    return 'GENERIC_SENSITIVE';
  }

  return null;
}

/**
 * Sanitizes a Screen Schema by replacing all PII values/text with scoped placeholders.
 * Returns the sanitized schema, the secret placeholder map, and statistics.
 * @param {object} screenSchema - The input Screen Schema
 * @param {string} [sessionId] - Optional session identifier
 * @returns {{ sanitizedSchema: object, placeholderMap: Record<string, string>, piiCount: number, piiCategories: Record<string, number>, sessionId: string }}
 */
function sanitizeSchema(screenSchema, sessionId) {
  if (!screenSchema) {
    return {
      sanitizedSchema: null,
      placeholderMap: {},
      piiCount: 0,
      piiCategories: {},
      sessionId: sessionId || `session_${Date.now()}`
    };
  }

  const sid = sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const placeholderMap = {};
  const piiCategories = {};
  const categoryCounters = {};
  let piiCount = 0;

  // Deep clone schema to prevent mutation of the original
  const sanitizedSchema = JSON.parse(JSON.stringify(screenSchema));

  if (Array.isArray(sanitizedSchema.elements)) {
    for (const el of sanitizedSchema.elements) {
      // Check element value
      if (el.value !== null && el.value !== undefined) {
        const category = detectPIICategory(el, String(el.value));
        if (category) {
          categoryCounters[category] = (categoryCounters[category] || 0) + 1;
          const index = categoryCounters[category];
          const placeholder = `{{FIELD:${category}_${index}}}`;

          placeholderMap[placeholder] = String(el.value);
          el.value = placeholder;

          piiCategories[category] = (piiCategories[category] || 0) + 1;
          piiCount++;
        }
      }

      // Check OCR element text
      if (el.source === 'ocr' && el.text) {
        const category = detectPIICategory(el, String(el.text));
        if (category) {
          categoryCounters[category] = (categoryCounters[category] || 0) + 1;
          const index = categoryCounters[category];
          const placeholder = `{{FIELD:${category}_${index}}}`;

          placeholderMap[placeholder] = String(el.text);
          el.text = placeholder;

          piiCategories[category] = (piiCategories[category] || 0) + 1;
          piiCount++;
        }
      }
    }
  }

  return {
    sanitizedSchema,
    placeholderMap,
    piiCount,
    piiCategories,
    sessionId: sid
  };
}

// -------------------------------------------------------------
// IndexedDB Local Secret Vault
// -------------------------------------------------------------

const VAULT_DB_NAME = 'VidurVaultDB';
const VAULT_STORE_NAME = 'placeholder_vaults';
const VAULT_DB_VERSION = 1;

/**
 * Opens or initializes the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
function openVaultDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported in this environment.'));
    }

    const request = indexedDB.open(VAULT_DB_NAME, VAULT_DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(VAULT_STORE_NAME)) {
        db.createObjectStore(VAULT_STORE_NAME, { keyPath: 'sessionId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Stores a placeholder map in the secure local IndexedDB vault.
 * @param {string} sessionId
 * @param {Record<string, string>} placeholderMap
 * @param {object} [metadata={}]
 * @returns {Promise<boolean>}
 */
async function storePlaceholderMap(sessionId, placeholderMap, metadata = {}) {
  if (!sessionId || !placeholderMap) return false;

  try {
    const db = await openVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(VAULT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(VAULT_STORE_NAME);

      const record = {
        sessionId,
        placeholderMap,
        metadata,
        createdAt: new Date().toISOString()
      };

      const request = store.put(record);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('[Vidur Vault] Error storing placeholder map in IndexedDB:', err);
    return false;
  }
}

/**
 * Retrieves a placeholder map from the IndexedDB vault by session ID.
 * @param {string} sessionId
 * @returns {Promise<Record<string, string>|null>}
 */
async function getPlaceholderMap(sessionId) {
  if (!sessionId) return null;

  try {
    const db = await openVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(VAULT_STORE_NAME, 'readonly');
      const store = tx.objectStore(VAULT_STORE_NAME);
      const request = store.get(sessionId);

      request.onsuccess = () => {
        const record = request.result;
        resolve(record ? record.placeholderMap : null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('[Vidur Vault] Error retrieving placeholder map from IndexedDB:', err);
    return null;
  }
}

// Export for browser and Node.js
if (typeof window !== 'undefined') {
  window.isValidLuhn = isValidLuhn;
  window.isAadhaarNumber = isAadhaarNumber;
  window.isEmailAddress = isEmailAddress;
  window.isPhoneNumber = isPhoneNumber;
  window.detectPIICategory = detectPIICategory;
  window.sanitizeSchema = sanitizeSchema;
  window.storePlaceholderMap = storePlaceholderMap;
  window.getPlaceholderMap = getPlaceholderMap;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isValidLuhn,
    isAadhaarNumber,
    isEmailAddress,
    isPhoneNumber,
    detectPIICategory,
    sanitizeSchema,
    storePlaceholderMap,
    getPlaceholderMap
  };
}
