const router = require('express').Router();
const Monitor = require('../models/Monitor');
const MetricSnapshot = require('../models/MetricSnapshot');
const sse = require('../sse');

// POST /api/monitors/:id/push-stats — no session required, auth via webhookToken
router.post('/:id/push-stats', async (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.query.token;
  if (!token) return res.status(401).json({ error: 'Token requis' });

  const monitor = await Monitor.findById(req.params.id);
  if (!monitor) return res.status(404).json({ error: 'Service introuvable' });
  if (monitor.webhookToken !== token) return res.status(403).json({ error: 'Token invalide' });
  if (monitor.type !== 'rclone') return res.status(400).json({ error: 'push-stats réservé aux monitors rclone' });

  const { dlSpeed = 0, ulSpeed = 0, transfersActive = 0, transfersTotal = 0,
          errors = 0, checks = 0, elapsed = null, fileName = null, done = false } = req.body;

  const pushedAt = new Date();
  const pushedStats = { dlSpeed, ulSpeed, transfersActive, transfersTotal, errors, checks, elapsed, fileName, pushedAt, done };

  const newState = { ...(monitor.lastState || {}), ...pushedStats };
  const newMetrics = { ...(monitor.metrics || {}), dlSpeed, ulSpeed, transfersActive, transfersTotal, errors, checks };

  await Monitor.findByIdAndUpdate(monitor._id, { lastState: newState, metrics: newMetrics });

  MetricSnapshot.create({
    monitorId: monitor._id,
    type: 'rclone',
    status: monitor.status,
    value: null,
    metrics: newMetrics,
  }).catch(() => {});

  sse.broadcast('monitor', {
    id: monitor._id,
    name: monitor.name,
    prevStatus: monitor.status,
    status: monitor.status,
    lastState: newState,
    metrics: newMetrics,
    lastChecked: monitor.lastChecked,
  });

  res.json({ ok: true });
});

module.exports = router;
