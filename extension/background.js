/**
 * Vidur Extension - Background Service Worker & Orchestration Hub
 * Coordinates screen captures, privacy sanitization,
 * LLM action reasoning, and local autonomous execution loops.
 */

// Import service worker compatible modules safely
const modules = [
  'screen-schema.js',
  'sanitizer.js',
  'vault.js',
  'executor.js',
  'orchestrator.js'
];

for (const mod of modules) {
  try {
    importScripts(mod);
    console.log(`[Vidur Background] Loaded module: ${mod}`);
  } catch (err) {
    console.error(`[Vidur Background] Failed to load module ${mod}:`, err.message);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Vidur Background] Vidur Extension installed successfully.');
  if (chrome.sidePanel && typeof chrome.sidePanel.setPanelBehavior === 'function') {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
      console.log('[Vidur Background] SidePanel note:', err.message);
    });
  }
});

// Runtime Message Dispatcher
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return;

  const msgType = typeof message === 'string' ? message : message.type;

  // 1. CAPTURE / SCREENSHOT REQUEST
  if (msgType === 'CAPTURE' || msgType === 'CAPTURE_SCREEN') {
    handleCaptureRequest(message.tabId)
      .then((result) => sendResponse(result))
      .catch((err) => {
        console.warn('[Vidur Background] Capture error:', err.message);
        sendResponse({
          status: 'error',
          message: err.message || 'An unexpected error occurred during capture.'
        });
      });
    return true;
  }

  // 2. START AGENT LOOP
  if (msgType === 'START_AGENT' || msgType === 'START_AGENT_LOOP') {
    (async () => {
      try {
        let tabId = message.tabId;
        if (!tabId) {
          const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          if (!tabs || tabs.length === 0 || !tabs[0].id) {
            return sendResponse({ status: 'error', message: 'No active tab found.' });
          }
          tabId = tabs[0].id;
        }

        const task = message.task || 'Complete page task';
        const serverUrl = message.serverUrl || 'http://localhost:3000/plan-action';
        const demoMode = message.demoMode !== undefined ? message.demoMode : false;

        console.log(`[Vidur Background] Starting agent loop for tab ${tabId}, task: "${task}", demoMode: ${demoMode}`);
        const orchestrator = startOrchestration({ task, tabId, serverUrl, demoMode });
        sendResponse({ status: 'started', task, tabId, demoMode });
      } catch (err) {
        console.error('[Vidur Background] Start agent error:', err);
        sendResponse({ status: 'error', message: err.message });
      }
    })();
    return true;
  }

  // 3. STOP AGENT LOOP
  if (msgType === 'STOP_AGENT') {
    stopOrchestration();
    sendResponse({ status: 'stopped' });
    return true;
  }

  // 4. APPROVE / REJECT PENDING ACTION
  if (msgType === 'APPROVE_ACTION') {
    approvePendingAction(true);
    sendResponse({ status: 'approved' });
    return true;
  }

  if (msgType === 'REJECT_ACTION') {
    approvePendingAction(false);
    sendResponse({ status: 'rejected' });
    return true;
  }

  // 5. GET CURRENT AGENT STATUS
  if (msgType === 'GET_AGENT_STATUS') {
    const loop = getActiveLoop();
    sendResponse({
      status: loop ? loop.status : 'IDLE',
      iteration: loop ? loop.iteration : 0,
      task: loop ? loop.task : null,
      logs: loop ? loop.logs : [],
      actionHistory: loop ? loop.actionHistory : []
    });
    return true;
  }

  // 6. VAULT OPERATIONS
  if (msgType === 'GET_VAULT_STATUS') {
    (async () => {
      try {
        const configured = await isVaultConfigured();
        const unlocked = isVaultUnlocked();
        const profile = unlocked ? getDecryptedProfile() : null;
        sendResponse({ configured, unlocked, profile });
      } catch (err) {
        sendResponse({ configured: false, unlocked: false, error: err.message });
      }
    })();
    return true;
  }

  if (msgType === 'SETUP_VAULT') {
    (async () => {
      try {
        await setupVault(message.passphrase, message.profile);
        sendResponse({ status: 'success', unlocked: true, profile: message.profile });
      } catch (err) {
        sendResponse({ status: 'error', message: err.message });
      }
    })();
    return true;
  }

  if (msgType === 'UNLOCK_VAULT') {
    (async () => {
      try {
        const result = await unlockVault(message.passphrase);
        sendResponse({ status: 'success', unlocked: true, profile: result.profile });
      } catch (err) {
        sendResponse({ status: 'error', message: err.message });
      }
    })();
    return true;
  }

  if (msgType === 'LOCK_VAULT') {
    lockVault();
    sendResponse({ status: 'success', unlocked: false });
    return true;
  }

  if (msgType === 'UPDATE_VAULT_PROFILE') {
    (async () => {
      try {
        await updateVaultProfile(message.profile);
        sendResponse({ status: 'success', profile: message.profile });
      } catch (err) {
        sendResponse({ status: 'error', message: err.message });
      }
    })();
    return true;
  }
});

/**
 * Executes full capture workflow: tab validation, screenshot capture, and DOM extraction.
 * @param {number} [specificTabId]
 * @returns {Promise<object>}
 */
async function handleCaptureRequest(specificTabId) {
  let activeTab = null;

  if (specificTabId) {
    try {
      activeTab = await chrome.tabs.get(specificTabId);
    } catch {
      // Fallback
    }
  }

  if (!activeTab) {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tabs || tabs.length === 0 || !tabs[0].id) {
      throw new Error('No active browser tab found.');
    }
    activeTab = tabs[0];
  }

  const url = activeTab.url || '';

  // Validate URL - cannot capture internal or restricted pages
  if (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('devtools://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('view-source:')
  ) {
    throw new Error(
      'Cannot capture internal browser system pages (e.g. chrome://, extensions, new tab). Please navigate to a standard web page (e.g. http://localhost:3000/test/search-test.html) to capture.'
    );
  }

  // Capture visible tab screenshot
  let screenshot = null;
  try {
    screenshot = await chrome.tabs.captureVisibleTab(activeTab.windowId, {
      format: 'png'
    });
  } catch (err) {
    console.warn('[Vidur Background] Screenshot warning:', err.message);
  }

  // Extract DOM accessibility tree from content script
  let domResult = null;

  try {
    domResult = await sendTabMessage(activeTab.id, { type: 'EXTRACT_DOM' });
  } catch {
    console.log('[Vidur Background] Content script not responding, injecting programmatically...');
    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['content-script.js']
      });

      domResult = await sendTabMessage(activeTab.id, { type: 'EXTRACT_DOM' });
    } catch (injectionErr) {
      throw new Error(
        `Failed to communicate with page: ${injectionErr.message}. Make sure the tab is a valid web page and has finished loading.`
      );
    }
  }

  if (!domResult || domResult.status === 'error') {
    throw new Error(domResult?.message || 'Failed to extract DOM tree from the page.');
  }

  return {
    status: 'success',
    data: {
      screenshot: screenshot,
      elements: domResult.elements || [],
      count: domResult.count !== undefined ? domResult.count : (domResult.elements?.length || 0),
      url: activeTab.url,
      title: activeTab.title,
      timestamp: Date.now(),
      viewport: domResult.viewport || null
    }
  };
}

/**
 * Helper to send a message to a tab with Promise wrapper.
 * @param {number} tabId
 * @param {object} message
 * @returns {Promise<any>}
 */
function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      resolve(response);
    });
  });
}
