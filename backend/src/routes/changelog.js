const router = require('express').Router();
const Changelog = require('../models/Changelog');

// GET /api/changelog?monitorId=xxx
router.get('/', async (req, res) => {
  const { monitorId } = req.query;
  if (!monitorId) return res.status(400).json({ error: 'monitorId requis' });
  const entries = await Changelog.find({ monitorId }).sort({ deployedAt: -1 }).lean();
  res.json(entries);
});

// POST /api/changelog
router.post('/', async (req, res) => {
  const { monitorId, version, description, deployedAt } = req.body;
  if (!monitorId || !version) return res.status(400).json({ error: 'monitorId et version requis' });
  const entry = await Changelog.create({
    monitorId, version, description: description || '',
    deployedAt: deployedAt ? new Date(deployedAt) : new Date(),
  });
  res.status(201).json(entry);
});

// PUT /api/changelog/:id
router.put('/:id', async (req, res) => {
  const { version, description, deployedAt } = req.body;
  const entry = await Changelog.findByIdAndUpdate(
    req.params.id,
    { version, description, ...(deployedAt && { deployedAt: new Date(deployedAt) }) },
    { new: true }
  );
  if (!entry) return res.status(404).json({ error: 'Entrée introuvable' });
  res.json(entry);
});

// DELETE /api/changelog/:id
router.delete('/:id', async (req, res) => {
  await Changelog.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
