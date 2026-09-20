/**
 * Vidur Extension - Encrypted Profile Vault
 * Securely stores user profile data (email, name, phone, address, credentials)
 * in IndexedDB using WebCrypto SubtleCrypto (AES-GCM 256-bit + PBKDF2 key derivation).
 * The encryption key is derived on the fly from a user passphrase and NEVER stored in plaintext.
 */

const VAULT_DB_NAME = 'VidurVaultDB';
const VAULT_DB_VERSION = 1;
const VAULT_STORE_NAME = 'profile_vault';
const VAULT_RECORD_KEY = 'encrypted_profile';

const PBKDF2_ITERATIONS = 100000;
const SALT_BYTE_LENGTH = 16;
const IV_BYTE_LENGTH = 12; // Standard for AES-GCM

// In-memory unlocked profile cache during active session
let inMemoryProfile = null;
let inMemoryKey = null;

/**
 * Opens the IndexedDB database for the profile vault.
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
        db.createObjectStore(VAULT_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Failed to open Vidur Vault database.'));
  });
}

/**
 * Derives an AES-GCM 256-bit CryptoKey from a passphrase and salt using PBKDF2.
 * @param {string} passphrase
 * @param {Uint8Array} salt
 * @returns {Promise<CryptoKey>}
 */
async function deriveKeyFromPassphrase(passphrase, salt) {
  const enc = new TextEncoder();
  const passphraseBytes = enc.encode(passphrase);

  // Import raw passphrase as key material
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passphraseBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive AES-GCM 256-bit encryption/decryption key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts an object using AES-GCM with a derived key.
 * @param {object} data
 * @param {CryptoKey} key
 * @returns {Promise<{ iv: Uint8Array, ciphertext: ArrayBuffer }>}
 */
async function encryptData(data, key) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH));
  const enc = new TextEncoder();
  const plaintextBytes = enc.encode(JSON.stringify(data));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    plaintextBytes
  );

  return { iv, ciphertext };
}

/**
 * Decrypts ciphertext using AES-GCM with a derived key.
 * @param {ArrayBuffer} ciphertext
 * @param {Uint8Array} iv
 * @param {CryptoKey} key
 * @returns {Promise<object>}
 */
async function decryptData(ciphertext, iv, key) {
  const decryptedBytes = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    ciphertext
  );

  const dec = new TextDecoder();
  const jsonString = dec.decode(decryptedBytes);
  return JSON.parse(jsonString);
}

/**
 * Checks if the vault has been set up in IndexedDB.
 * @returns {Promise<boolean>}
 */
