'use strict';
const net  = require('net');
const i18n = require('../i18n');

function tcpConnect(host, port, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const start  = Date.now();
    const socket = net.createConnection({ host, port, timeout });
    socket.on('connect', () => { resolve(Date.now() - start); socket.destroy(); });
    socket.on('timeout',  () => { socket.destroy(); reject(new Error('Timeout')); });
    socket.on('error',    reject);
  });
}

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { host, port = 80 } = config;

  if (!host || !port) return {
    status: 'error', state: null, metrics: null,
    notifications: [{ ...L.missingConfig('Port Forwarding', 'Host and port required'), level: 'error', type: 'status_change' }],
  };

  let latency = null;
  let error   = null;

  try {
    latency = await tcpConnect(host, Number(port));
  } catch (e) {
    error = e.message;
  }

  const online    = latency !== null;
  const wasOnline = lastState?.online ?? null;

  const notifications = [];
  if (lastState !== null) {
    if (!online && wasOnline)  notifications.push({ ...L.portForwardClosed(host, port), level: 'error',   type: 'status_change' });
    if (online  && !wasOnline) notifications.push({ ...L.portForwardOpen(host, port, latency), level: 'success', type: 'status_change' });
  }

  return {
    status:    online ? 'online' : 'offline',
    lastError: error || null,
    state:     { online, latency, host, port },
    metrics:   { host, port, latency },
    notifications,
  };
}

module.exports = { check };
