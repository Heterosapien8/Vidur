const express = require('express');
const cors = require('cors');
const healthRoute = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Modular routes
app.use('/routes/health', healthRoute);

// Start server
app.listen(PORT, () => {
  console.log(`Vidur server running on http://localhost:${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});
