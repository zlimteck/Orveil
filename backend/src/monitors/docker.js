const http = require('http');
const i18n = require('../i18n');

function dockerRequest(socketPath, path) {
  // Prefer DOCKER_PROXY_URL env var (TCP proxy) over direct socket
  const proxyUrl = process.env.DOCKER_PROXY_URL;
  const options = proxyUrl
    ? (() => { const u = new URL(path, proxyUrl); return { host: u.hostname, port: u.port || 2375, path: u.pathname + u.search }; })()
    : { socketPath, path, headers: { Host: 'localhost' } };

  return new Promise((resolve, reject) => {
    const req = http.get(options,
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid response from Docker socket')); }
        });
      }
    );
    req.on('error', (err) => {
      const msg = err.code === 'ENOENT' || err.code === 'ECONNREFUSED'
        ? `Docker socket unreachable (${socketPath})`
        : err.message;
      reject(new Error(msg));
    });
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('Docker API timeout')); });
  });
}

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { socketPath = '/var/run/docker.sock' } = config;

  try {
    const containers = await dockerRequest(socketPath, '/containers/json?all=1');

    const running = containers.filter(c => c.State === 'running');
    const stopped = containers.filter(c => c.State !== 'running');

    const containerList = containers.map(c => ({
      id: c.Id.slice(0, 12),
      name: (c.Names[0] || '').replace(/^\//, ''),
      image: c.Image.split(':')[0].split('/').pop(),
      state: c.State,
      status: c.Status,
    }));

    const metrics = {
      containersRunning: running.length,
      containersStopped: stopped.length,
      containers: containerList,
    };

    const status = 'online'; // socket reachable = healthy, stopped containers are informational

    return { status, state: metrics, metrics, notifications: [] };
  } catch (err) {
    return {
      status: 'error', state: lastState, metrics: null,
      notifications: [{ ...L.dockerSocketError(err.message), level: 'error', type: 'status_change' }],
    };
  }
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  if (!state) return { title: 'Docker', message: 'No data.' };
  return L.dockerReport(state);
}

module.exports = { check, report };
