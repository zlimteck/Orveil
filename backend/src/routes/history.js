const router = require('express').Router();
const MetricSnapshot = require('../models/MetricSnapshot');
const Monitor = require('../models/Monitor');

// GET /api/history/daily?days=90 — daily uptime per monitor (all monitors)
router.get('/daily', async (req, res) => {
  const days = Math.min(parseInt(req.query.days || '90'), 90);
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);

  const monitors = await Monitor.find({}, '_id').lean();
  const results = {};

  await Promise.all(monitors.map(async m => {
    const snapshots = await MetricSnapshot.find({ monitorId: m._id, ts: { $gte: since } })
      .sort({ ts: 1 })
      .lean();

    const byDay = {};
    for (const s of snapshots) {
      const day = new Date(s.ts).toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { total: 0, online: 0 };
      byDay[day].total++;
      if (s.status === 'online') byDay[day].online++;
    }

    const arr = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const d = byDay[day];
      arr.push(d ? Math.round((d.online / d.total) * 1000) / 10 : null);
    }

    results[m._id] = arr;
  }));

  res.json(results);
});

// GET /api/history/:monitorId?hours=24&points=48
router.get('/:monitorId', async (req, res) => {
  const { monitorId } = req.params;
  const hours  = Math.min(parseInt(req.query.hours  || '24'),  168); // max 7j
  const points = Math.min(parseInt(req.query.points || '48'),  200);

  const since = new Date(Date.now() - hours * 3600 * 1000);

  const snapshots = await MetricSnapshot.find({ monitorId, ts: { $gte: since } })
    .sort({ ts: 1 })
    .lean();

  // Downsample to `points` buckets
  const sampled = downsample(snapshots, points);

  // Uptime
  const uptime = calcUptime(snapshots);

  res.json({ points: sampled, uptime });
});

// GET /api/history?hours=24 — all monitors at once for dashboard
router.get('/', async (req, res) => {
  const hours = Math.min(parseInt(req.query.hours || '24'), 168);
  const since = new Date(Date.now() - hours * 3600 * 1000);

  const monitors = await Monitor.find({}, '_id type').lean();
  const results = {};

  await Promise.all(monitors.map(async m => {
    const snapshots = await MetricSnapshot.find({ monitorId: m._id, ts: { $gte: since } })
      .sort({ ts: 1 })
      .lean();
    results[m._id] = {
      points: downsample(snapshots, 48),
      uptime: calcUptime(snapshots),
    };
  }));

  res.json(results);
});

function downsample(snapshots, maxPoints) {
  const toPoint = s => ({ ts: s.ts, status: s.status, value: s.value, metrics: s.metrics ?? null });
  if (snapshots.length <= maxPoints) return snapshots.map(toPoint);
  const step = snapshots.length / maxPoints;
  const out = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(toPoint(snapshots[Math.floor(i * step)]));
  }
  return out;
}

function calcUptime(snapshots) {
  if (!snapshots.length) return { h24: null, d7: null };
  const now = Date.now();
  const calc = (ms) => {
    const since = now - ms;
    const relevant = snapshots.filter(s => new Date(s.ts).getTime() >= since);
    if (!relevant.length) return null;
    const online = relevant.filter(s => s.status === 'online').length;
    return Math.round((online / relevant.length) * 1000) / 10; // one decimal
  };
  return {
    h24: calc(24 * 3600 * 1000),
    d7:  calc(7  * 24 * 3600 * 1000),
  };
}

module.exports = router;
