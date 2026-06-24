const router = require('express').Router();
const Incident = require('../models/Incident');
const Monitor = require('../models/Monitor');
const MaintenanceWindow = require('../models/MaintenanceWindow');

function overlapsWindow(start, end, windows) {
  return windows.some(w => start < w.end && end > w.start);
}

// GET /api/incidents/timeline?hours=24
router.get('/timeline', async (req, res) => {
  const hours = Math.min(parseInt(req.query.hours) || 24, 7 * 24);
  const now = new Date();
  const windowStart = new Date(now.getTime() - hours * 60 * 60 * 1000);

  const [monitors, incidentsRaw, maintenanceRaw] = await Promise.all([
    Monitor.find({}, 'name type category status').sort({ order: 1, name: 1 }).lean(),
    Incident.find({
      $or: [
        { startedAt: { $gte: windowStart } },
        { resolvedAt: null },
        { resolvedAt: { $gte: windowStart } },
      ],
    }).sort({ startedAt: 1 }).lean(),
    MaintenanceWindow.find({
      $or: [
        { startedAt: { $gte: windowStart } },
        { endedAt: null },
        { endedAt: { $gte: windowStart } },
      ],
    }).lean(),
  ]);

  const byMonitor = {};
  for (const inc of incidentsRaw) {
    const key = String(inc.monitorId);
    if (!byMonitor[key]) byMonitor[key] = [];
    byMonitor[key].push(inc);
  }

  const mwByMonitor = {};
  for (const w of maintenanceRaw) {
    const key = String(w.monitorId);
    if (!mwByMonitor[key]) mwByMonitor[key] = [];
    mwByMonitor[key].push({
      start:         Math.max(new Date(w.startedAt).getTime(), windowStart.getTime()),
      end:           Math.min(w.endedAt ? new Date(w.endedAt).getTime() : now.getTime(), now.getTime()),
      originalStart: new Date(w.startedAt).getTime(),
      originalEnd:   w.endedAt ? new Date(w.endedAt).getTime() : null,
    });
  }

  const rows = monitors.map(m => {
    const mIncidents = byMonitor[String(m._id)] || [];
    const mw = (mwByMonitor[String(m._id)] || []).filter(w => w.end > w.start);
    const segments = [];
    let cursor = windowStart.getTime();

    for (const inc of mIncidents) {
      const start = Math.max(new Date(inc.startedAt).getTime(), windowStart.getTime());
      const end = inc.resolvedAt ? Math.min(new Date(inc.resolvedAt).getTime(), now.getTime()) : now.getTime();

      if (cursor < start) {
        segments.push({ start: cursor, end: start, status: 'online' });
      }
      if (end > start) {
        segments.push({
          start, end,
          status: inc.triggerStatus || 'error',
          incidentId: String(inc._id),
          severity: inc.severity,
          reason: inc.reason || null,
          duringMaintenance: overlapsWindow(start, end, mw),
        });
      }
      cursor = Math.max(cursor, end);
    }

    if (cursor < now.getTime()) {
      segments.push({ start: cursor, end: now.getTime(), status: 'online' });
    }

    return {
      monitorId: String(m._id),
      monitorName: m.name,
      monitorType: m.type,
      category: m.category || '',
      currentStatus: m.status,
      segments,
      maintenanceWindows: mw,
    };
  });

  res.json({ windowStart: windowStart.toISOString(), windowEnd: now.toISOString(), rows });
});

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

  if (!incidents.length) return res.json(incidents);

  // Tag incidents that occurred during a maintenance window
  const earliest = incidents[incidents.length - 1].startedAt;
  const maintenanceRaw = await MaintenanceWindow.find({
    ...(monitorId ? { monitorId } : {}),
    $or: [
      { endedAt: null },
      { endedAt: { $gte: earliest } },
    ],
  }).lean();

  const mwByMonitor = {};
  for (const w of maintenanceRaw) {
    const key = String(w.monitorId);
    if (!mwByMonitor[key]) mwByMonitor[key] = [];
    mwByMonitor[key].push({
      start: new Date(w.startedAt).getTime(),
      end:   w.endedAt ? new Date(w.endedAt).getTime() : Date.now(),
    });
  }

  const result = incidents.map(inc => {
    const mw = mwByMonitor[String(inc.monitorId)] || [];
    const start = new Date(inc.startedAt).getTime();
    const end   = inc.resolvedAt ? new Date(inc.resolvedAt).getTime() : Date.now();
    return { ...inc, duringMaintenance: overlapsWindow(start, end, mw) };
  });

  res.json(result);
});

// PATCH /api/incidents/:id/severity
router.patch('/:id/severity', async (req, res) => {
  const { severity } = req.body;
  if (!['P1','P2','P3','P4'].includes(severity)) return res.status(400).json({ error: 'Sévérité invalide' });
  const incident = await Incident.findByIdAndUpdate(req.params.id, { severity }, { new: true });
  if (!incident) return res.status(404).json({ error: 'Incident introuvable' });
  res.json(incident);
});

// POST /api/incidents/:id/acknowledge
router.post('/:id/acknowledge', async (req, res) => {
  const incident = await Incident.findByIdAndUpdate(
    req.params.id,
    { acknowledgedAt: new Date() },
    { new: true }
  );
  if (!incident) return res.status(404).json({ error: 'Incident introuvable' });
  res.json(incident);
});

// PATCH /api/incidents/:id/postmortem
router.patch('/:id/postmortem', async (req, res) => {
  const { summary, rootCause, impact, resolution, lessons } = req.body;
  const incident = await Incident.findByIdAndUpdate(
    req.params.id,
    { postmortem: { summary, rootCause, impact, resolution, lessons, updatedAt: new Date() } },
    { new: true }
  );
  if (!incident) return res.status(404).json({ error: 'Incident introuvable' });
  res.json(incident);
});

// DELETE /api/incidents/:id
router.delete('/:id', async (req, res) => {
  await Incident.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
