const router = require('express').Router();
const Monitor = require('../models/Monitor');
const { sendNotification } = require('../services/notifier');

// Public endpoint — no auth, secured by the slug itself (like heartbeat)
async function handleEvent(req, res) {
  const monitor = await Monitor.findOne({ type: 'webhook', 'config.slug': req.params.slug });
  if (!monitor) return res.status(404).json({ error: 'Webhook introuvable' });

  const body = req.body || {};
  const text = body.text || body.message || body.body || '';
  if (!text) return res.status(400).json({ error: 'text requis' });

  const now = new Date();
  const lastState = { ...(monitor.lastState || {}), lastEvent: String(text).slice(0, 2000), lastEventAt: now };
  await Monitor.findByIdAndUpdate(monitor._id, { lastState, status: 'online', lastChecked: now });

  await sendNotification({
    title: monitor.name,
    message: lastState.lastEvent,
    level: 'info',
    type: 'webhook_event',
    monitorId: monitor._id,
    monitorName: monitor.name,
    monitorAppriseUrls: monitor.appriseUrls,
  });

  res.json({ ok: true, ts: now });
}

router.post('/:slug', handleEvent);

module.exports = router;
