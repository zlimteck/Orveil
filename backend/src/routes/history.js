const router = require('express').Router();
const MetricSnapshot = require('../models/MetricSnapshot');
const Monitor = require('../models/Monitor');

// GET /api/history/daily?days=90 — daily uptime per monitor (all monitors)
// Uses a single MongoDB aggregation instead of N separate queries
router.get('/daily', async (req, res) => {
  const days = Math.min(parseInt(req.query.days || '90'), 90);
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);

  const [monitors, agg] = await Promise.all([
    Monitor.find({}, '_id').lean(),
    MetricSnapshot.aggregate([
      { $match: { ts: { $gte: since } } },
      {
        $group: {
          _id: {
            monitorId: '$monitorId',
            day: { $dateToString: { format: '%Y-%m-%d', date: '$ts' } },
          },
          total:  { $sum: 1 },
          online: { $sum: { $cond: [{ $eq: ['$status', 'online'] }, 1, 0] } },
        },
      },
    ]).allowDiskUse(false),
  ]);

  // Index aggregation results by monitorId + day
  const byMonitorDay = {};
  for (const row of agg) {
    const mid = row._id.monitorId.toString();
    if (!byMonitorDay[mid]) byMonitorDay[mid] = {};
    byMonitorDay[mid][row._id.day] = row;
  }

  // Build ordered day arrays per monitor
  const results = {};
  const dayLabels = [];
  for (let i = days - 1; i >= 0; i--) {
    dayLabels.push(new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10));
  }

  for (const m of monitors) {
    const mid = m._id.toString();
    const dayMap = byMonitorDay[mid] || {};
    results[mid] = dayLabels.map(day => {
      const d = dayMap[day];
      return d ? Math.round((d.online / d.total) * 1000) / 10 : null;
    });
  }

  res.json(results);
});

// GET /api/history/:monitorId?hours=24&points=48
router.get('/:monitorId', async (req, res) => {
  const { monitorId } = req.params;
  const hours  = Math.min(parseInt(req.query.hours  || '24'), 168);
  const points = Math.min(parseInt(req.query.points || '48'), 200);
  const since  = new Date(Date.now() - hours * 3600 * 1000);

  const snapshots = await MetricSnapshot.find({ monitorId, ts: { $gte: since } })
    .sort({ ts: 1 })
    .lean();

  res.json({ points: downsample(snapshots, points), uptime: calcUptime(snapshots) });
});

// GET /api/history?hours=24 — all monitors at once for dashboard
// Single query for 7 days, grouping in JS (covers h24 + d7 uptime in one shot)
router.get('/', async (req, res) => {
  const hours = Math.min(parseInt(req.query.hours || '24'), 168);
  const since24 = new Date(Date.now() - hours * 3600 * 1000);
  const since7d  = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  // Fetch 7 days so calcUptime can compute both h24 and d7 from one query
  const since = hours <= 24 ? since7d : since24;

  const all = await MetricSnapshot.find(
    { ts: { $gte: since } },
    'monitorId ts status value metrics',
  ).sort({ ts: 1 }).lean();

  // Group by monitorId
  const byMonitor = {};
  for (const s of all) {
    const id = s.monitorId.toString();
    if (!byMonitor[id]) byMonitor[id] = [];
    byMonitor[id].push(s);
  }

  const results = {};
  for (const [id, snapshots] of Object.entries(byMonitor)) {
    // Downsample only the requested window for the sparkline
    const windowSnaps = hours <= 24
      ? snapshots.filter(s => s.ts >= since24)
      : snapshots;
    results[id] = {
      points: downsample(windowSnaps, 48),
      uptime: calcUptime(snapshots),
    };
  }

  res.json(results);
});

function downsample(snapshots, maxPoints) {
  const toPoint = s => ({ ts: s.ts, status: s.status, value: s.value, metrics: s.metrics ?? null });
  if (snapshots.length <= maxPoints) return snapshots.map(toPoint);

  const RECENT = Math.min(8, Math.floor(maxPoints / 4));
  const recent = snapshots.slice(-RECENT);
  const older  = snapshots.slice(0, -RECENT);
  const olderSlots = maxPoints - RECENT;
  const step = older.length / olderSlots;
  const out = [];
  for (let i = 0; i < olderSlots; i++) {
    out.push(toPoint(older[Math.floor(i * step)]));
  }
  return [...out, ...recent.map(toPoint)];
}

function calcUptime(snapshots) {
  if (!snapshots.length) return { h24: null, d7: null };
  const now = Date.now();
  const calc = (ms) => {
    const since = now - ms;
    const relevant = snapshots.filter(s => new Date(s.ts).getTime() >= since);
    if (!relevant.length) return null;
    const online = relevant.filter(s => s.status === 'online').length;
    return Math.round((online / relevant.length) * 1000) / 10;
  };
  return { h24: calc(24 * 3600 * 1000), d7: calc(7 * 24 * 3600 * 1000) };
}

module.exports = router;
