const Monitor = require('../models/Monitor');
const MetricSnapshot = require('../models/MetricSnapshot');
const Incident = require('../models/Incident');
const primaryMetric = require('./primaryMetric');
const { sendNotification } = require('../services/notifier');

const handlers = {
  cloudflare: require('./cloudflare'),
  adguard:    require('./adguard'),
  hms:        require('./hms'),
  ultracc:    require('./ultracc'),
  syncthing:  require('./syncthing'),
  http:       require('./http'),
  ping:       require('./ping'),
  proxmox:    require('./proxmox'),
  immich:     require('./immich'),
  portainer:  require('./portainer'),
  ssh:        require('./ssh'),
};

async function runCheck(monitor) {
  const handler = handlers[monitor.type];
  if (!handler) return;

  console.log(`[Runner] Check: ${monitor.name} (${monitor.type})`);

  let result;
  try {
    result = await handler.check(monitor.config, monitor.lastState);
  } catch (err) {
    console.error(`[Runner] Erreur inattendue sur ${monitor.name}:`, err.message);
    result = {
      status: 'error',
      state: monitor.lastState,
      metrics: monitor.metrics,
      notifications: [{ title: `Erreur — ${monitor.name}`, message: err.message, level: 'error', type: 'error' }],
    };
  }

  const errorNotif = (result.notifications || []).find(n => n.level === 'error');
  const update = {
    status: result.status,
    lastState: result.state ?? monitor.lastState,
    metrics: result.metrics ?? monitor.metrics,
    lastChecked: new Date(),
    lastError: result.status === 'error' ? (errorNotif?.message || 'Erreur inconnue') : null,
  };

  // AdGuard token refresh — persist updated tokens
  if (result.configUpdate) {
    update.config = { ...monitor.config, ...result.configUpdate };
  }

  const prevStatus = monitor.status;
  await Monitor.findByIdAndUpdate(monitor._id, update);

  // Snapshot
  MetricSnapshot.create({
    monitorId: monitor._id,
    type: monitor.type,
    status: result.status,
    value: primaryMetric(monitor.type, result.metrics),
  }).catch(() => {});

  // Incident tracking
  if (['error', 'offline'].includes(result.status) && prevStatus === 'online') {
    Incident.create({
      monitorId: monitor._id,
      monitorName: monitor.name,
      monitorType: monitor.type,
      triggerStatus: result.status,
    }).catch(() => {});
  } else if (result.status === 'online' && ['error', 'offline'].includes(prevStatus)) {
    const open = await Incident.findOne({ monitorId: monitor._id, resolvedAt: null }).sort({ startedAt: -1 });
    if (open) {
      open.resolvedAt = new Date();
      open.duration = open.resolvedAt - open.startedAt;
      await open.save();
    }
  }

  for (const notif of result.notifications || []) {
    await sendNotification({ ...notif, monitorId: monitor._id, monitorName: monitor.name });
  }
}

async function runReport(monitor) {
  const handler = handlers[monitor.type];
  if (!handler?.report) return;

  console.log(`[Runner] Rapport: ${monitor.name}`);

  try {
    const { title, message } = await handler.report(monitor.config, monitor.lastState);
    await sendNotification({ title, message, level: 'info', type: 'report', monitorId: monitor._id, monitorName: monitor.name });
    await Monitor.findByIdAndUpdate(monitor._id, { lastReported: new Date() });
  } catch (err) {
    console.error(`[Runner] Erreur rapport ${monitor.name}:`, err.message);
  }
}

async function tick() {
  const now = Date.now();
  let monitors;
  try {
    monitors = await Monitor.find({ enabled: true });
  } catch {
    return;
  }

  for (const monitor of monitors) {
    const checkMs = monitor.checkInterval * 60 * 1000;
    const lastCheck = monitor.lastChecked ? monitor.lastChecked.getTime() : 0;
    if (now - lastCheck >= checkMs) {
      runCheck(monitor).catch(err => console.error(`[Runner] tick error ${monitor.name}:`, err.message));
    }

    if (monitor.reportInterval > 0) {
      const reportMs = monitor.reportInterval * 60 * 60 * 1000;
      const lastReport = monitor.lastReported ? monitor.lastReported.getTime() : 0;
      if (now - lastReport >= reportMs) {
        runReport(monitor).catch(err => console.error(`[Runner] report error ${monitor.name}:`, err.message));
      }
    }
  }
}

function start() {
  console.log('[Runner] Démarrage du scheduler (tick toutes les 30s)');
  tick();
  setInterval(tick, 30 * 1000);
}

// Called when a monitor is saved/updated to trigger an immediate check
async function triggerNow(monitorId) {
  const monitor = await Monitor.findById(monitorId);
  if (monitor && monitor.enabled) {
    await Monitor.findByIdAndUpdate(monitorId, { lastChecked: null });
    runCheck({ ...monitor.toObject(), lastChecked: null });
  }
}

module.exports = { start, triggerNow };
