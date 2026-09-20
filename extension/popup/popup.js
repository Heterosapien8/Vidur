/**
 * Vidur Extension - Popup Controller
 * Coordinates Capture Layer, OCR Perception, and Unified Screen Schema generation.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const captureBtn = document.getElementById('captureBtn');
  const btnText = document.getElementById('btnText');
  const cameraIcon = document.getElementById('cameraIcon');
  const spinnerIcon = document.getElementById('spinnerIcon');

  const statusAlert = document.getElementById('statusAlert');
  const statusIcon = document.getElementById('statusIcon');
  const statusTitle = document.getElementById('statusTitle');
  const statusMessage = document.getElementById('statusMessage');

  const resultsSection = document.getElementById('resultsSection');
  const elementCountBadge = document.getElementById('elementCountBadge');
  const domCountBadge = document.getElementById('domCountBadge');
  const ocrCountBadge = document.getElementById('ocrCountBadge');
  const viewportBadge = document.getElementById('viewportBadge');
  const screenshotImg = document.getElementById('screenshotImg');
  const viewFullImageBtn = document.getElementById('viewFullImageBtn');

  const jsonContent = document.getElementById('jsonContent');
  const copyJsonBtn = document.getElementById('copyJsonBtn');
  const copyBtnText = document.getElementById('copyBtnText');

  let currentScreenshotData = null;
  let currentScreenSchema = null;
  let autoHideTimer = null;

  /**
   * Displays status or error alerts with appropriate styling.
   * @param {string} title
   * @param {string} message
   * @param {'info'|'error'|'success'} type
   * @param {boolean} autoHide
   */
  function showAlert(title, message, type = 'info', autoHide = false) {
    if (autoHideTimer) clearTimeout(autoHideTimer);

    statusAlert.style.display = 'flex';
    statusAlert.className = `alert-box ${type}`;

    if (type === 'error') {
      statusIcon.textContent = '⚠️';
    } else if (type === 'success') {
      statusIcon.textContent = '✅';
    } else {
      statusIcon.textContent = '⚡';
    }

    statusTitle.textContent = title;
    statusMessage.textContent = message;

    if (autoHide) {
      autoHideTimer = setTimeout(() => {
        statusAlert.style.display = 'none';
      }, 4000);
    }
  }

  function setLoading(isLoading, text = 'Capturing...') {
    captureBtn.disabled = isLoading;
    if (isLoading) {
      cameraIcon.style.display = 'none';
      spinnerIcon.style.display = 'inline-block';
      btnText.textContent = text;
    } else {
      cameraIcon.style.display = 'inline-block';
      spinnerIcon.style.display = 'none';
      btnText.textContent = resultsSection.style.display === 'flex' ? 'Re-Capture Screen' : 'Capture Screen';
    }
  }

  // Handle Capture button click
  captureBtn.addEventListener('click', async () => {
    setLoading(true, 'Capturing DOM & Screen...');
    showAlert('Capturing', 'Capturing viewport and extracting DOM accessibility tree...', 'info');

    try {
      chrome.runtime.sendMessage({ type: 'CAPTURE' }, async (response) => {
        if (chrome.runtime.lastError) {
          setLoading(false);
          console.error('[Vidur Popup] Runtime Error:', chrome.runtime.lastError);
          showAlert(
            'Capture Failed',
            chrome.runtime.lastError.message || 'Could not communicate with background worker.',
            'error'
          );
          return;
        }

        if (!response || response.status === 'error') {
          setLoading(false);
          console.error('[Vidur Popup] Response Error:', response);
          showAlert(
            'Cannot Capture Page',
            response?.message || 'Failed to capture the active tab.',
            'error'
          );
          return;
        }

        const data = response.data;
        if (!data || !data.screenshot) {
          setLoading(false);
          showAlert('Error', 'Received invalid capture payload.', 'error');
          return;
        }

        currentScreenshotData = data.screenshot;
        screenshotImg.src = data.screenshot;

        // 2. Run OCR Perception Layer
        setLoading(true, 'Running OCR Perception...');
        showAlert('Perception', 'Running Tesseract OCR on viewport screenshot...', 'info');

        let ocrResults = [];
        try {
          if (typeof runOCR === 'function') {
            ocrResults = await runOCR(data.screenshot);
          } else {
            console.warn('[Vidur Popup] runOCR function not available, proceeding without OCR.');
          }
        } catch (ocrErr) {
          console.warn('[Vidur Popup] OCR recognition encountered an issue, proceeding with DOM data:', ocrErr);
        }

        // 3. Build Unified Screen Schema
        const schema = buildScreenSchema(
          data.elements || [],
          ocrResults || [],
          data.viewport || { width: 0, height: 0 },
          data.url || ''
        );
        currentScreenSchema = schema;

        console.log('[Vidur Popup] Unified Screen Schema generated:', schema);

        // 4. Update UI with Schema Results
        const domCount = schema.elements.filter((e) => e.source === 'dom').length;
        const ocrCount = schema.elements.filter((e) => e.source === 'ocr').length;
        const totalCount = schema.elements.length;

        elementCountBadge.textContent = `${totalCount} Element${totalCount === 1 ? '' : 's'}`;
        domCountBadge.textContent = `${domCount} DOM`;
        ocrCountBadge.textContent = `${ocrCount} OCR`;

        if (schema.viewport) {
          viewportBadge.textContent = `${schema.viewport.width}×${schema.viewport.height} (${schema.domain})`;
        }

        // Render Formatted JSON
        jsonContent.textContent = JSON.stringify(schema, null, 2);

        // Display results
        resultsSection.style.display = 'flex';
        showAlert('Success', `Screen Schema generated (${domCount} DOM, ${ocrCount} OCR).`, 'success', true);
        setLoading(false);
      });
    } catch (err) {
      setLoading(false);
      console.error('[Vidur Popup] Exception:', err);
      showAlert('Error', err.message || 'Unexpected error occurred.', 'error');
    }
  });

  // Copy JSON to clipboard
  copyJsonBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Don't trigger <details> toggle
    const textToCopy = jsonContent.textContent;
    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy).then(() => {
      copyBtnText.textContent = 'Copied!';
      copyJsonBtn.style.borderColor = 'rgba(16, 185, 129, 0.6)';
      copyJsonBtn.style.color = '#34d399';

      setTimeout(() => {
        copyBtnText.textContent = 'Copy JSON';
        copyJsonBtn.style.borderColor = '';
        copyJsonBtn.style.color = '';
      }, 2000);
    }).catch((err) => {
      console.error('Clipboard copy failed:', err);
    });
  });

  // Open Full Image in new tab
  function openFullImage() {
    if (currentScreenshotData) {
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(
          `<!DOCTYPE html><html><head><title>Vidur Screenshot Preview</title><style>body{margin:0;background:#0f172a;display:flex;justify-content:center;align-items:center;min-height:100vh;}img{max-width:98vw;max-height:98vh;box-shadow:0 8px 30px rgba(0,0,0,0.7);border-radius:6px;}</style></head><body><img src="${currentScreenshotData}" alt="Captured Viewport" /></body></html>`
        );
      }
    }
  }

  viewFullImageBtn.addEventListener('click', openFullImage);
  screenshotImg.addEventListener('click', openFullImage);
});
