const express = require('express');
const router = express.Router();
const Monitor = require('../models/Monitor');
const Incident = require('../models/Incident');
const MetricSnapshot = require('../models/MetricSnapshot');
const NotificationLog = require('../models/NotificationLog');

// GET /api/stats — global stats for the Stats page
router.get('/', async (req, res) => {
  try {
    const [monitors, incidents, logs] = await Promise.all([
      Monitor.find(),
      Incident.find().sort({ startedAt: -1 }).limit(200),
      NotificationLog.find().sort({ sentAt: -1 }).limit(500),
    ]);

    const total = monitors.length;
    const enabled = monitors.filter(m => m.enabled).length;
    const online = monitors.filter(m => m.status === 'online').length;
    const alerting = monitors.filter(m => ['error', 'offline', 'warning'].includes(m.status)).length;

    // Uptime per monitor (based on snapshots from last 30 days) + 7-day trend
    const now = Date.now();
    const since = new Date(now - 30 * 24 * 3600 * 1000);
    const week1 = new Date(now - 7 * 24 * 3600 * 1000);
    const week2 = new Date(now - 14 * 24 * 3600 * 1000);
    const snapshots = await MetricSnapshot.find({ ts: { $gte: since } });

    const monitorUptime = {}, monitorTotal = {};
    const recentUp = {}, recentTotal = {}, priorUp = {}, priorTotal = {};

    for (const s of snapshots) {
      const id = s.monitorId.toString();
      monitorTotal[id] = (monitorTotal[id] || 0) + 1;
      if (s.status === 'online') monitorUptime[id] = (monitorUptime[id] || 0) + 1;
      if (s.ts >= week1) {
        recentTotal[id] = (recentTotal[id] || 0) + 1;
        if (s.status === 'online') recentUp[id] = (recentUp[id] || 0) + 1;
      } else if (s.ts >= week2) {
        priorTotal[id] = (priorTotal[id] || 0) + 1;
        if (s.status === 'online') priorUp[id] = (priorUp[id] || 0) + 1;
      }
    }

    const uptimeByMonitor = monitors.map(m => {
      const id = m._id.toString();
      const uptime = monitorTotal[id] > 0
        ? Math.round((monitorUptime[id] || 0) / monitorTotal[id] * 100)
        : null;
      const recentPct = recentTotal[id] > 0 ? (recentUp[id] || 0) / recentTotal[id] * 100 : null;
      const priorPct  = priorTotal[id]  > 0 ? (priorUp[id]  || 0) / priorTotal[id]  * 100 : null;
      const trend = recentPct != null && priorPct != null
        ? Math.round((recentPct - priorPct) * 10) / 10
        : null;
      const slaTarget = m.slaTarget ?? null;
      const slaMet = slaTarget != null && uptime != null ? uptime >= slaTarget : null;
      return { id: m._id, name: m.name, type: m.type, status: m.status, enabled: m.enabled, uptime, trend, slaTarget, slaMet };
    }).sort((a, b) => (a.uptime ?? 101) - (b.uptime ?? 101));

    // Incidents summary
    const openIncidents = incidents.filter(i => !i.resolvedAt).length;
    const resolvedIncidents = incidents.filter(i => i.resolvedAt).length;
    const resolved = incidents.filter(i => i.duration);
    const avgDuration = resolved.length
      ? Math.round(resolved.reduce((s, i) => s + i.duration, 0) / resolved.length)
      : null;

    // MTTR = avgDuration (alias)
    const mttr = avgDuration;

    // MTTD = mean time from startedAt to acknowledgedAt (for acknowledged incidents)
    const acknowledged = incidents.filter(i => i.acknowledgedAt);
    const mttd = acknowledged.length
      ? Math.round(acknowledged.reduce((s, i) => s + (new Date(i.acknowledgedAt) - new Date(i.startedAt)), 0) / acknowledged.length)
      : null;

    // Severity breakdown
    const severityCount = { P1: 0, P2: 0, P3: 0, P4: 0 };
    for (const inc of incidents) {
      const s = inc.severity || 'P3';
      severityCount[s] = (severityCount[s] || 0) + 1;
    }

    // MTTR per severity
    const mttrBySeverity = {};
    for (const sev of ['P1','P2','P3','P4']) {
      const group = resolved.filter(i => (i.severity || 'P3') === sev);
      mttrBySeverity[sev] = group.length
        ? Math.round(group.reduce((s, i) => s + i.duration, 0) / group.length)
        : null;
    }

    // Incidents per day (last 30 days)
    const incidentsByDay = {};
    for (const inc of incidents) {
      const day = new Date(inc.startedAt).toISOString().slice(0, 10);
      incidentsByDay[day] = (incidentsByDay[day] || 0) + 1;
    }

    // Notification logs summary
    const logsByLevel = { info: 0, success: 0, warning: 0, error: 0 };
    for (const l of logs) {
      if (l.level in logsByLevel) logsByLevel[l.level]++;
    }

    res.json({
      monitors: { total, enabled, online, alerting },
      incidents: { open: openIncidents, resolved: resolvedIncidents, avgDuration, mttr, mttd, severityCount, mttrBySeverity },
      incidentsByDay,
      uptimeByMonitor,
      logsByLevel,
    });
  } catch (err) {
    console.error('[Stats]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
