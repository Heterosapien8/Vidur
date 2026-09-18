/**
 * Vidur Extension - Popup Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  const captureBtn = document.getElementById('captureBtn');
  const statusContainer = document.getElementById('status');
  const statusText = document.getElementById('statusText');

  function setStatus(text, type = 'pending') {
    statusContainer.style.display = 'flex';
    statusContainer.className = `status-container ${type}`;
    statusText.textContent = text;
  }

  captureBtn.addEventListener('click', async () => {
    captureBtn.disabled = true;
    setStatus('Sending capture signal...', 'pending');

    try {
      chrome.runtime.sendMessage({ type: 'CAPTURE_SCREEN' }, (response) => {
        captureBtn.disabled = false;

        if (chrome.runtime.lastError) {
          console.error('[Vidur Popup] Runtime error:', chrome.runtime.lastError);
          setStatus(chrome.runtime.lastError.message || 'Failed to send message', 'error');
          return;
        }

        if (response && response.status === 'error') {
          setStatus(response.message || 'Capture request failed', 'error');
          return;
        }

        console.log('[Vidur Popup] Response received:', response);
        setStatus('Signal sent to active tab!', 'success');

        // Reset status message after 3 seconds
        setTimeout(() => {
          if (statusText.textContent === 'Signal sent to active tab!') {
            statusContainer.style.display = 'none';
          }
        }, 3000);
      });
    } catch (err) {
      captureBtn.disabled = false;
      console.error('[Vidur Popup] Exception:', err);
      setStatus(err.message || 'Unexpected error occurred', 'error');
    }
  });
});
