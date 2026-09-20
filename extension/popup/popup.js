/**
 * Vidur Extension - Popup Controller
 * Coordinates Autonomous Agent Loop, WebCrypto Encrypted Profile Vault,
 * and Screen Schema Capture Layer.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // --- TAB NAVIGATION ---
  const navAgentTab = document.getElementById('navAgentTab');
  const navVaultTab = document.getElementById('navVaultTab');
  const navSchemaTab = document.getElementById('navSchemaTab');

  const agentTabContent = document.getElementById('agentTabContent');
  const vaultTabContent = document.getElementById('vaultTabContent');
  const schemaTabContent = document.getElementById('schemaTabContent');

  function switchTab(activeNav, activeContent) {
    [navAgentTab, navVaultTab, navSchemaTab].forEach((t) => t.classList.remove('active'));
    [agentTabContent, vaultTabContent, schemaTabContent].forEach((c) => (c.style.display = 'none'));

    activeNav.classList.add('active');
    activeContent.style.display = 'flex';
  }

  navAgentTab.addEventListener('click', () => switchTab(navAgentTab, agentTabContent));
  navVaultTab.addEventListener('click', () => switchTab(navVaultTab, vaultTabContent));
  navSchemaTab.addEventListener('click', () => switchTab(navSchemaTab, schemaTabContent));

  // --- VAULT ELEMENTS & CONTROLLER ---
  const vaultStatusIndicator = document.getElementById('vaultStatusIndicator');
  const vaultMiniText = document.getElementById('vaultMiniText');
  const vaultAuthStatusIcon = document.getElementById('vaultAuthStatusIcon');
  const vaultAuthTitle = document.getElementById('vaultAuthTitle');
  const vaultAuthDesc = document.getElementById('vaultAuthDesc');
  const vaultPassphraseInput = document.getElementById('vaultPassphraseInput');
  const unlockVaultBtn = document.getElementById('unlockVaultBtn');
  const lockVaultBtn = document.getElementById('lockVaultBtn');
  const vaultAuthError = document.getElementById('vaultAuthError');

  const vaultProfileSection = document.getElementById('vaultProfileSection');
  const vaultName = document.getElementById('vaultName');
  const vaultEmail = document.getElementById('vaultEmail');
  const vaultPhone = document.getElementById('vaultPhone');
  const vaultAddress = document.getElementById('vaultAddress');
  const vaultPassword = document.getElementById('vaultPassword');
  const vaultGovtId = document.getElementById('vaultGovtId');
  const saveVaultProfileBtn = document.getElementById('saveVaultProfileBtn');

  let isConfigured = false;
  let isUnlocked = false;

  async function checkVaultState() {
    try {
      if (typeof VidurVault !== 'undefined') {
        isConfigured = await VidurVault.isVaultConfigured();
        isUnlocked = VidurVault.isVaultUnlocked();
      } else {
        const resp = await sendRuntimeMessage({ type: 'GET_VAULT_STATUS' });
        isConfigured = resp?.configured || false;
        isUnlocked = resp?.unlocked || false;
      }
    } catch {
      isConfigured = false;
      isUnlocked = false;
    }

    updateVaultUI();
  }

  function updateVaultUI() {
    if (isUnlocked) {
      vaultStatusIndicator.className = 'vault-mini-badge unlocked';
      vaultMiniText.textContent = 'Vault Unlocked';
      vaultAuthStatusIcon.textContent = '🔓';
      vaultAuthTitle.textContent = 'Profile Vault (Unlocked)';
      vaultAuthDesc.textContent = 'Your encrypted profile data is ready for autonomous token resolution.';
      unlockVaultBtn.style.display = 'none';
      lockVaultBtn.style.display = 'inline-block';
      vaultProfileSection.style.display = 'flex';
      vaultPassphraseInput.disabled = true;
      vaultAuthError.style.display = 'none';

      // Load profile fields
      const profile = (typeof VidurVault !== 'undefined' ? VidurVault.getDecryptedProfile() : null) || {};
      vaultName.value = profile.name || '';
      vaultEmail.value = profile.email || '';
      vaultPhone.value = profile.phone || '';
      vaultAddress.value = profile.address || '';
      vaultPassword.value = profile.password || '';
      vaultGovtId.value = profile.govtId || profile.aadhaar || '';
    } else {
      vaultStatusIndicator.className = 'vault-mini-badge locked';
      vaultMiniText.textContent = isConfigured ? 'Vault Locked' : 'Vault Not Set';
      vaultAuthStatusIcon.textContent = '🔒';
      vaultAuthTitle.textContent = isConfigured ? 'Profile Vault (Locked)' : 'Set Up Profile Vault';
      vaultAuthDesc.textContent = isConfigured
        ? 'Enter your passphrase to unlock your profile data.'
        : 'Choose a master passphrase to initialize your local encrypted vault.';
      unlockVaultBtn.textContent = isConfigured ? 'Unlock' : 'Create Vault';
      unlockVaultBtn.style.display = 'inline-block';
      lockVaultBtn.style.display = 'none';
      vaultProfileSection.style.display = 'none';
      vaultPassphraseInput.disabled = false;
    }
  }

  unlockVaultBtn.addEventListener('click', async () => {
    const passphrase = vaultPassphraseInput.value.trim();
    if (!passphrase || passphrase.length < 4) {
      vaultAuthError.textContent = 'Passphrase must be at least 4 characters.';
      vaultAuthError.style.display = 'block';
      return;
    }

    try {
      vaultAuthError.style.display = 'none';
      if (!isConfigured) {
        // Initial setup
        const defaultProfile = {
          name: 'Jane Doe',
          email: 'developer@vidur.ai',
          phone: '+1 555-0199',
          address: '123 Tech Avenue, Bengaluru',
          password: 'SuperSecretPassword123!',
          govtId: '2345 6789 0123'
        };

        if (typeof VidurVault !== 'undefined') {
          await VidurVault.setupVault(passphrase, defaultProfile);
        } else {
          await sendRuntimeMessage({ type: 'SETUP_VAULT', passphrase, profile: defaultProfile });
        }
        isConfigured = true;
        isUnlocked = true;
      } else {
        // Unlock existing
        if (typeof VidurVault !== 'undefined') {
          await VidurVault.unlockVault(passphrase);
        } else {
          await sendRuntimeMessage({ type: 'UNLOCK_VAULT', passphrase });
        }
        isUnlocked = true;
      }

      updateVaultUI();
    } catch (err) {
      vaultAuthError.textContent = err.message || 'Incorrect passphrase.';
      vaultAuthError.style.display = 'block';
    }
  });

  lockVaultBtn.addEventListener('click', () => {
    if (typeof VidurVault !== 'undefined') {
      VidurVault.lockVault();
    } else {
      sendRuntimeMessage({ type: 'LOCK_VAULT' });
    }
    isUnlocked = false;
    vaultPassphraseInput.value = '';
    updateVaultUI();
  });

  saveVaultProfileBtn.addEventListener('click', async () => {
    const profile = {
      name: vaultName.value.trim(),
      email: vaultEmail.value.trim(),
      phone: vaultPhone.value.trim(),
      address: vaultAddress.value.trim(),
      password: vaultPassword.value.trim(),
      govtId: vaultGovtId.value.trim()
    };

    try {
      if (typeof VidurVault !== 'undefined') {
        await VidurVault.updateVaultProfile(profile);
      } else {
        await sendRuntimeMessage({ type: 'UPDATE_VAULT_PROFILE', profile });
      }

      saveVaultProfileBtn.textContent = '✅ Saved & Encrypted!';
      setTimeout(() => {
        saveVaultProfileBtn.innerHTML = '<span>Save & Encrypt Profile</span>';
      }, 2000);
    } catch (err) {
      alert(`Failed to save vault: ${err.message}`);
    }
  });

  // --- AGENT TAB CONTROLLER ---
  const taskInput = document.getElementById('taskInput');
  const startAgentBtn = document.getElementById('startAgentBtn');
  const startAgentBtnText = document.getElementById('startAgentBtnText');
  const playIcon = document.getElementById('playIcon');
  const agentSpinner = document.getElementById('agentSpinner');
  const stopAgentBtn = document.getElementById('stopAgentBtn');

  const approvalBanner = document.getElementById('approvalBanner');
  const approvalReason = document.getElementById('approvalReason');
  const approvalActionType = document.getElementById('approvalActionType');
  const approvalActionLabel = document.getElementById('approvalActionLabel');
  const approveActionBtn = document.getElementById('approveActionBtn');
  const rejectActionBtn = document.getElementById('rejectActionBtn');

  const agentStatusBar = document.getElementById('agentStatusBar');
  const agentStatusDot = document.getElementById('agentStatusDot');
  const agentStatusText = document.getElementById('agentStatusText');
  const iterationBadge = document.getElementById('iterationBadge');

  const agentLogFeed = document.getElementById('agentLogFeed');
  const logCountBadge = document.getElementById('logCountBadge');
  const clearLogBtn = document.getElementById('clearLogBtn');

  let logEventsCount = 0;
  let isAgentRunning = false;

  // Preset buttons
  document.querySelectorAll('.preset-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      taskInput.value = btn.getAttribute('data-task') || '';
      taskInput.focus();
    });
  });

  function setAgentRunning(running) {
    isAgentRunning = running;
    if (running) {
      playIcon.style.display = 'none';
      agentSpinner.style.display = 'inline-block';
      startAgentBtnText.textContent = 'Agent Running...';
      startAgentBtn.disabled = true;
      stopAgentBtn.style.display = 'flex';
      agentStatusBar.style.display = 'flex';
      agentStatusDot.className = 'status-dot running';
      agentStatusText.textContent = 'Agent active...';
    } else {
      playIcon.style.display = 'inline-block';
      agentSpinner.style.display = 'none';
      startAgentBtnText.textContent = 'Start Autonomous Agent';
      startAgentBtn.disabled = false;
      stopAgentBtn.style.display = 'none';
      approvalBanner.style.display = 'none';
    }
  }

  function appendLogItem(logData) {
    // Clear empty state
    const emptyState = agentLogFeed.querySelector('.empty-log-state');
    if (emptyState) emptyState.remove();

    logEventsCount++;
    logCountBadge.textContent = `${logEventsCount} event${logEventsCount === 1 ? '' : 's'}`;

    const item = document.createElement('div');
    const logType = logData.logType || 'INFO';
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    item.className = 'log-item';

    if (logType === 'PLAN_RECEIVED') {
      item.classList.add('reasoning');
      item.innerHTML = `
        <div class="log-header-row">
          <span class="log-tag" style="background:#4f46e5;color:#fff;">🧠 LLM Reasoning</span>
          <span class="log-time">${timeStr}</span>
        </div>
        <div class="log-body">${escapeHTML(logData.reasoning || logData.message)}</div>
      `;
    } else if (logType === 'ACTION_EXECUTED') {
      item.classList.add('action');
      const action = logData.action || {};
      const tokenChip = logData.result?.resolvedToken
        ? `<div class="log-token-chip">🛡️ Resolved ${escapeHTML(logData.result.resolvedToken)} via ${escapeHTML(logData.result.resolutionSource || 'vault')}</div>`
        : '';

      item.innerHTML = `
        <div class="log-header-row">
          <span class="log-tag" style="background:#0284c7;color:#fff;">▶ Action: ${escapeHTML((action.type || 'EXEC').toUpperCase())}</span>
          <span class="log-time">${timeStr}</span>
        </div>
        <div class="log-body">Target: <b>#${escapeHTML(action.elementId || '')}</b> ${action.value ? `| Value: <i>"${escapeHTML(action.value)}"</i>` : ''}</div>
        ${tokenChip}
      `;
    } else if (logType === 'PII_REDACTED') {
      item.classList.add('pii');
      item.innerHTML = `
        <div class="log-header-row">
          <span class="log-tag" style="background:#059669;color:#fff;">🛡️ Privacy Guard</span>
          <span class="log-time">${timeStr}</span>
        </div>
        <div class="log-body">${escapeHTML(logData.message)}</div>
      `;
    } else if (logType === 'SUCCESS') {
      item.classList.add('success');
      item.innerHTML = `
        <div class="log-header-row">
          <span class="log-tag" style="background:#10b981;color:#fff;">🎉 Task Done</span>
          <span class="log-time">${timeStr}</span>
        </div>
        <div class="log-body">${escapeHTML(logData.message)}</div>
      `;
    } else if (logType === 'ERROR' || logType === 'ACTION_FAILED') {
      item.classList.add('error');
      item.innerHTML = `
        <div class="log-header-row">
          <span class="log-tag" style="background:#dc2626;color:#fff;">⚠️ Alert</span>
          <span class="log-time">${timeStr}</span>
        </div>
        <div class="log-body">${escapeHTML(logData.message || logData.error)}</div>
      `;
    } else {
      item.innerHTML = `
        <div class="log-header-row">
          <span class="log-tag">${escapeHTML(logType)}</span>
          <span class="log-time">${timeStr}</span>
        </div>
        <div class="log-body">${escapeHTML(logData.message || JSON.stringify(logData))}</div>
      `;
    }

    agentLogFeed.appendChild(item);
    agentLogFeed.scrollTop = agentLogFeed.scrollHeight;
  }

  clearLogBtn.addEventListener('click', () => {
    logEventsCount = 0;
    logCountBadge.textContent = '0 events';
    agentLogFeed.innerHTML = `
      <div class="empty-log-state">
        <span class="empty-icon">⚡</span>
        <span>Log cleared. Ready for next run.</span>
      </div>
    `;
  });

  // Start Agent Loop
  startAgentBtn.addEventListener('click', async () => {
    const task = taskInput.value.trim();
    if (!task) {
      alert('Please enter an automation task.');
      return;
    }

    // Auto-unlock demo vault if not configured
    if (!isUnlocked) {
      try {
        if (typeof VidurVault !== 'undefined') {
          await VidurVault.setupVault('password123', {
            name: 'Jane Doe',
            email: 'developer@vidur.ai',
            phone: '+1 555-0199',
            address: '123 Tech Blvd',
            password: 'SuperSecretPassword123!',
            govtId: '2345 6789 0123'
          });
          isConfigured = true;
          isUnlocked = true;
          updateVaultUI();
        }
      } catch {
        // Vault initialization note
      }
    }

    setAgentRunning(true);
    appendLogItem({
      logType: 'START',
      message: `🚀 Initiating autonomous loop for task: "${task}"`
    });

    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const activeTabId = tabs && tabs[0] ? tabs[0].id : null;
      if (!activeTabId) {
        setAgentRunning(false);
        appendLogItem({ logType: 'ERROR', message: 'No active tab found. Please open a web page.' });
        return;
      }

      chrome.runtime.sendMessage({
        type: 'START_AGENT',
        task: task,
        tabId: activeTabId
      }, (resp) => {
        if (chrome.runtime.lastError) {
          console.warn('[Vidur Popup] Start Notice:', chrome.runtime.lastError.message);
          appendLogItem({ logType: 'ERROR', message: `Communication error: ${chrome.runtime.lastError.message}` });
          setAgentRunning(false);
        } else if (resp && resp.status === 'error') {
          setAgentRunning(false);
          appendLogItem({ logType: 'ERROR', message: `Failed to start: ${resp.message}` });
        }
      });
    });
  });

  // Stop Agent Loop
  stopAgentBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'STOP_AGENT' });
    if (typeof stopOrchestration === 'function') {
      stopOrchestration();
    }
    setAgentRunning(false);
    agentStatusDot.className = 'status-dot';
    agentStatusText.textContent = 'Agent Stopped';
    appendLogItem({ logType: 'INFO', message: '🛑 Agent loop stopped.' });
  });

  // Human-in-the-Loop Approval Buttons
  approveActionBtn.addEventListener('click', () => {
    approvalBanner.style.display = 'none';
    chrome.runtime.sendMessage({ type: 'APPROVE_ACTION' });
    if (typeof approvePendingAction === 'function') {
      approvePendingAction(true);
    }
    appendLogItem({ logType: 'INFO', message: '✅ Action approved by user. Resuming execution...' });
  });

  rejectActionBtn.addEventListener('click', () => {
    approvalBanner.style.display = 'none';
    chrome.runtime.sendMessage({ type: 'REJECT_ACTION' });
    if (typeof approvePendingAction === 'function') {
      approvePendingAction(false);
    }
    appendLogItem({ logType: 'INFO', message: '❌ Action rejected by user. Skipped.' });
  });

  // Listen for background runtime events
  chrome.runtime.onMessage.addListener((message) => {
    if (!message) return;

    if (message.type === 'AGENT_STATUS') {
      const status = message.status;
      agentStatusText.textContent = message.message || `Status: ${status}`;
      if (message.iteration !== undefined) {
        iterationBadge.textContent = `Iter ${message.iteration}/15`;
      }

      if (status === 'RUNNING' || status === 'CAPTURING' || status === 'PLANNING' || status === 'EXECUTING' || status === 'SANITIZING') {
        agentStatusDot.className = 'status-dot running';
      } else if (status === 'AWAITING_APPROVAL') {
        agentStatusDot.className = 'status-dot awaiting';
      } else if (status === 'COMPLETED') {
        agentStatusDot.className = 'status-dot success';
        setAgentRunning(false);
      } else if (status === 'ERROR' || status === 'STOPPED') {
        agentStatusDot.className = 'status-dot error';
        setAgentRunning(false);
      }
    }

    if (message.type === 'AGENT_LOG') {
      appendLogItem(message);
    }

    if (message.type === 'AGENT_APPROVAL_REQUEST') {
      approvalBanner.style.display = 'flex';
      approvalReason.textContent = message.reason || 'Action requires user confirmation.';
      approvalActionType.textContent = (message.action?.type || 'CLICK').toUpperCase();
      approvalActionLabel.textContent = message.element?.label || message.element?.id || 'Submit Action';
    }
  });

  // Sync state on popup open
  chrome.runtime.sendMessage({ type: 'GET_AGENT_STATUS' }, (statusResp) => {
    if (chrome.runtime.lastError || !statusResp) return;
    if (statusResp.status && statusResp.status !== 'IDLE' && statusResp.status !== 'STOPPED' && statusResp.status !== 'COMPLETED') {
      setAgentRunning(true);
      agentStatusText.textContent = `Status: ${statusResp.status}`;
      if (statusResp.iteration) iterationBadge.textContent = `Iter ${statusResp.iteration}/15`;
      if (statusResp.logs && statusResp.logs.length > 0) {
        statusResp.logs.forEach(appendLogItem);
      }
    }
  });

  // --- SCREEN SCHEMA CAPTURE TAB CONTROLLER ---
  const captureBtn = document.getElementById('captureBtn');
  const btnText = document.getElementById('btnText');
  const cameraIcon = document.getElementById('cameraIcon');
  const captureSpinner = document.getElementById('captureSpinner');

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

  const privacyBanner = document.getElementById('privacyBanner');
  const privacyTitle = document.getElementById('privacyTitle');
  const piiCategoryPills = document.getElementById('piiCategoryPills');

  const viewSanitizedBtn = document.getElementById('viewSanitizedBtn');
  const viewRawBtn = document.getElementById('viewRawBtn');
  const jsonContent = document.getElementById('jsonContent');
  const copyJsonBtn = document.getElementById('copyJsonBtn');

  let currentRawSchema = null;
  let currentSanitizedResult = null;
  let currentViewMode = 'sanitized';

  function showAlert(title, message, type = 'info') {
    statusAlert.style.display = 'flex';
    statusAlert.className = `alert-box ${type}`;
    statusIcon.textContent = type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
    statusTitle.textContent = title;
    statusMessage.textContent = message;
  }

  function setCaptureLoading(loading, text = 'Capturing...') {
    captureBtn.disabled = loading;
    if (loading) {
      cameraIcon.style.display = 'none';
      captureSpinner.style.display = 'inline-block';
      btnText.textContent = text;
    } else {
      cameraIcon.style.display = 'inline-block';
      captureSpinner.style.display = 'none';
      btnText.textContent = 'Capture Current Viewport';
    }
  }

  function renderSchemaView() {
    if (currentViewMode === 'sanitized' && currentSanitizedResult) {
      viewSanitizedBtn.classList.add('active');
      viewRawBtn.classList.remove('active');
      jsonContent.textContent = JSON.stringify(currentSanitizedResult.sanitizedSchema, null, 2);
    } else if (currentRawSchema) {
      viewRawBtn.classList.add('active');
      viewSanitizedBtn.classList.remove('active');
      jsonContent.textContent = JSON.stringify(currentRawSchema, null, 2);
    }
  }

  viewSanitizedBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentViewMode = 'sanitized';
    renderSchemaView();
  });

  viewRawBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentViewMode = 'raw';
    renderSchemaView();
  });

  captureBtn.addEventListener('click', async () => {
    setCaptureLoading(true, 'Capturing Screen...');
    showAlert('Capturing', 'Extracting accessibility DOM & screenshot...', 'info');

    try {
      chrome.runtime.sendMessage({ type: 'CAPTURE' }, async (response) => {
        if (chrome.runtime.lastError || !response || response.status === 'error') {
          setCaptureLoading(false);
          showAlert('Capture Failed', response?.message || chrome.runtime.lastError?.message || 'Error capturing tab.', 'error');
          return;
        }

        const data = response.data;
        screenshotImg.src = data.screenshot;

        let ocrResults = [];
        if (typeof runOCR === 'function') {
          setCaptureLoading(true, 'Running OCR...');
          try {
            ocrResults = await runOCR(data.screenshot);
          } catch (ocrErr) {
            console.warn('[Vidur Popup] OCR fallback:', ocrErr.message);
          }
        }

        const rawSchema = buildScreenSchema(
          data.elements || [],
          ocrResults,
          data.viewport || { width: 0, height: 0 },
          data.url || ''
        );
        currentRawSchema = rawSchema;

        const sanitizeResult = sanitizeSchema(rawSchema);
        currentSanitizedResult = sanitizeResult;

        const domCount = rawSchema.elements.filter((e) => e.source === 'dom').length;
        const ocrCount = rawSchema.elements.filter((e) => e.source === 'ocr').length;
        elementCountBadge.textContent = `${rawSchema.elements.length} Elements`;
        domCountBadge.textContent = `${domCount} DOM`;
        ocrCountBadge.textContent = `${ocrCount} OCR`;
        viewportBadge.textContent = `${rawSchema.viewport.width}×${rawSchema.viewport.height} (${rawSchema.domain})`;

        if (sanitizeResult.piiCount > 0) {
          privacyBanner.style.display = 'flex';
          privacyTitle.textContent = `${sanitizeResult.piiCount} PII Values Protected`;
          piiCategoryPills.innerHTML = '';
          for (const [cat, count] of Object.entries(sanitizeResult.piiCategories)) {
            const pill = document.createElement('span');
            pill.className = `pii-category-badge ${cat}`;
            pill.textContent = `${count} ${cat}`;
            piiCategoryPills.appendChild(pill);
          }
        } else {
          privacyBanner.style.display = 'none';
        }

        currentViewMode = 'sanitized';
        renderSchemaView();
        resultsSection.style.display = 'flex';
        showAlert('Success', 'Screen Schema built successfully.', 'success');
        setCaptureLoading(false);
      });
    } catch (err) {
      setCaptureLoading(false);
      showAlert('Error', err.message, 'error');
    }
  });

  copyJsonBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (jsonContent.textContent) {
      navigator.clipboard.writeText(jsonContent.textContent).then(() => {
        copyJsonBtn.textContent = 'Copied!';
        setTimeout(() => (copyJsonBtn.textContent = 'Copy JSON'), 2000);
      });
    }
  });

  viewFullImageBtn.addEventListener('click', () => {
    if (screenshotImg.src) {
      window.open(screenshotImg.src, '_blank');
    }
  });

  // Helpers
  function sendRuntimeMessage(msg) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, (res) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(res);
      });
    });
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial vault check
  await checkVaultState();
});
