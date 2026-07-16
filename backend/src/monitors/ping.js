const net = require('net');
const { spawn } = require('child_process');
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

function icmpPing(host, attempts = 3, timeout = 5) {
  return new Promise((resolve) => {
    // -c: count, -W: timeout per packet (seconds), -q: quiet output
    const args = ['-c', String(attempts), '-W', String(timeout), '-q', host];
    const proc = spawn('ping', args);
    let output = '';
    proc.stdout.on('data', d => { output += d.toString(); });
    proc.stderr.on('data', d => { output += d.toString(); });
    proc.on('close', () => {
      // Parse "X packets transmitted, Y received, Z% packet loss, time Wms"
      const lossMatch = output.match(/(\d+)%\s+packet loss/);
      const rttMatch  = output.match(/rtt[^=]*=\s*[\d.]+\/([\d.]+)\//); // avg
      const loss = lossMatch ? parseInt(lossMatch[1], 10) : 100;
      const latency = rttMatch ? Math.round(parseFloat(rttMatch[1])) : null;
      resolve({ loss, latency });
    });
    proc.on('error', () => resolve({ loss: 100, latency: null, icmpUnavailable: true }));
  });
}

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { host, port = 80, attempts = 3, mode = 'tcp' } = config;

  if (!host) return { status: 'error', state: null, metrics: null, notifications: [
    { ...L.missingConfig('Ping', 'Host required'), level: 'error', type: 'status_change' }
  ]};

  let loss, latency;

  if (mode === 'icmp') {
    const result = await icmpPing(host, attempts);
    if (result.icmpUnavailable) {
      return { status: 'error', state: null, metrics: null, notifications: [
        { title: 'Ping ICMP — Unavailable', message: '`ping` binary not found in container. Use TCP mode or install iputils.', level: 'error', type: 'status_change' }
      ]};
    }
    loss    = result.loss;
    latency = result.latency;
  } else {
    const results = [];
    for (let i = 0; i < attempts; i++) {
      try { results.push(await tcpPing(host, port)); }
      catch { results.push(null); }
    }
    const successful = results.filter(r => r !== null);
    loss    = Math.round(((attempts - successful.length) / attempts) * 100);
    latency = successful.length ? Math.round(successful.reduce((a, b) => a + b, 0) / successful.length) : null;
  }

  const online    = loss < 100;
  const wasOnline = lastState?.loss < 100;
  const notifications = [];

  if (lastState !== null) {
    if (!online && wasOnline) notifications.push({ ...L.pingUnreachable(host, port, attempts, mode), level: 'error', type: 'status_change' });
    if (online && !wasOnline) notifications.push({ ...L.pingBack(host, latency, port, mode), level: 'success', type: 'status_change' });
  }

  const status = loss === 100 ? 'offline' : loss > 0 ? 'warning' : 'online';
  const lastErrorDetail = mode === 'icmp' ? `Packet loss: ${loss}% (ICMP)` : `Packet loss: ${loss}% (port ${port})`;

  return {
    status,
    lastError: loss > 0 && loss < 100 ? lastErrorDetail : null,
    state: { latency, loss, host, port, mode },
    metrics: { host, port, latency, loss, mode },
    notifications,
  };
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  return L.pingReport(config.host, state);
}

module.exports = { check, report };
