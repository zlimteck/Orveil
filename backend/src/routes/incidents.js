const router = require('express').Router();
const Incident = require('../models/Incident');

// GET /api/incidents?monitorId=xxx&open=true&limit=50
router.get('/', async (req, res) => {
  const { monitorId, open, limit = 50 } = req.query;
  const filter = {};
  if (monitorId) filter.monitorId = monitorId;
  if (open === 'true') filter.resolvedAt = null;

  const incidents = await Incident.find(filter)
    .sort({ startedAt: -1 })
    .limit(parseInt(limit))
    .lean();

  res.json(incidents);
});

module.exports = router;
