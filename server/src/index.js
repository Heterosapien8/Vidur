const express = require('express');
const cors = require('cors');
const path = require('path');
const healthRoute = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve test pages
app.use('/test', express.static(path.join(__dirname, '../../extension/test-page')));

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Modular routes
app.use('/routes/health', healthRoute);

// Start server
app.listen(PORT, () => {
  console.log(`Vidur server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Test Login Page: http://localhost:${PORT}/test/login-test.html`);
});
