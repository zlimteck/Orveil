const axios = require('axios');
const i18n = require('../i18n');

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // device considered online if lastSeen < 5min ago

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { apiKey, tailnet, deviceName } = config;

  if (!apiKey || !tailnet) return {
    status: 'error', state: null, metrics: null, lastError: 'API key and tailnet required',
    notifications: [{ ...L.missingConfig('Tailscale', 'API key and tailnet required'), level: 'error', type: 'status_change' }],
  };

  const http = axios.create({
    timeout: 10000,
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const start = Date.now();
  try {
    const res = await http.get(`https://api.tailscale.com/api/v2/tailnet/${tailnet}/devices`);
    const responseTime = Date.now() - start;

    const now = Date.now();
    let devices = (res.data.devices || []).map(d => ({
      name: (d.name || d.hostname || '').split('.')[0] || d.hostname,
      ip: d.addresses?.[0] || null,
      os: d.os || null,
      lastSeen: d.lastSeen || null,
      online: d.lastSeen ? (now - new Date(d.lastSeen).getTime()) < ONLINE_THRESHOLD_MS : false,
    }));

    if (deviceName) {
      devices = devices.filter(d => d.name?.toLowerCase().includes(deviceName.toLowerCase()));
    }

    const online = devices.filter(d => d.online).length;
    const offline = devices.filter(d => !d.online).length;
    const total = devices.length;

    let status;
    if (deviceName) {
      // Specific device filter: warn if that device is offline
      status = total === 0 ? 'unknown' : offline > 0 ? 'warning' : 'online';
    } else {
      // No filter: tailnet is reachable = online, counts are informational
      status = total === 0 ? 'unknown' : 'online';
    }

    return {
      status,
      lastError: null,
      state: { total, online, offline, devices },
      metrics: { total, online, offline, responseTime, devices },
      notifications: [],
    };
  } catch (err) {
    const msg = err.response?.status === 401
      ? 'Invalid API key or unauthorized'
      : err.response?.status === 404
      ? `Tailnet "${tailnet}" not found`
      : err.message;
    return {
      status: 'error',
      lastError: msg,
      state: null,
      metrics: null,
      notifications: [{ ...L.apiError('Tailscale', msg), level: 'error', type: 'status_change' }],
    };
  }
}

module.exports = { check };
