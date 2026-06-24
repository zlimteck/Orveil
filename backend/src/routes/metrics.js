const router = require('express').Router();
const Monitor = require('../models/Monitor');
const Incident = require('../models/Incident');
const MetricSnapshot = require('../models/MetricSnapshot');

function label(monitor) {
  const esc = v => (v || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  const parts = [
    `id="${esc(monitor._id.toString())}"`,
    `name="${esc(monitor.name)}"`,
    `type="${esc(monitor.type)}"`,
  ];
  if (monitor.category) parts.push(`category="${esc(monitor.category)}"`);
  return `{${parts.join(',')}}`;
}

function calcUptime(snapshots, ms) {
  const since = Date.now() - ms;
  const relevant = snapshots.filter(s => new Date(s.ts).getTime() >= since);
  if (!relevant.length) return null;
  return Math.round((relevant.filter(s => s.status === 'online').length / relevant.length) * 1000) / 10;
}

function getPrimaryLatency(monitor) {
  const m = monitor.metrics;
  if (!m) return null;
  const candidates = ['responseTime', 'latency', 'ping', 'totalDuration'];
  for (const k of candidates) {
    if (m[k] != null && typeof m[k] === 'number') return m[k];
  }
  return null;
}

router.get('/', async (req, res) => {
  const [monitors, openIncidents] = await Promise.all([
    Monitor.find({ enabled: true }).lean(),
    Incident.countDocuments({ resolvedAt: null }),
  ]);

  const monitorIds = monitors.map(m => m._id);
  const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const snapshots = await MetricSnapshot.find({ monitorId: { $in: monitorIds }, ts: { $gte: since30d } }).lean();

  const snapshotsByMonitor = {};
  for (const s of snapshots) {
    const id = s.monitorId.toString();
    if (!snapshotsByMonitor[id]) snapshotsByMonitor[id] = [];
    snapshotsByMonitor[id].push(s);
  }

  const lines = [];

  // orveil_monitor_status
  lines.push('# HELP orveil_monitor_status Current monitor status (1=online, 0=offline/error/unknown)');
  lines.push('# TYPE orveil_monitor_status gauge');
  for (const m of monitors) {
    lines.push(`orveil_monitor_status${label(m)} ${m.status === 'online' ? 1 : 0}`);
  }

  // orveil_monitor_latency_ms
  const withLatency = monitors.filter(m => getPrimaryLatency(m) != null);
  if (withLatency.length) {
    lines.push('# HELP orveil_monitor_latency_ms Last recorded primary latency in milliseconds');
    lines.push('# TYPE orveil_monitor_latency_ms gauge');
    for (const m of withLatency) {
      lines.push(`orveil_monitor_latency_ms${label(m)} ${getPrimaryLatency(m)}`);
    }
  }

  // orveil_monitor_uptime_24h_pct
  lines.push('# HELP orveil_monitor_uptime_24h_pct Monitor uptime over the last 24 hours (percent)');
  lines.push('# TYPE orveil_monitor_uptime_24h_pct gauge');
  for (const m of monitors) {
    const snaps = snapshotsByMonitor[m._id.toString()] || [];
    const val = calcUptime(snaps, 24 * 3600 * 1000);
    if (val != null) lines.push(`orveil_monitor_uptime_24h_pct${label(m)} ${val}`);
  }

  // orveil_monitor_uptime_7d_pct
  lines.push('# HELP orveil_monitor_uptime_7d_pct Monitor uptime over the last 7 days (percent)');
  lines.push('# TYPE orveil_monitor_uptime_7d_pct gauge');
  for (const m of monitors) {
    const snaps = snapshotsByMonitor[m._id.toString()] || [];
    const val = calcUptime(snaps, 7 * 24 * 3600 * 1000);
    if (val != null) lines.push(`orveil_monitor_uptime_7d_pct${label(m)} ${val}`);
  }

  // orveil_monitor_uptime_30d_pct
  lines.push('# HELP orveil_monitor_uptime_30d_pct Monitor uptime over the last 30 days (percent)');
  lines.push('# TYPE orveil_monitor_uptime_30d_pct gauge');
  for (const m of monitors) {
    const snaps = snapshotsByMonitor[m._id.toString()] || [];
    const val = calcUptime(snaps, 30 * 24 * 3600 * 1000);
    if (val != null) lines.push(`orveil_monitor_uptime_30d_pct${label(m)} ${val}`);
  }

  // orveil_incidents_open_total
  lines.push('# HELP orveil_incidents_open_total Number of currently open incidents');
  lines.push('# TYPE orveil_incidents_open_total gauge');
  lines.push(`orveil_incidents_open_total ${openIncidents}`);

  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(lines.join('\n') + '\n');
});

module.exports = router;
