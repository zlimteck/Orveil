const Redis = require('ioredis');

async function check(config) {
  const { host, port = 6379, password, timeout = 5000 } = config;

  if (!host) return {
    status: 'error',
    state: null,
    metrics: null,
    lastError: 'Hôte requis',
    notifications: [{ title: 'Config manquante — Redis', message: 'Hôte requis', level: 'error', type: 'status_change' }],
  };

  const start = Date.now();
  const client = new Redis({
    host, port: +port, password: password || undefined,
    connectTimeout: timeout,
    commandTimeout: timeout,
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    enableReadyCheck: false,
  });

  try {
    await client.connect();
    const pong = await client.ping();
    if (pong !== 'PONG') throw new Error(`Réponse inattendue : ${pong}`);

    const responseTime = Date.now() - start;
    const info = await client.info('server').catch(() => '');
    const versionMatch = info.match(/redis_version:(.+)/);
    const version = versionMatch ? versionMatch[1].trim() : null;

    return {
      status: 'online',
      lastError: null,
      state: { host, port, version, responseTime },
      metrics: { responseTime },
      notifications: [],
    };
  } catch (err) {
    return {
      status: 'offline',
      lastError: err.message,
      state: null,
      metrics: null,
      notifications: [{
        title: `Redis ${host} — Inaccessible`,
        message: err.message,
        level: 'error',
        type: 'status_change',
      }],
    };
  } finally {
    client.disconnect();
  }
}

module.exports = { check };
