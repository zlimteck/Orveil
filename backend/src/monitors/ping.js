const net = require('net');
const i18n = require('../i18n');

function tcpPing(host, port, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const socket = net.createConnection({ host, port, timeout });
    socket.on('connect', () => { resolve(Date.now() - start); socket.destroy(); });
    socket.on('timeout', () => { socket.destroy(); reject(new Error('Timeout')); });
    socket.on('error', reject);
  });
}

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { host, port = 80, attempts = 3 } = config;

  if (!host) return { status: 'error', state: null, metrics: null, notifications: [
    { ...L.missingConfig('Ping', 'Host required'), level: 'error', type: 'status_change' }
  ]};

  const results = [];
  for (let i = 0; i < attempts; i++) {
    try {
      const ms = await tcpPing(host, port);
      results.push(ms);
    } catch {
      results.push(null);
    }
  }

  const successful = results.filter(r => r !== null);
  const loss = Math.round(((attempts - successful.length) / attempts) * 100);
  const latency = successful.length ? Math.round(successful.reduce((a, b) => a + b, 0) / successful.length) : null;
  const online = loss < 100;

  const wasOnline = lastState?.loss < 100;
  const notifications = [];
  if (lastState !== null) {
    if (!online && wasOnline) notifications.push({ ...L.pingUnreachable(host, port, attempts), level: 'error', type: 'status_change' });
    if (online && !wasOnline) notifications.push({ ...L.pingBack(host, latency, port), level: 'success', type: 'status_change' });
  }

  const status = loss === 100 ? 'offline' : loss > 0 ? 'warning' : 'online';

  return {
    status,
    lastError: loss > 0 && loss < 100 ? `Packet loss: ${loss}% (port ${port})` : null,
    state: { latency, loss, host, port },
    metrics: { host, port, latency, loss },
    notifications,
  };
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  return L.pingReport(config.host, state);
}

module.exports = { check, report };
