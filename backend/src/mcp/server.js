'use strict';
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

const TOOLS = [
  {
    name: 'list_monitors',
    description: 'List all monitors with their current status, SLA target, category, and maintenance state. Optionally filter by status, category, or enabled state.',
    inputSchema: {
      type: 'object',
      properties: {
        status:   { type: 'string', enum: ['online', 'offline', 'warning', 'error', 'unknown'], description: 'Filter by status' },
        category: { type: 'string', description: 'Filter by category name' },
        enabled:  { type: 'boolean', description: 'Filter by enabled state' },
      },
    },
  },
  {
    name: 'get_monitor',
    description: 'Get full details, current metrics, and recent snapshot history for a specific monitor, identified by its ID or exact name.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Monitor ID (MongoDB ObjectId) or exact name' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_incidents',
    description: 'List recent incidents with monitor name, severity, duration, and postmortem data. Optionally filter to open/unresolved ones or a specific monitor.',
    inputSchema: {
      type: 'object',
      properties: {
        open_only:  { type: 'boolean', description: 'Only return unresolved incidents' },
        monitor_id: { type: 'string',  description: 'Filter by monitor ID or name' },
        limit:      { type: 'number',  description: 'Max number of results (default 10, max 100)' },
      },
    },
  },
  {
    name: 'get_stats',
    description: 'Get global monitoring statistics: total monitors and counts per status.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_stats_detailed',
    description: 'Get detailed statistics: MTTR, MTTD, uptime per monitor (30d), SLA compliance, incidents per day, severity breakdown, and notification log summary.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_annotations',
    description: 'List annotations (manual event markers) attached to monitors. Optionally filter by monitor.',
    inputSchema: {
      type: 'object',
      properties: {
        monitor_id: { type: 'string', description: 'Filter by monitor ID or name' },
        limit:      { type: 'number', description: 'Max number of results (default 20, max 200)' },
      },
    },
  },
  {
    name: 'get_uptime',
    description: 'Get uptime history (daily snapshots) for a specific monitor over the last N days.',
    inputSchema: {
      type: 'object',
      properties: {
        id:   { type: 'string', description: 'Monitor ID or exact name' },
        days: { type: 'number', description: 'Number of days to look back (default 30, max 90)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'trigger_check',
    description: 'Trigger an immediate check for a monitor without waiting for the next scheduled interval.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Monitor ID to trigger' },
      },
      required: ['id'],
    },
  },
];

function text(str) {
  return { content: [{ type: 'text', text: str }] };
}

function formatMonitorSummary(m) {
  return {
    id:              m._id,
    name:            m.name,
    type:            m.type,
    status:          m.enabled ? m.status : 'disabled',
    enabled:         m.enabled,
    category:        m.category || null,
    description:     m.description || null,
    serviceUrl:      m.serviceUrl || null,
    checkInterval:   m.checkInterval,
    reportInterval:  m.reportInterval || 0,
    slaTarget:       m.slaTarget ?? null,
    showOnStatusPage: m.showOnStatusPage,
    lastChecked:     m.lastChecked,
    lastError:       m.lastError || null,
    maintenance:     m.maintenanceUntil && new Date(m.maintenanceUntil) > new Date() ? m.maintenanceUntil : null,
    dependsOn:       m.dependsOn?.length ? m.dependsOn : null,
  };
}

function formatIncident(i) {
  return {
    id:            i._id,
    monitorId:     i.monitorId,
    monitorName:   i.monitorName || null,
    monitorType:   i.monitorType || null,
    severity:      i.severity || 'P3',
    triggerStatus: i.triggerStatus || null,
    reason:        i.reason || null,
    startedAt:     i.startedAt,
    resolvedAt:    i.resolvedAt || null,
    duration:      i.duration || null,
    acknowledgedAt: i.acknowledgedAt || null,
    postmortem:    i.postmortem?.summary ? {
      summary:    i.postmortem.summary,
      rootCause:  i.postmortem.rootCause,
      impact:     i.postmortem.impact,
      resolution: i.postmortem.resolution,
      lessons:    i.postmortem.lessons,
    } : null,
  };
}

