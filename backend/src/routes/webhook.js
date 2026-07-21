const router = require('express').Router();
const crypto = require('crypto');
const Monitor = require('../models/Monitor');
const Changelog = require('../models/Changelog');

// POST /api/webhook/changelog
// Public — authenticated by webhookToken in body or Authorization/token header
router.post('/changelog', async (req, res) => {
  try {
    // Token can come from body or headers (for tools like Dispatcharr)
    const headerToken = req.headers['token'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
    const body = req.body || {};
    const token = body.token || headerToken;

    if (!token) return res.status(401).json({ error: 'Token manquant' });

    const monitor = await Monitor.findOne({ webhookToken: token }).lean();
    if (!monitor) return res.status(401).json({ error: 'Token invalide' });

    // Support Dispatcharr event format: { event, data } or standard { version, description }
    const eventName = body.event || body.event_type || null;
    const version = body.version || eventName || 'event';
    const description = body.description || body.message || (eventName ? JSON.stringify(body.data || {}) : '') || '';
    const deployedAtVal = body.deployedAt || body.timestamp || null;

    const entry = await Changelog.create({
      monitorId: monitor._id,
      version,
      description,
      deployedAt: deployedAtVal ? new Date(deployedAtVal) : new Date(),
    });

    res.status(201).json({ ok: true, entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
