const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 3000;

// Serve static files. { index: false } is required: express.static's
// default behavior serves public/index.html for any directory request
// (including "/") before any app.get() route below ever runs — which
// silently defeated the "/" -> landing.html route the moment it was added.
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Proxy API requests to AI Engine
app.use('/api', createProxyMiddleware({
  target: 'http://ai-engine:8080',
  changeOrigin: true,
  onError: (err, req, res) => {
    res.status(502).json({ error: 'AI Engine unavailable' });
  }
}));

// Proxy WebSocket
app.use('/ws', createProxyMiddleware({
  target: 'ws://ai-engine:8080',
  ws: true,
  onError: (err, req, res) => {
    console.error('WebSocket proxy error:', err);
  }
}));

// Public marketing landing page — root serves this instead of the app
// itself; landing.html redirects an already-authenticated visitor on to
// /app client-side (same pattern login.html already used for "already
// logged in").
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// Serve login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Command center (the authenticated app) and any of its client-side routes
app.get(['/app', '/app/*'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// SPA fallback - anything else still resolves to the app, so deep links
// and bookmarks from before this route split keep working
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`BLACKSENTINEL AI UI running on http://localhost:${PORT}`);
});
