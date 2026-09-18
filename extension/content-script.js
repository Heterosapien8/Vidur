/**
 * Vidur Extension - Content Script
 */

console.log('content script loaded');

// Listener for forwarded messages from background service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Vidur Content Script] Received message:', message);

  if (message.type === 'CAPTURE_SCREEN') {
    console.log('[Vidur Content Script] Capture screen signal received');
    sendResponse({
      status: 'received_by_content_script',
      timestamp: Date.now()
    });
  }
});