async function resolveMonitor(id) {
  const Monitor  = require('../models/Monitor');
  const mongoose = require('mongoose');
  let monitor = null;
  if (mongoose.Types.ObjectId.isValid(id)) monitor = await Monitor.findById(id).lean();
  if (!monitor) monitor = await Monitor.findOne({ name: id }).lean();
  return monitor;
}

function createServer() {
  const server = new Server(
    { name: 'orveil', version: '1.1.0' },
    { capabilities: { tools: {}, resources: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const Monitor = require('../models/Monitor');
    const monitors = await Monitor.find({}, 'name').sort({ position: 1, name: 1 }).lean();
    const names = monitors.map(m => m.name);

    const tools = TOOLS.map(tool => {
      if (['get_monitor', 'trigger_check', 'get_uptime'].includes(tool.name)) {
        return {
          ...tool,
          inputSchema: {
            ...tool.inputSchema,
            properties: {
              ...tool.inputSchema.properties,
              id: {
                ...tool.inputSchema.properties.id,
                enum: names,
                description: `Monitor name. Available: ${names.join(', ')}`,
              },
            },
          },
        };
      }
      return tool;
    });

    return { tools };
  });

  // Resource template: orveil://monitors/{name}
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: [
      {
        uriTemplate: 'orveil://monitors/{name}',
        name: 'Monitor by name',
        description: 'Current status and metrics for a specific monitor. Use the exact service name.',
        mimeType: 'application/json',
      },
    ],
  }));

  // List all monitors as resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const Monitor = require('../models/Monitor');
    const monitors = await Monitor.find().sort({ position: 1, name: 1 }).lean();
    return {
      resources: monitors.map(m => ({
        uri:         `orveil://monitors/${encodeURIComponent(m.name)}`,
        name:        m.name,
        description: `[${m.type}] ${m.enabled ? m.status : 'disabled'}${m.description ? ' — ' + m.description : ''}`,
        mimeType:    'application/json',
      })),
    };
  });

  // Read a monitor resource by URI
  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    const { uri } = req.params;
    const match = uri.match(/^orveil:\/\/monitors\/(.+)$/);
    if (!match) throw new Error(`Unknown resource URI: ${uri}`);

    const name    = decodeURIComponent(match[1]);
    const monitor = await resolveMonitor(name);
    if (!monitor) throw new Error(`Monitor not found: ${name}`);

    const MetricSnapshot = require('../models/MetricSnapshot');
    const snapshots = await MetricSnapshot.find({ monitorId: monitor._id })
      .sort({ ts: -1 }).limit(20).lean();

    const payload = {
      ...formatMonitorSummary(monitor),
      metrics: monitor.metrics || null,
      recentSnapshots: snapshots.map(s => ({ ts: s.ts, status: s.status, value: s.value, metrics: s.metrics || null })),
    };

    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(payload, null, 2),
      }],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const Monitor        = require('../models/Monitor');
    const Incident       = require('../models/Incident');
    const MetricSnapshot = require('../models/MetricSnapshot');
    const Annotation     = require('../models/Annotation');
    const { name, arguments: args = {} } = req.params;

    try {
      // ── list_monitors ──────────────────────────────────────────────────────
      if (name === 'list_monitors') {
        const filter = {};
        if (args.status   !== undefined) filter.status   = args.status;
        if (args.category !== undefined) filter.category = args.category;
        if (args.enabled  !== undefined) filter.enabled  = args.enabled;
        const monitors = await Monitor.find(filter).sort({ position: 1, name: 1 }).lean();
        return text(JSON.stringify(monitors.map(formatMonitorSummary), null, 2));
      }

      // ── get_monitor ────────────────────────────────────────────────────────
      if (name === 'get_monitor') {
        const { id } = args;
        if (!id) return text('Error: id is required');
        const monitor = await resolveMonitor(id);
        if (!monitor) return text(`Monitor not found: ${id}`);

        const snapshots = await MetricSnapshot.find({ monitorId: monitor._id })
          .sort({ ts: -1 }).limit(20).lean();

        return text(JSON.stringify({
          ...formatMonitorSummary(monitor),
          cardMetric: monitor.cardMetric || null,
          metrics:    monitor.metrics || null,
          lastState:  monitor.lastState || null,
          recentSnapshots: snapshots.map(s => ({
            ts: s.ts, status: s.status, value: s.value, metrics: s.metrics || null,
          })),
        }, null, 2));
      }

      // ── list_incidents ─────────────────────────────────────────────────────
      if (name === 'list_incidents') {
        const filter = {};
        if (args.open_only) filter.resolvedAt = null;
        if (args.monitor_id) {
          const m = await resolveMonitor(args.monitor_id);
          filter.monitorId = m ? m._id : args.monitor_id;
        }
        const limit = Math.min(Number(args.limit) || 10, 100);
        const incidents = await Incident.find(filter)
          .sort({ startedAt: -1 }).limit(limit).lean();
        return text(JSON.stringify(incidents.map(formatIncident), null, 2));
      }

      // ── get_stats ──────────────────────────────────────────────────────────
      if (name === 'get_stats') {
        const monitors = await Monitor.find().lean();
        return text(JSON.stringify({
          total:    monitors.length,
          online:   monitors.filter(m => m.enabled && m.status === 'online').length,
          offline:  monitors.filter(m => m.enabled && m.status === 'offline').length,
          warning:  monitors.filter(m => m.enabled && m.status === 'warning').length,
          error:    monitors.filter(m => m.enabled && m.status === 'error').length,
          unknown:  monitors.filter(m => m.enabled && m.status === 'unknown').length,
          disabled: monitors.filter(m => !m.enabled).length,
        }, null, 2));
      }

      // ── get_stats_detailed ─────────────────────────────────────────────────
      if (name === 'get_stats_detailed') {
        const NotificationLog = require('../models/NotificationLog');
        const [monitors, incidents, logs] = await Promise.all([
          Monitor.find().lean(),
          Incident.find().sort({ startedAt: -1 }).limit(200).lean(),
          NotificationLog.find().sort({ sentAt: -1 }).limit(500).lean(),
        ]);

        const now   = Date.now();
        const since = new Date(now - 30 * 24 * 3600 * 1000);
        const week1 = new Date(now - 7 * 24 * 3600 * 1000);
        const week2 = new Date(now - 14 * 24 * 3600 * 1000);
        const snapshots = await MetricSnapshot.find({ ts: { $gte: since } }).lean();

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
            ? Math.round((monitorUptime[id] || 0) / monitorTotal[id] * 1000) / 10
            : null;
          const recentPct = recentTotal[id] > 0 ? (recentUp[id] || 0) / recentTotal[id] * 100 : null;
          const priorPct  = priorTotal[id]  > 0 ? (priorUp[id]  || 0) / priorTotal[id]  * 100 : null;
          const trend = recentPct != null && priorPct != null
            ? Math.round((recentPct - priorPct) * 10) / 10 : null;
          const slaTarget = m.slaTarget ?? null;
          return {
            id: m._id, name: m.name, type: m.type, enabled: m.enabled,
            uptime, trend, slaTarget, slaMet: slaTarget != null && uptime != null ? uptime >= slaTarget : null,
          };
        }).sort((a, b) => (a.uptime ?? 101) - (b.uptime ?? 101));

        const resolved = incidents.filter(i => i.duration);
        const avgDuration = resolved.length
          ? Math.round(resolved.reduce((s, i) => s + i.duration, 0) / resolved.length) : null;
        const acknowledged = incidents.filter(i => i.acknowledgedAt);
        const mttd = acknowledged.length
          ? Math.round(acknowledged.reduce((s, i) => s + (new Date(i.acknowledgedAt) - new Date(i.startedAt)), 0) / acknowledged.length) : null;

        const severityCount = { P1: 0, P2: 0, P3: 0, P4: 0 };
        const mttrBySeverity = {};
        for (const inc of incidents) severityCount[inc.severity || 'P3']++;
        for (const sev of ['P1','P2','P3','P4']) {
          const g = resolved.filter(i => (i.severity || 'P3') === sev);
          mttrBySeverity[sev] = g.length ? Math.round(g.reduce((s, i) => s + i.duration, 0) / g.length) : null;
        }

        const incidentsByDay = {};
        for (const inc of incidents) {
          const day = new Date(inc.startedAt).toISOString().slice(0, 10);
          incidentsByDay[day] = (incidentsByDay[day] || 0) + 1;
        }

        const logsByLevel = { info: 0, success: 0, warning: 0, error: 0 };
        for (const l of logs) { if (l.level in logsByLevel) logsByLevel[l.level]++; }

        return text(JSON.stringify({
          monitors: {
            total:    monitors.length,
            enabled:  monitors.filter(m => m.enabled).length,
            online:   monitors.filter(m => m.status === 'online').length,
            alerting: monitors.filter(m => ['error','offline','warning'].includes(m.status)).length,
            disabled: monitors.filter(m => !m.enabled).length,
          },
          incidents: {
            open:     incidents.filter(i => !i.resolvedAt).length,
            resolved: incidents.filter(i => i.resolvedAt).length,
            mttr:     avgDuration,
            mttd,
            severityCount,
            mttrBySeverity,
          },
          incidentsByDay,
          uptimeByMonitor,
          notifications: logsByLevel,
        }, null, 2));
      }

      // ── list_annotations ───────────────────────────────────────────────────
      if (name === 'list_annotations') {
        const filter = {};
        if (args.monitor_id) {
          const m = await resolveMonitor(args.monitor_id);
          filter.monitorId = m ? m._id : args.monitor_id;
        }
        const limit = Math.min(Number(args.limit) || 20, 200);
        const annotations = await Annotation.find(filter).sort({ ts: -1 }).limit(limit).lean();

        const monitorIds = [...new Set(annotations.map(a => a.monitorId.toString()))];
        const monitors   = await Monitor.find({ _id: { $in: monitorIds } }, 'name').lean();
        const nameMap    = Object.fromEntries(monitors.map(m => [m._id.toString(), m.name]));

        return text(JSON.stringify(annotations.map(a => ({
          id:          a._id,
          monitorId:   a.monitorId,
          monitorName: nameMap[a.monitorId.toString()] || null,
          ts:          a.ts,
          label:       a.label,
        })), null, 2));
      }

      // ── get_uptime ─────────────────────────────────────────────────────────
      if (name === 'get_uptime') {
        const { id, days = 30 } = args;
        if (!id) return text('Error: id is required');
        const monitor = await resolveMonitor(id);
        if (!monitor) return text(`Monitor not found: ${id}`);

        const cappedDays = Math.min(Number(days) || 30, 90);
        const since = new Date(Date.now() - cappedDays * 24 * 3600 * 1000);
        const snapshots = await MetricSnapshot.find({ monitorId: monitor._id, ts: { $gte: since } })
          .sort({ ts: 1 }).lean();

        const byDay = {};
        for (const s of snapshots) {
          const day = new Date(s.ts).toISOString().slice(0, 10);
          if (!byDay[day]) byDay[day] = { total: 0, online: 0 };
          byDay[day].total++;
          if (s.status === 'online') byDay[day].online++;
        }

        const dailyUptime = Object.entries(byDay).map(([date, d]) => ({
          date,
          uptime: d.total > 0 ? Math.round(d.online / d.total * 1000) / 10 : null,
          checks: d.total,
        }));

        return text(JSON.stringify({
          monitorId:   monitor._id,
          monitorName: monitor.name,
          days:        cappedDays,
          dailyUptime,
        }, null, 2));
      }

      // ── trigger_check ──────────────────────────────────────────────────────
      if (name === 'trigger_check') {
        const { id } = args;
        if (!id) return text('Error: id is required');
        const monitor = await resolveMonitor(id);
        if (!monitor) return text(`Monitor not found: ${id}`);
        const { triggerNow } = require('../monitors/runner');
        await triggerNow(monitor._id);
        return text(`Check triggered for "${monitor.name}"`);
      }

      return text(`Unknown tool: ${name}`);
    } catch (err) {
      return text(`Error: ${err.message}`);
    }
  });

  return server;
}

module.exports = { createServer };
