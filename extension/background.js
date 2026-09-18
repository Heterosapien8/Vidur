/**
 * Vidur Extension - Background Service Worker
 * Listens for messages from the popup and forwards them to the active tab's content script.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Vidur Background] Extension installed successfully.');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Vidur Background] Received message:', message);

  if (message.type === 'CAPTURE_SCREEN') {
    // Find active tab in the current window
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || tabs.length === 0) {
        sendResponse({ status: 'error', message: 'No active tab found' });
        return;
      }

      const activeTab = tabs[0];

      // Check if URL is capturable (cannot inject on chrome:// or chrome-extension:// URLs)
      if (!activeTab.id || (activeTab.url && (activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('chrome-extension://')))) {
        sendResponse({
          status: 'error',
          message: 'Cannot capture internal Chrome system pages.'
        });
        return;
      }

      try {
        // Forward the message to the active tab's content script
        chrome.tabs.sendMessage(activeTab.id, message, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('[Vidur Background] Error sending message to tab:', chrome.runtime.lastError.message);
            sendResponse({
              status: 'error',
              message: chrome.runtime.lastError.message
            });
            return;
          }

          console.log('[Vidur Background] Response from content script:', response);
          sendResponse(response || { status: 'received_by_content_script' });
        });
      } catch (err) {
        console.error('[Vidur Background] Failed to forward message:', err);
        sendResponse({ status: 'error', message: err.message });
      }
    });

    // Return true to indicate asynchronous sendResponse
    return true;
  }
});
