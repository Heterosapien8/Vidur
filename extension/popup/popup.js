/**
 * Vidur Extension - Side Panel & Popup Controller
 * Coordinates Autonomous Agent Loop, WebCrypto Encrypted Profile Vault,
 * Side-by-Side Privacy Redaction Schema, Demo Mode Toggle, and Pipeline Pitch Modal.
 * Minimalist Design Edition (Black & #ffbae8, Georgia & Trebuchet MS, Zero Emojis).
 */

document.addEventListener('DOMContentLoaded', async () => {
  // --- 1. TAB NAVIGATION CONTROLLER ---
  const navTaskTab = document.getElementById('navTaskTab');
  const navPrivacyTab = document.getElementById('navPrivacyTab');
  const navVaultTab = document.getElementById('navVaultTab');
  const navPipelineBtn = document.getElementById('navPipelineBtn');

  const taskTabContent = document.getElementById('taskTabContent');
  const privacyTabContent = document.getElementById('privacyTabContent');
  const vaultTabContent = document.getElementById('vaultTabContent');
  const pipelineModal = document.getElementById('pipelineModal');
  const closePipelineBtn = document.getElementById('closePipelineBtn');

  function switchTab(activeNav, activeContent) {
    [navTaskTab, navPrivacyTab, navVaultTab, navPipelineBtn].forEach((t) => t && t.classList.remove('active'));
    [taskTabContent, privacyTabContent, vaultTabContent].forEach((c) => {
      if (c) c.style.display = 'none';
    });

    if (activeNav) activeNav.classList.add('active');
    if (activeContent) activeContent.style.display = 'flex';
  }

  if (navTaskTab) navTaskTab.addEventListener('click', () => switchTab(navTaskTab, taskTabContent));
  if (navPrivacyTab) navPrivacyTab.addEventListener('click', () => switchTab(navPrivacyTab, privacyTabContent));
  if (navVaultTab) navVaultTab.addEventListener('click', () => switchTab(navVaultTab, vaultTabContent));

  // 5-Stage Pipeline Modal Controls
  if (navPipelineBtn && pipelineModal) {
    navPipelineBtn.addEventListener('click', () => {
      pipelineModal.style.display = 'flex';
    });
  }

  if (closePipelineBtn && pipelineModal) {
    closePipelineBtn.addEventListener('click', () => {
      pipelineModal.style.display = 'none';
    });
  }

  if (pipelineModal) {
    pipelineModal.addEventListener('click', (e) => {
      if (e.target === pipelineModal) {
        pipelineModal.style.display = 'none';
      }
    });
  }

  // --- 2. DEMO MODE TOGGLE ---
  const demoModeToggle = document.getElementById('demoModeToggle');
  const demoModePill = document.getElementById('demoModePill');

  function updateDemoModeUI(enabled) {
    if (demoModeToggle) demoModeToggle.checked = enabled;
    if (demoModePill) demoModePill.style.display = enabled ? 'inline-block' : 'none';
  }

  // Load persisted demo mode state
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['vidur_demo_mode'], (res) => {
        const isDemo = res && res.vidur_demo_mode === true;
        updateDemoModeUI(isDemo);
      });
    } else {
      const stored = localStorage.getItem('vidur_demo_mode');
      updateDemoModeUI(stored === 'true');
    }
  } catch {
    // Local fallback
  }

  if (demoModeToggle) {
    demoModeToggle.addEventListener('change', () => {
      const enabled = demoModeToggle.checked;
      updateDemoModeUI(enabled);
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ vidur_demo_mode: enabled });
        } else {
          localStorage.setItem('vidur_demo_mode', String(enabled));
        }
      } catch {
        // Storage warning
      }
    });
  }

  // --- 3. VAULT CONTROLLER & STATE ---
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
    if (!vaultStatusIndicator) return;

    if (isUnlocked) {
      vaultStatusIndicator.className = 'vault-mini-badge unlocked';
      if (vaultMiniText) vaultMiniText.textContent = 'Unlocked';
      if (vaultAuthStatusIcon) vaultAuthStatusIcon.textContent = 'UNLOCKED';
      if (vaultAuthTitle) vaultAuthTitle.textContent = 'Profile Vault (Unlocked)';
      if (vaultAuthDesc) vaultAuthDesc.textContent = 'Encrypted profile data is active and ready for local token resolution.';
      if (unlockVaultBtn) unlockVaultBtn.style.display = 'none';
      if (lockVaultBtn) lockVaultBtn.style.display = 'inline-block';
      if (vaultProfileSection) vaultProfileSection.style.display = 'flex';
      if (vaultPassphraseInput) vaultPassphraseInput.disabled = true;
      if (vaultAuthError) vaultAuthError.style.display = 'none';

      // Load profile fields
      const profile = (typeof VidurVault !== 'undefined' ? VidurVault.getDecryptedProfile() : null) || {};
      if (vaultName) vaultName.value = profile.name || '';
      if (vaultEmail) vaultEmail.value = profile.email || '';
      if (vaultPhone) vaultPhone.value = profile.phone || '';
      if (vaultAddress) vaultAddress.value = profile.address || '';
      if (vaultPassword) vaultPassword.value = profile.password || '';
      if (vaultGovtId) vaultGovtId.value = profile.govtId || profile.aadhaar || '';
    } else {
      vaultStatusIndicator.className = 'vault-mini-badge locked';
      if (vaultMiniText) vaultMiniText.textContent = isConfigured ? 'Locked' : 'Not Set';
      if (vaultAuthStatusIcon) vaultAuthStatusIcon.textContent = 'SECURE';
      if (vaultAuthTitle) vaultAuthTitle.textContent = isConfigured ? 'Profile Vault (Locked)' : 'Set Up Profile Vault';
      if (vaultAuthDesc) {
        vaultAuthDesc.textContent = isConfigured
          ? 'Enter your passphrase to unlock your profile data.'
          : 'Choose a master passphrase to initialize your local encrypted vault.';
      }
      if (unlockVaultBtn) {
        unlockVaultBtn.textContent = isConfigured ? 'Unlock' : 'Create Vault';
        unlockVaultBtn.style.display = 'inline-block';
      }
      if (lockVaultBtn) lockVaultBtn.style.display = 'none';
      if (vaultProfileSection) vaultProfileSection.style.display = 'none';
      if (vaultPassphraseInput) vaultPassphraseInput.disabled = false;
    }
  }

  if (unlockVaultBtn) {
    unlockVaultBtn.addEventListener('click', async () => {
      const passphrase = vaultPassphraseInput ? vaultPassphraseInput.value.trim() : '';
      if (!passphrase || passphrase.length < 4) {
        if (vaultAuthError) {
          vaultAuthError.textContent = 'Passphrase must be at least 4 characters.';
          vaultAuthError.style.display = 'block';
        }
        return;
      }

      try {
        if (vaultAuthError) vaultAuthError.style.display = 'none';
        if (!isConfigured) {
          // Initial setup with demo values
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
        if (vaultAuthError) {
          vaultAuthError.textContent = err.message || 'Incorrect passphrase.';
          vaultAuthError.style.display = 'block';
        }
      }
    });
  }

  if (lockVaultBtn) {
    lockVaultBtn.addEventListener('click', () => {
      if (typeof VidurVault !== 'undefined') {
        VidurVault.lockVault();
      } else {
        sendRuntimeMessage({ type: 'LOCK_VAULT' });
      }
      isUnlocked = false;
      if (vaultPassphraseInput) vaultPassphraseInput.value = '';
      updateVaultUI();
    });
  }

  if (saveVaultProfileBtn) {
    saveVaultProfileBtn.addEventListener('click', async () => {
      const profile = {
        name: vaultName ? vaultName.value.trim() : '',
        email: vaultEmail ? vaultEmail.value.trim() : '',
        phone: vaultPhone ? vaultPhone.value.trim() : '',
        address: vaultAddress ? vaultAddress.value.trim() : '',
        password: vaultPassword ? vaultPassword.value.trim() : '',
        govtId: vaultGovtId ? vaultGovtId.value.trim() : ''
      };

      try {
        if (typeof VidurVault !== 'undefined') {
          await VidurVault.updateVaultProfile(profile);
        } else {
          await sendRuntimeMessage({ type: 'UPDATE_VAULT_PROFILE', profile });
        }

        saveVaultProfileBtn.textContent = 'Saved & Encrypted';
        setTimeout(() => {
          saveVaultProfileBtn.innerHTML = '<span>Save & Encrypt Profile</span>';
        }, 2000);
      } catch (err) {
        alert(`Failed to save vault: ${err.message}`);
      }
    });
  }

  // --- 4. TASK TAB & AGENT LOOP CONTROLLER ---
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

  // Preset buttons handler
  document.querySelectorAll('.preset-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (taskInput) {
        taskInput.value = btn.getAttribute('data-task') || '';
        taskInput.focus();
      }
    });
  });

  function setAgentRunning(running) {
    isAgentRunning = running;
    if (running) {
      if (playIcon) playIcon.style.display = 'none';
      if (agentSpinner) agentSpinner.style.display = 'inline-block';
      if (startAgentBtnText) startAgentBtnText.textContent = 'Agent Running...';
      if (startAgentBtn) startAgentBtn.disabled = true;
      if (stopAgentBtn) stopAgentBtn.style.display = 'flex';
      if (agentStatusBar) agentStatusBar.style.display = 'flex';
      if (agentStatusDot) agentStatusDot.className = 'status-dot running';
      if (agentStatusText) agentStatusText.textContent = 'Agent active';
    } else {
      if (playIcon) playIcon.style.display = 'inline-block';
      if (agentSpinner) agentSpinner.style.display = 'none';
      if (startAgentBtnText) startAgentBtnText.textContent = 'Start Autonomous Agent';
      if (startAgentBtn) startAgentBtn.disabled = false;
      if (stopAgentBtn) stopAgentBtn.style.display = 'none';
      if (approvalBanner) approvalBanner.style.display = 'none';
    }
  }

  function appendLogItem(logData) {
    if (!agentLogFeed) return;

    // Clear empty state
    const emptyState = agentLogFeed.querySelector('.empty-log-state');
    if (emptyState) emptyState.remove();

    logEventsCount++;
    if (logCountBadge) {
      logCountBadge.textContent = `${logEventsCount} event${logEventsCount === 1 ? '' : 's'}`;
    }

    const item = document.createElement('div');
    const logType = logData.logType || 'INFO';
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    item.className = 'log-item';

    if (logType === 'PLAN_RECEIVED') {
      item.classList.add('reasoning');
      item.innerHTML = `
        <div class="log-header-row">
          <span class="log-tag">LLM REASONING</span>
          <span class="log-time">${timeStr}</span>
        </div>
        <div class="log-body">${escapeHTML(logData.reasoning || logData.message)}</div>
      `;
    } else if (logType === 'ACTION_EXECUTED') {
      item.classList.add('action');
      const action = logData.action || {};
      const tokenChip = logData.result?.resolvedToken
        ? `<div class="log-token-chip">Resolved ${escapeHTML(logData.result.resolvedToken)} via ${escapeHTML(logData.result.resolutionSource || 'vault')}</div>`
        : '';

      item.innerHTML = `
        <div class="log-header-row">
          <span class="log-tag">ACTION: ${escapeHTML((action.type || 'EXEC').toUpperCase())}</span>
          <span class="log-time">${timeStr}</span>
        </div>
        <div class="log-body">Target: <b>#${escapeHTML(action.elementId || '')}</b> ${action.value ? `| Value: <i>"${escapeHTML(action.value)}"</i>` : ''}</div>
        ${tokenChip}
      `;
    } else if (logType === 'PII_REDACTED') {
      item.classList.add('pii');
      item.innerHTML = `
        <div class="log-header-row">
          <span class="log-tag">PRIVACY GUARD</span>
          <span class="log-time">${timeStr}</span>
        </div>
        <div class="log-body">${escapeHTML(logData.message)}</div>
      `;
    } else if (logType === 'SUCCESS') {
      item.classList.add('success');
      item.innerHTML = `
        <div class="log-header-row">
          <span class="log-tag">TASK COMPLETED</span>
          <span class="log-time">${timeStr}</span>
        </div>
        <div class="log-body">${escapeHTML(logData.message)}</div>
      `;
    } else if (logType === 'ERROR' || logType === 'ACTION_FAILED') {
      item.classList.add('error');
      item.innerHTML = `
        <div class="log-header-row">
          <span class="log-tag">ALERT</span>
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

  if (clearLogBtn) {
    clearLogBtn.addEventListener('click', () => {
      logEventsCount = 0;
      if (logCountBadge) logCountBadge.textContent = '0 events';
      if (agentLogFeed) {
        agentLogFeed.innerHTML = `
          <div class="empty-log-state">
            <span>Log cleared. Ready for next run.</span>
          </div>
        `;
      }
    });
  }

  // Start Agent Loop
  if (startAgentBtn) {
    startAgentBtn.addEventListener('click', async () => {
      const task = taskInput ? taskInput.value.trim() : '';
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
          // Vault auto-init notice
        }
      }

      const isDemoMode = demoModeToggle ? demoModeToggle.checked : false;

      setAgentRunning(true);
      appendLogItem({
        logType: 'START',
        message: `Initiating autonomous loop for task: "${task}" ${isDemoMode ? '[DEMO MODE ACTIVE]' : ''}`
      });

      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        const activeTabId = tabs && tabs[0] ? tabs[0].id : null;
        if (!activeTabId) {
          setAgentRunning(false);
          appendLogItem({ logType: 'ERROR', message: 'No active tab found. Please open a web page.' });
          return;
        }

        chrome.runtime.sendMessage(
          {
            type: 'START_AGENT',
            task: task,
            tabId: activeTabId,
            demoMode: isDemoMode
          },
          (resp) => {
            if (chrome.runtime.lastError) {
              console.warn('[Vidur Popup] Start Notice:', chrome.runtime.lastError.message);
              appendLogItem({ logType: 'ERROR', message: `Communication error: ${chrome.runtime.lastError.message}` });
              setAgentRunning(false);
            } else if (resp && resp.status === 'error') {
              setAgentRunning(false);
              appendLogItem({ logType: 'ERROR', message: `Failed to start: ${resp.message}` });
            }
          }
        );
      });
    });
  }

  // Stop Agent Loop
  if (stopAgentBtn) {
    stopAgentBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'STOP_AGENT' });
      if (typeof stopOrchestration === 'function') {
        stopOrchestration();
      }
      setAgentRunning(false);
      if (agentStatusDot) agentStatusDot.className = 'status-dot';
      if (agentStatusText) agentStatusText.textContent = 'Agent Stopped';
      appendLogItem({ logType: 'INFO', message: 'Agent loop stopped.' });
    });
  }

  // Human-in-the-Loop Approval Buttons
  if (approveActionBtn) {
    approveActionBtn.addEventListener('click', () => {
      if (approvalBanner) approvalBanner.style.display = 'none';
      chrome.runtime.sendMessage({ type: 'APPROVE_ACTION' });
      if (typeof approvePendingAction === 'function') {
        approvePendingAction(true);
      }
      appendLogItem({ logType: 'INFO', message: 'Action approved by user. Resuming execution...' });
    });
  }

  if (rejectActionBtn) {
    rejectActionBtn.addEventListener('click', () => {
      if (approvalBanner) approvalBanner.style.display = 'none';
      chrome.runtime.sendMessage({ type: 'REJECT_ACTION' });
      if (typeof approvePendingAction === 'function') {
        approvePendingAction(false);
      }
      appendLogItem({ logType: 'INFO', message: 'Action rejected by user. Skipped.' });
    });
  }

  // Listen for background runtime events
  chrome.runtime.onMessage.addListener((message) => {
    if (!message) return;

    if (message.type === 'AGENT_STATUS') {
      const status = message.status;
      if (agentStatusText) agentStatusText.textContent = message.message || `Status: ${status}`;
      if (iterationBadge && message.iteration !== undefined) {
        iterationBadge.textContent = `Iter ${message.iteration}/15`;
      }

      if (agentStatusDot) {
        if (
          status === 'RUNNING' ||
          status === 'CAPTURING' ||
          status === 'PLANNING' ||
          status === 'EXECUTING' ||
          status === 'SANITIZING'
        ) {
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
    }

    if (message.type === 'AGENT_LOG') {
      appendLogItem(message);
    }

    if (message.type === 'AGENT_APPROVAL_REQUEST') {
      if (approvalBanner) approvalBanner.style.display = 'flex';
      if (approvalReason) approvalReason.textContent = message.reason || 'Action requires user confirmation.';
      if (approvalActionType) approvalActionType.textContent = (message.action?.type || 'CLICK').toUpperCase();
      if (approvalActionLabel) {
        approvalActionLabel.textContent = message.element?.label || message.element?.id || 'Submit Action';
      }
    }
  });

  // Sync state on popup open
  chrome.runtime.sendMessage({ type: 'GET_AGENT_STATUS' }, (statusResp) => {
    if (chrome.runtime.lastError || !statusResp) return;
    if (
      statusResp.status &&
      statusResp.status !== 'IDLE' &&
      statusResp.status !== 'STOPPED' &&
      statusResp.status !== 'COMPLETED'
    ) {
      setAgentRunning(true);
      if (agentStatusText) agentStatusText.textContent = `Status: ${statusResp.status}`;
      if (statusResp.iteration && iterationBadge) {
        iterationBadge.textContent = `Iter ${statusResp.iteration}/15`;
      }
      if (statusResp.logs && statusResp.logs.length > 0) {
        statusResp.logs.forEach(appendLogItem);
      }
    }
  });

  // --- 5. PRIVACY TAB: SIDE-BY-SIDE RAW VS SANITIZED COMPARISON ---
  const captureBtn = document.getElementById('captureBtn');
  const btnText = document.getElementById('btnText');
  const cameraIcon = document.getElementById('cameraIcon');
  const captureSpinner = document.getElementById('captureSpinner');

  const statusAlert = document.getElementById('statusAlert');
  const statusTag = document.getElementById('statusTag');
  const statusTitle = document.getElementById('statusTitle');
  const statusMessage = document.getElementById('statusMessage');

  const privacyStatsBanner = document.getElementById('privacyStatsBanner');
  const privacyTitle = document.getElementById('privacyTitle');
  const piiCategoryPills = document.getElementById('piiCategoryPills');

  const sideBySideSection = document.getElementById('sideBySideSection');
  const rawJsonCode = document.getElementById('rawJsonCode');
  const sanitizedJsonCode = document.getElementById('sanitizedJsonCode');

  function showAlert(title, message, type = 'info') {
    if (!statusAlert) return;
    statusAlert.style.display = 'flex';
    statusAlert.className = `alert-box ${type}`;
    if (statusTag) statusTag.textContent = type === 'error' ? 'ERROR' : type === 'success' ? 'OK' : 'INFO';
    if (statusTitle) statusTitle.textContent = title;
    if (statusMessage) statusMessage.textContent = message;
  }

  function setCaptureLoading(loading, text = 'Capturing...') {
    if (!captureBtn) return;
    captureBtn.disabled = loading;
    if (loading) {
      if (cameraIcon) cameraIcon.style.display = 'none';
      if (captureSpinner) captureSpinner.style.display = 'inline-block';
      if (btnText) btnText.textContent = text;
    } else {
      if (cameraIcon) cameraIcon.style.display = 'inline-block';
      if (captureSpinner) captureSpinner.style.display = 'none';
      if (btnText) btnText.textContent = 'Capture & Inspect Privacy Schema';
    }
  }

  /**
   * Highlights token placeholders like {{FIELD:EMAIL_1}} in JSON string for pitch display
   */
  function renderHighlightedSanitizedJson(sanitizedSchema) {
    const rawJson = JSON.stringify(sanitizedSchema, null, 2);
    const escaped = escapeHTML(rawJson);
    // Highlight {{FIELD:...}} tokens
    return escaped.replace(/(\{\{FIELD:[A-Z0-9_]+\}\})/g, '<span class="hl-token">$1</span>');
  }

  if (captureBtn) {
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
          let ocrResults = [];

          if (typeof runOCR === 'function' && data.screenshot) {
            setCaptureLoading(true, 'Running OCR...');
            try {
              ocrResults = await runOCR(data.screenshot);
            } catch (ocrErr) {
              console.warn('[Vidur Popup] OCR fallback:', ocrErr.message);
            }
          }

          // Build raw schema
          const rawSchema = typeof buildScreenSchema === 'function'
            ? buildScreenSchema(
                data.elements || [],
                ocrResults,
                data.viewport || { width: 0, height: 0 },
                data.url || ''
              )
            : {
                schemaVersion: '1.0',
                capturedAt: new Date().toISOString(),
                viewport: data.viewport || { width: 0, height: 0 },
                domain: 'localhost',
                elements: data.elements || []
              };

          // Build sanitized schema
          const sanitizeResult = typeof sanitizeSchema === 'function'
            ? sanitizeSchema(rawSchema)
            : { sanitizedSchema: rawSchema, placeholderMap: {}, piiCount: 0, piiCategories: {} };

          // Render side-by-side JSON comparison
          if (rawJsonCode) {
            rawJsonCode.textContent = JSON.stringify(rawSchema, null, 2);
          }

          if (sanitizedJsonCode) {
            sanitizedJsonCode.innerHTML = renderHighlightedSanitizedJson(sanitizeResult.sanitizedSchema);
          }

          if (sideBySideSection) {
            sideBySideSection.style.display = 'grid';
          }

          // Update Privacy Stats Banner
          if (privacyStatsBanner) {
            privacyStatsBanner.style.display = 'flex';
            if (privacyTitle) {
              privacyTitle.textContent = `${sanitizeResult.piiCount} PII Value(s) Redacted & Protected`;
            }
            if (piiCategoryPills) {
              piiCategoryPills.innerHTML = '';
              const categories = sanitizeResult.piiCategories || {};
              const catEntries = Object.entries(categories);
              if (catEntries.length === 0) {
                const cleanPill = document.createElement('span');
                cleanPill.className = 'pii-category-badge';
                cleanPill.textContent = 'Zero PII Detected (Clean)';
                piiCategoryPills.appendChild(cleanPill);
              } else {
                for (const [cat, count] of catEntries) {
                  const pill = document.createElement('span');
                  pill.className = `pii-category-badge ${cat}`;
                  pill.textContent = `${count} ${cat}`;
                  piiCategoryPills.appendChild(pill);
                }
              }
            }
          }

          showAlert('Success', 'Screen Schema captured and sanitized side-by-side.', 'success');
          setCaptureLoading(false);
        });
      } catch (err) {
        setCaptureLoading(false);
        showAlert('Error', err.message, 'error');
      }
    });
  }

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

  // Initial vault check on load
  await checkVaultState();
});
