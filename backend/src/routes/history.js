const router = require('express').Router();
const MetricSnapshot = require('../models/MetricSnapshot');
const Monitor = require('../models/Monitor');

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
  if (snapshots.length <= maxPoints) return snapshots.map(s => ({ ts: s.ts, status: s.status, value: s.value }));
  const step = snapshots.length / maxPoints;
  const out = [];
  for (let i = 0; i < maxPoints; i++) {
    const s = snapshots[Math.floor(i * step)];
    out.push({ ts: s.ts, status: s.status, value: s.value });
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
