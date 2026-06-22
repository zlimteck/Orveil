const mysql = require('mysql2/promise');
const i18n = require('../i18n');

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { host, port = 3306, user, password, database, timeout = 5000 } = config;

  if (!host || !user) return {
    status: 'error',
    state: null,
    metrics: null,
    lastError: 'Host and user required',
    notifications: [{ ...L.missingConfig('MySQL', 'Host and user required'), level: 'error', type: 'status_change' }],
  };

  const start = Date.now();
  let conn;
  try {
    conn = await mysql.createConnection({
      host, port: +port, user, password, database,
      connectTimeout: timeout,
    });
    await conn.ping();
    const responseTime = Date.now() - start;

    const [[{ version }]] = await conn.execute('SELECT VERSION() AS version');

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
      notifications: [{ ...L.unreachable(`MySQL ${host}`, host, err.message), level: 'error', type: 'status_change' }],
    };
  } finally {
    if (conn) conn.end().catch(() => {});
  }
}

module.exports = { check };
