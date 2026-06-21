const router = require('express').Router();
const Annotation = require('../models/Annotation');

// GET /api/annotations?monitorId=xxx&since=<ms>
router.get('/', async (req, res) => {
  const { monitorId, since } = req.query;
  if (!monitorId) return res.status(400).json({ error: 'monitorId requis' });
  const filter = { monitorId };
  if (since) filter.ts = { $gte: new Date(parseInt(since)) };
  const annotations = await Annotation.find(filter).sort({ ts: 1 }).lean();
  res.json(annotations);
});

// POST /api/annotations
router.post('/', async (req, res) => {
  const { monitorId, ts, label } = req.body;
  if (!monitorId || !label) return res.status(400).json({ error: 'monitorId et label requis' });
  const annotation = await Annotation.create({ monitorId, ts: ts ? new Date(ts) : new Date(), label });
  res.status(201).json(annotation);
});

// DELETE /api/annotations/:id
router.delete('/:id', async (req, res) => {
  await Annotation.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
