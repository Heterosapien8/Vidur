/**
 * Vidur Extension - Autonomous Orchestration Loop
 * Coordinates: Capture -> Sanitize -> Plan (/plan-action) -> Execute Actions -> Settle -> Repeat
 * Features a 15-iteration hard cap, human-in-the-loop safety approvals, and live event broadcasting.
 */

const MAX_LOOP_ITERATIONS = 15;
const DEFAULT_SETTLE_DELAY_MS = 1000;
const DEFAULT_SERVER_URL = 'http://localhost:3000/plan-action';

// Orchestrator State
let activeLoop = null;

class AgentOrchestrator {
  constructor({ task, tabId, serverUrl = DEFAULT_SERVER_URL }) {
    this.task = task;
    this.tabId = tabId;
    this.serverUrl = serverUrl;
    this.iteration = 0;
    this.actionHistory = [];
    this.status = 'IDLE'; // 'IDLE' | 'RUNNING' | 'AWAITING_APPROVAL' | 'PAUSED' | 'COMPLETED' | 'ERROR' | 'STOPPED'
    this.currentPlan = null;
    this.pendingApprovalResolver = null;
    this.logs = [];
  }

  /**
   * Broadcasts a real-time log or status update to the extension popup/UI.
   */
  emitEvent(type, payload = {}) {
    const event = {
      type: type,
      timestamp: new Date().toISOString(),
      iteration: this.iteration,
      status: this.status,
      ...payload
    };

    if (type === 'AGENT_LOG') {
      this.logs.push(payload);
    }

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(event, () => {
          // Ignore "Receiving end does not exist" if popup is closed
          if (chrome.runtime.lastError) {
            // Silently handled
          }
        });
      }
    } catch {
      // In non-extension context
    }

    console.log(`[Vidur Orchestrator] [${this.status}] [Iter ${this.iteration}]`, type, payload);
  }

  /**
   * Starts the autonomous agent orchestration loop.
   */
  async start() {
    if (this.status === 'RUNNING') {
      console.warn('[Vidur Orchestrator] Agent loop is already running.');
      return;
    }

    this.status = 'RUNNING';
    this.iteration = 0;
    this.actionHistory = [];
    this.logs = [];

    this.emitEvent('AGENT_STATUS', {
      status: 'RUNNING',
      iteration: 0,
      message: `Starting autonomous agent loop for task: "${this.task}"`
    });

    try {
      while (this.status === 'RUNNING' && this.iteration < MAX_LOOP_ITERATIONS) {
        this.iteration++;

        this.emitEvent('AGENT_STATUS', {
          status: 'RUNNING',
          iteration: this.iteration,
          message: `Iteration ${this.iteration} / ${MAX_LOOP_ITERATIONS}`
        });

        this.emitEvent('AGENT_LOG', {
          logType: 'ITERATION_START',
          iteration: this.iteration,
          message: `--- Iteration ${this.iteration} / ${MAX_LOOP_ITERATIONS} ---`
        });

        // 1. CAPTURE LAYER: Capture DOM tree and screenshot
        this.emitEvent('AGENT_STATUS', { status: 'CAPTURING', iteration: this.iteration, message: 'Capturing viewport and extracting DOM...' });
        const captureResult = await this.captureTab();

        // 2. OCR PERCEPTION & SCREEN SCHEMA (Non-blocking with fast timeout)
        let ocrResults = [];
        if (typeof runOCR === 'function' && captureResult.screenshot) {
          try {
            ocrResults = await Promise.race([
              runOCR(captureResult.screenshot),
              new Promise((_, reject) => setTimeout(() => reject(new Error('OCR timeout')), 2500))
            ]).catch(() => []);
          } catch {
            ocrResults = [];
          }
        }

        const rawSchema = typeof buildScreenSchema === 'function'
          ? buildScreenSchema(
              captureResult.elements || [],
              ocrResults,
              captureResult.viewport || { width: 1920, height: 1080 },
              captureResult.url || ''
            )
          : {
              schemaVersion: '1.0',
              capturedAt: new Date().toISOString(),
              viewport: captureResult.viewport || { width: 1920, height: 1080 },
              domain: 'localhost',
              elements: captureResult.elements || []
            };

        // 3. PRIVACY SANITIZATION
        this.emitEvent('AGENT_STATUS', { status: 'SANITIZING', iteration: this.iteration, message: 'Sanitizing PII and generating placeholder map...' });
        const sanitizeResult = typeof sanitizeSchema === 'function'
          ? sanitizeSchema(rawSchema)
          : { sanitizedSchema: rawSchema, placeholderMap: {}, piiCount: 0 };

        const sanitizedSchema = sanitizeResult.sanitizedSchema;
        const placeholderMap = sanitizeResult.placeholderMap || {};

        if (sanitizeResult.piiCount > 0) {
          this.emitEvent('AGENT_LOG', {
            logType: 'PII_REDACTED',
            count: sanitizeResult.piiCount,
            categories: sanitizeResult.piiCategories,
            message: `🛡️ Sanitized ${sanitizeResult.piiCount} sensitive field(s) locally.`
          });
        }

        // 4. REASONING ENDPOINT (/plan-action)
        this.emitEvent('AGENT_STATUS', { status: 'PLANNING', iteration: this.iteration, message: 'Consulting reasoning engine...' });
        const plan = await this.fetchActionPlan(sanitizedSchema);
        this.currentPlan = plan;

        this.emitEvent('AGENT_LOG', {
          logType: 'PLAN_RECEIVED',
          reasoning: plan.reasoning,
          done: plan.done,
          actions: plan.actions,
          message: `🧠 Reasoning: ${plan.reasoning}`
        });

        // Check completion
        if (plan.done === true) {
          this.status = 'COMPLETED';
          this.emitEvent('AGENT_STATUS', {
            status: 'COMPLETED',
            iteration: this.iteration,
            message: `🎉 Goal achieved in ${this.iteration} iterations!`
          });
          this.emitEvent('AGENT_LOG', {
            logType: 'SUCCESS',
            message: `Task completed successfully: "${this.task}"`
          });
          return { success: true, iterations: this.iteration, history: this.actionHistory };
        }

        if (!plan.actions || plan.actions.length === 0) {
          this.emitEvent('AGENT_LOG', {
            logType: 'NO_ACTIONS',
            message: 'No actions proposed by planner. Waiting for page to settle.'
          });
          await new Promise((r) => setTimeout(r, DEFAULT_SETTLE_DELAY_MS));
          continue;
        }

        // 5. EXECUTE ACTIONS
        this.emitEvent('AGENT_STATUS', { status: 'EXECUTING', iteration: this.iteration, message: `Executing ${plan.actions.length} action(s)...` });

        // Retrieve current unlocked vault profile if available
        let vaultProfile = {};
        if (typeof VidurVault !== 'undefined' && typeof VidurVault.getDecryptedProfile === 'function') {
          vaultProfile = VidurVault.getDecryptedProfile() || {};
        }

        for (let aIdx = 0; aIdx < plan.actions.length; aIdx++) {
          if (this.status !== 'RUNNING' && this.status !== 'AWAITING_APPROVAL') {
            break;
          }

          const action = plan.actions[aIdx];
          const targetEl = sanitizedSchema.elements?.find((e) => e.id === action.elementId);

          // Safety Check: Check if action needs user approval
          if (typeof VidurExecutor !== 'undefined' && VidurExecutor.isSensitiveAction(action, targetEl)) {
            this.status = 'AWAITING_APPROVAL';
            this.emitEvent('AGENT_APPROVAL_REQUEST', {
              action: action,
              element: targetEl,
              reason: `Sensitive action detected: [${action.type.toUpperCase()}] "${targetEl?.label || targetEl?.id || 'Submit'}"`
            });

            // Wait for user approval decision
            const approved = await new Promise((resolve) => {
              this.pendingApprovalResolver = resolve;
            });

            this.pendingApprovalResolver = null;
            if (!approved) {
              this.status = 'RUNNING';
              this.emitEvent('AGENT_LOG', {
                logType: 'ACTION_REJECTED',
                action: action,
                message: `⚠️ Action on ${action.elementId} was rejected by user. Skipping.`
              });
              continue;
            }
            this.status = 'RUNNING';
          }

          // Execute action via executor
          let execResult;
          if (typeof VidurExecutor !== 'undefined' && typeof VidurExecutor.executeAction === 'function') {
            execResult = await VidurExecutor.executeAction(this.tabId, action, sanitizedSchema, {
              placeholderMap: placeholderMap,
              vaultProfile: vaultProfile,
              approved: true
            });
          } else {
            execResult = { success: true, actionType: action.type };
          }

          // Record action in history
          const historyEntry = {
            iteration: this.iteration,
            type: action.type,
            elementId: action.elementId,
            value: action.value,
            success: execResult.success,
            resolvedToken: execResult.resolvedToken,
            resolutionSource: execResult.resolutionSource,
            error: execResult.error
          };
          this.actionHistory.push(historyEntry);

          if (execResult.success) {
            const tokenMsg = execResult.resolvedToken
              ? ` (Resolved ${execResult.resolvedToken} via ${execResult.resolutionSource})`
              : '';
            this.emitEvent('AGENT_LOG', {
              logType: 'ACTION_EXECUTED',
              action: action,
              result: execResult,
              message: `▶ [${action.type.toUpperCase()}] #${action.elementId}${tokenMsg}`
            });
          } else if (execResult.skipped) {
            this.emitEvent('AGENT_LOG', {
              logType: 'ACTION_SKIPPED',
              action: action,
              error: execResult.error,
              message: `⚠️ Skipped #${action.elementId}: ${execResult.error}`
            });
          } else {
            this.emitEvent('AGENT_LOG', {
              logType: 'ACTION_FAILED',
              action: action,
              error: execResult.error,
              message: `❌ Failed #${action.elementId}: ${execResult.error}`
            });
          }
        }

        // 6. SETTLE DELAY: Give page time to load new content / navigate
        this.emitEvent('AGENT_STATUS', { status: 'WAITING_SETTLE', iteration: this.iteration, message: 'Waiting for page to settle...' });
        await new Promise((r) => setTimeout(r, DEFAULT_SETTLE_DELAY_MS));
      }

      // Hard cap reached
      if (this.iteration >= MAX_LOOP_ITERATIONS && this.status === 'RUNNING') {
        this.status = 'ERROR';
        const msg = `Maximum iteration limit (${MAX_LOOP_ITERATIONS}) reached without completing task.`;
        this.emitEvent('AGENT_STATUS', { status: 'ERROR', message: msg });
        this.emitEvent('AGENT_LOG', { logType: 'ERROR', message: `🛑 ${msg}` });
        return { success: false, error: msg, history: this.actionHistory };
      }
    } catch (err) {
      this.status = 'ERROR';
      this.emitEvent('AGENT_STATUS', { status: 'ERROR', message: err.message });
      this.emitEvent('AGENT_LOG', { logType: 'ERROR', message: `🛑 Error in agent loop: ${err.message}` });
      return { success: false, error: err.message, history: this.actionHistory };
    }
  }

  /**
   * Resolves a pending human approval decision.
   * @param {boolean} approved
   */
  resolveApproval(approved) {
    if (this.pendingApprovalResolver) {
      this.pendingApprovalResolver(approved);
      this.pendingApprovalResolver = null;
    }
  }

  /**
   * Stops the active agent loop immediately.
   */
  stop() {
    this.status = 'STOPPED';
    if (this.pendingApprovalResolver) {
      this.pendingApprovalResolver(false);
      this.pendingApprovalResolver = null;
    }
    this.emitEvent('AGENT_STATUS', { status: 'STOPPED', message: 'Agent loop stopped by user.' });
  }

  /**
   * Captures the active tab DOM and screenshot.
   */
  async captureTab() {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      let targetTabId = this.tabId;
      let windowId = null;

      if (targetTabId) {
        try {
          const tab = await chrome.tabs.get(targetTabId);
          windowId = tab.windowId;
        } catch {
          // Tab get error
        }
      }

      if (!windowId || !targetTabId) {
        const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (tabs && tabs[0]) {
          targetTabId = tabs[0].id;
          windowId = tabs[0].windowId;
        }
      }

      if (!targetTabId) {
        throw new Error('Could not identify active tab to capture.');
      }

      let screenshot = null;
      try {
        if (chrome.tabs.captureVisibleTab && windowId) {
          screenshot = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
        }
      } catch (err) {
        console.warn('[Vidur Orchestrator] Screenshot capture warning:', err.message);
      }

      // Request DOM extraction from content script with automatic dynamic injection
      let domResult = null;
      try {
        domResult = await new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(targetTabId, { type: 'EXTRACT_DOM' }, (res) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            resolve(res);
          });
        });
      } catch {
        console.log('[Vidur Orchestrator] Injecting content script into tab', targetTabId);
        try {
          await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            files: ['content-script.js']
          });

          domResult = await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(targetTabId, { type: 'EXTRACT_DOM' }, (res) => {
              if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
              resolve(res);
            });
          });
        } catch (injErr) {
          throw new Error(`Failed to extract DOM from page: ${injErr.message}`);
        }
      }

      const tabInfo = await chrome.tabs.get(targetTabId).catch(() => ({ url: '' }));

      return {
        screenshot,
        elements: domResult?.elements || [],
        viewport: domResult?.viewport || { width: 1920, height: 1080 },
        url: tabInfo.url || ''
      };
    } else {
      // Fallback for tests
      return {
        screenshot: null,
        elements: [],
        viewport: { width: 1920, height: 1080 },
        url: 'http://localhost:3000'
      };
    }
  }

  /**
   * Calls POST /plan-action reasoning endpoint on server.
   */
  async fetchActionPlan(sanitizedSchema) {
    const res = await fetch(this.serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: this.task,
        sanitizedSchema: sanitizedSchema,
        actionHistory: this.actionHistory
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Planner returned HTTP ${res.status}: ${errText}`);
    }

    return await res.json();
  }
}

/**
 * Controller functions
 */
function startOrchestration({ task, tabId, serverUrl }) {
  if (activeLoop && (activeLoop.status === 'RUNNING' || activeLoop.status === 'AWAITING_APPROVAL')) {
    activeLoop.stop();
  }
  activeLoop = new AgentOrchestrator({ task, tabId, serverUrl });
  activeLoop.start();
  return activeLoop;
}

function stopOrchestration() {
  if (activeLoop) {
    activeLoop.stop();
  }
}

function approvePendingAction(approved = true) {
  if (activeLoop) {
    activeLoop.resolveApproval(approved);
  }
}

function getActiveLoop() {
  return activeLoop;
}

// Global and module exports
if (typeof window !== 'undefined') {
  window.VidurOrchestrator = {
    AgentOrchestrator,
    startOrchestration,
    stopOrchestration,
    approvePendingAction,
    getActiveLoop
  };
} else if (typeof globalThis !== 'undefined') {
  globalThis.VidurOrchestrator = {
    AgentOrchestrator,
    startOrchestration,
    stopOrchestration,
    approvePendingAction,
    getActiveLoop
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AgentOrchestrator,
    startOrchestration,
    stopOrchestration,
    approvePendingAction,
    getActiveLoop
  };
}
