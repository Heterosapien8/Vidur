require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const healthRoute = require('./routes/health');
const planActionRoute = require('./routes/planAction');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve test pages
app.use('/test', express.static(path.join(__dirname, '../../extension/test-page')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Reasoning and Action Planning endpoint
app.use('/plan-action', planActionRoute);
app.use('/api/plan-action', planActionRoute);

// Modular health routes
app.use('/routes/health', healthRoute);

// Start server
app.listen(PORT, () => {
  console.log(`Vidur server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Reasoning endpoint: POST http://localhost:${PORT}/plan-action`);
  console.log(`Test Login Page: http://localhost:${PORT}/test/login-test.html`);
  console.log(`Test Search Page: http://localhost:${PORT}/test/search-test.html`);
});
