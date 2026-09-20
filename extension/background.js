/**
 * Vidur Extension - Background Service Worker
 * Handles screen captures and coordinates DOM tree extraction with content script.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Vidur Background] Extension installed successfully.');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Vidur Background] Message received:', message);

  const isCaptureMessage =
    message === 'CAPTURE' ||
    (message && (message.type === 'CAPTURE' || message.type === 'CAPTURE_SCREEN'));

  if (isCaptureMessage) {
    handleCaptureRequest()
      .then((result) => sendResponse(result))
      .catch((err) => {
        console.error('[Vidur Background] Capture error:', err);
        sendResponse({
          status: 'error',
          message: err.message || 'An unexpected error occurred during capture.'
        });
      });

    // Return true to indicate asynchronous response
    return true;
  }
});

/**
 * Executes full capture workflow: tab validation, screenshot capture, and DOM extraction.
 * @returns {Promise<object>}
 */
async function handleCaptureRequest() {
  // 1. Get active tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || tabs.length === 0 || !tabs[0].id) {
    throw new Error('No active browser tab found.');
  }

  const activeTab = tabs[0];
  const url = activeTab.url || '';

  // 2. Validate URL - cannot capture internal or restricted pages
  if (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('devtools://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('view-source:')
  ) {
    throw new Error(
      'Cannot capture internal browser system pages (e.g. chrome://, extensions, new tab). Please navigate to a standard web page (e.g. https://example.com) to capture.'
    );
  }

  // 3. Capture visible tab screenshot
  let screenshot = null;
  try {
    screenshot = await chrome.tabs.captureVisibleTab(activeTab.windowId, {
      format: 'png'
    });
  } catch (err) {
    throw new Error(`Failed to capture screenshot: ${err.message}`);
  }

  // 4. Extract DOM accessibility tree from content script
  let domResult = null;

  try {
    // Attempt direct message to content script
    domResult = await sendTabMessage(activeTab.id, { type: 'EXTRACT_DOM' });
  } catch {
    // If content script was not already loaded (e.g. tab opened before extension installed), inject it dynamically
    console.log('[Vidur Background] Content script not responding, injecting programmatically...');
    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['content-script.js']
      });

      // Retry sending message after injection
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
