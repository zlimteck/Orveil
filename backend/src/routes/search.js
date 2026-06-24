const router = require('express').Router();
const Monitor = require('../models/Monitor');
const Incident = require('../models/Incident');
const Annotation = require('../models/Annotation');

const LIMIT = 6;

function esc(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q || q.length < 2) return res.json({ monitors: [], incidents: [], annotations: [], postmortems: [] });

  const re = new RegExp(esc(q), 'i');

  const [monitors, incidents, annotationsRaw, postmortems] = await Promise.all([
    Monitor.find(
      { $or: [{ name: re }, { description: re }, { category: re }] },
      'name type status category description'
    ).limit(LIMIT).lean(),

    Incident.find(
      { $or: [{ reason: re }, { monitorName: re }, { severity: re }] },
      'monitorId monitorName severity reason startedAt resolvedAt triggerStatus'
    ).sort({ startedAt: -1 }).limit(LIMIT).lean(),

    Annotation.find({ label: re })
      .sort({ ts: -1 }).limit(LIMIT)
      .populate('monitorId', 'name')
      .lean(),

    Incident.find(
      { $or: [
        { 'postmortem.summary':    re },
        { 'postmortem.rootCause':  re },
        { 'postmortem.resolution': re },
        { 'postmortem.impact':     re },
        { 'postmortem.lessons':    re },
      ] },
      'monitorId monitorName postmortem startedAt resolvedAt'
    ).sort({ startedAt: -1 }).limit(LIMIT).lean(),
  ]);

  res.json({
    monitors,
    incidents,
    annotations: annotationsRaw.map(a => ({
      _id: a._id,
      label: a.label,
      ts: a.ts,
      monitorId: a.monitorId?._id || a.monitorId,
      monitorName: a.monitorId?.name || '?',
    })),
    postmortems,
  });
});

module.exports = router;
