const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const NotificationLog = require('../models/NotificationLog');

const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, réessayez dans une minute.' },
});

router.get('/', async (req, res) => {
  const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 100), 500);
  const skip  = Math.max(0, parseInt(req.query.skip) || 0);
  const { monitorId, level } = req.query;
  const filter = {};
  if (monitorId) filter.monitorId = monitorId;
  if (level) filter.level = level;

  const [logs, total] = await Promise.all([
    NotificationLog.find(filter).sort({ createdAt: -1 }).limit(limit).skip(skip),
    NotificationLog.countDocuments(filter),
  ]);
  res.json({ logs, total });
});

router.delete('/', async (req, res) => {
  await NotificationLog.deleteMany({});
  res.json({ ok: true });
});

// Envoi manuel d'une notification (ex-pushnotifier)
router.post('/send', sendLimiter, async (req, res) => {
  const { title, message, level = 'info' } = req.body;
  if (!title || !message) return res.status(400).json({ error: 'title et message requis' });
  try {
    const { sendNotification } = require('../services/notifier');
    const sent = await sendNotification({ title, message, level, type: 'info', monitorName: 'Manuel' });
    res.json({ sent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
