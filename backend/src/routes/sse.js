const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { addClient } = require('../sse');

router.get('/', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).json({ error: 'Token requis' });

  try {
    jwt.verify(token, process.env.JWT_SECRET || 'secret');
  } catch {
    return res.status(401).json({ error: 'Token invalide' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write('event: connected\ndata: {}\n\n');

  const keepAlive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(keepAlive); }
  }, 25000);

  res.on('close', () => clearInterval(keepAlive));

  addClient(res);
});

module.exports = router;
