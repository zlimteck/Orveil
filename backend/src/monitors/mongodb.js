const { MongoClient } = require('mongodb');
const i18n = require('../i18n');

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { host, port = 27017, user, password, database = 'admin', timeout = 5000 } = config;

  if (!host) return {
    status: 'error',
    state: null,
    metrics: null,
    lastError: 'Host required',
    notifications: [{ ...L.missingConfig('MongoDB', 'Host required'), level: 'error', type: 'status_change' }],
  };

  let uri;
  if (user && password) {
    uri = `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${+port}/${database}`;
  } else {
    uri = `mongodb://${host}:${+port}/${database}`;
  }

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: timeout,
    connectTimeoutMS: timeout,
    socketTimeoutMS: timeout,
  });

  const start = Date.now();
  try {
    await client.connect();
    const adminDb = client.db('admin');
    await adminDb.command({ ping: 1 });
    const responseTime = Date.now() - start;

    let version = null;
    try {
      const info = await adminDb.command({ buildInfo: 1 });
      version = info.version;
    } catch {}

    return {
      status: 'online',
      lastError: null,
      state: { host, port: +port, version, responseTime },
      metrics: { responseTime },
      notifications: [],
    };
  } catch (err) {
    return {
      status: 'offline',
      lastError: err.message,
      state: null,
      metrics: null,
      notifications: [{ ...L.unreachable(`MongoDB ${host}`, host, err.message), level: 'error', type: 'status_change' }],
    };
  } finally {
    await client.close().catch(() => {});
  }
}

module.exports = { check };
