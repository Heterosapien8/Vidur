const express = require('express');
const router = express.Router();
const { planAction } = require('../services/reasoner');

// POST /plan-action
router.post('/', async (req, res) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  // 1. Validate request body
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({
      error: 'Invalid request body. Expected JSON object with "task" and "sanitizedSchema".'
    });
  }

  const { task, sanitizedSchema, actionHistory } = req.body;

  if (!task || typeof task !== 'string' || !task.trim()) {
    return res.status(400).json({
      error: 'Missing required field: "task" must be a non-empty string.'
    });
  }

  if (!sanitizedSchema || typeof sanitizedSchema !== 'object') {
    return res.status(400).json({
      error: 'Missing required field: "sanitizedSchema" must be a valid Screen Schema object.'
    });
  }

  if (!Array.isArray(sanitizedSchema.elements)) {
    return res.status(400).json({
      error: 'Invalid "sanitizedSchema": missing or non-array "elements" property.'
    });
  }

  try {
    // 2. Generate Action Plan
    const plan = await planAction({
      task: task.trim(),
      sanitizedSchema,
      actionHistory: Array.isArray(actionHistory) ? actionHistory : []
    });

    const durationMs = Date.now() - startTime;
    const actionCount = Array.isArray(plan.actions) ? plan.actions.length : 0;

    // 3. Basic Request Logging (Task + Timestamp + Action Count only — no schema values logged)
    console.log(
      `[Vidur Planner] [${timestamp}] Task: "${task.trim()}" | Actions: ${actionCount} | Done: ${plan.done} | Duration: ${durationMs}ms`
    );

    // 4. Return Action Plan JSON
    return res.status(200).json(plan);
  } catch (err) {
    const durationMs = Date.now() - startTime;
    console.warn(`[Vidur Planner] [${timestamp}] Planning error for task "${task}":`, err.message);

    return res.status(500).json({
      error: err.message || 'An error occurred while generating the action plan.',
      durationMs
    });
  }
});

module.exports = router;