async function isVaultConfigured() {
  try {
    const db = await openVaultDB();
    return new Promise((resolve) => {
      const tx = db.transaction(VAULT_STORE_NAME, 'readonly');
      const store = tx.objectStore(VAULT_STORE_NAME);
      const req = store.get(VAULT_RECORD_KEY);

      req.onsuccess = () => {
        resolve(Boolean(req.result && req.result.ciphertext));
      };
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Checks if the vault is currently unlocked in memory.
 * @returns {boolean}
 */
function isVaultUnlocked() {
  return inMemoryProfile !== null && inMemoryKey !== null;
}

/**
 * Gets the current in-memory decrypted profile.
 * @returns {object|null}
 */
function getDecryptedProfile() {
  return inMemoryProfile;
}

/**
 * Locks the vault by wiping the in-memory key and decrypted profile.
 */
function lockVault() {
  inMemoryProfile = null;
  inMemoryKey = null;
  console.log('[Vidur Vault] Vault locked and memory wiped.');
}

/**
 * Sets up a new profile vault or overwrites the existing vault with a new passphrase.
 * @param {string} passphrase
 * @param {object} profileData - { name, email, phone, address, password, govtId }
 * @returns {Promise<{ success: boolean }>}
 */
async function setupVault(passphrase, profileData) {
  if (!passphrase || passphrase.length < 4) {
    throw new Error('Passphrase must be at least 4 characters long.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTE_LENGTH));
  const key = await deriveKeyFromPassphrase(passphrase, salt);
  const { iv, ciphertext } = await encryptData(profileData || {}, key);

  const db = await openVaultDB();

  await new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE_NAME, 'readwrite');
    const store = tx.objectStore(VAULT_STORE_NAME);
    const record = {
      id: VAULT_RECORD_KEY,
      salt: Array.from(salt),
      iv: Array.from(iv),
      ciphertext: ciphertext,
      updatedAt: new Date().toISOString()
    };
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(new Error('Failed to save encrypted vault to IndexedDB.'));
  });

  // Store in memory
  inMemoryProfile = { ...profileData };
  inMemoryKey = key;

  console.log('[Vidur Vault] Profile vault successfully configured & unlocked.');
  return { success: true };
}

/**
 * Unlocks the vault using the user passphrase.
 * @param {string} passphrase
 * @returns {Promise<{ success: boolean, profile: object }>}
 */
async function unlockVault(passphrase) {
  if (!passphrase) {
    throw new Error('Please provide a passphrase to unlock the vault.');
  }

  const db = await openVaultDB();

  const record = await new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE_NAME, 'readonly');
    const store = tx.objectStore(VAULT_STORE_NAME);
    const req = store.get(VAULT_RECORD_KEY);

    req.onsuccess = () => {
      if (!req.result) return reject(new Error('No vault configured yet. Please set up your vault first.'));
      resolve(req.result);
    };
    req.onerror = () => reject(new Error('Failed to read vault from storage.'));
  });

  const salt = new Uint8Array(record.salt);
  const iv = new Uint8Array(record.iv);
  const ciphertext = record.ciphertext;

  const key = await deriveKeyFromPassphrase(passphrase, salt);

  try {
    const profile = await decryptData(ciphertext, iv, key);
    inMemoryProfile = profile;
    inMemoryKey = key;
    console.log('[Vidur Vault] Vault successfully unlocked.');
    return { success: true, profile };
  } catch {
    throw new Error('Incorrect passphrase. Could not decrypt profile vault.');
  }
}

/**
 * Updates the profile data in the already-unlocked vault.
 * @param {object} updatedProfileData
 * @returns {Promise<{ success: boolean }>}
 */
async function updateVaultProfile(updatedProfileData) {
  if (!isVaultUnlocked() || !inMemoryKey) {
    throw new Error('Vault must be unlocked before updating profile.');
  }

  const db = await openVaultDB();

  const record = await new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE_NAME, 'readonly');
    const store = tx.objectStore(VAULT_STORE_NAME);
    const req = store.get(VAULT_RECORD_KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('Failed to read vault record.'));
  });

  const { iv, ciphertext } = await encryptData(updatedProfileData, inMemoryKey);

  await new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE_NAME, 'readwrite');
    const store = tx.objectStore(VAULT_STORE_NAME);
    record.iv = Array.from(iv);
    record.ciphertext = ciphertext;
    record.updatedAt = new Date().toISOString();

    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(new Error('Failed to update encrypted vault.'));
  });

  inMemoryProfile = { ...updatedProfileData };
  return { success: true };
}

// Global and module exports
if (typeof window !== 'undefined') {
  window.VidurVault = {
    isVaultConfigured,
    isVaultUnlocked,
    getDecryptedProfile,
    lockVault,
    setupVault,
    unlockVault,
    updateVaultProfile
  };
} else if (typeof globalThis !== 'undefined') {
  globalThis.VidurVault = {
    isVaultConfigured,
    isVaultUnlocked,
    getDecryptedProfile,
    lockVault,
    setupVault,
    unlockVault,
    updateVaultProfile
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isVaultConfigured,
    isVaultUnlocked,
    getDecryptedProfile,
    lockVault,
    setupVault,
    unlockVault,
    updateVaultProfile,
    deriveKeyFromPassphrase,
    encryptData,
    decryptData
  };
}
