const mysql = require('mysql2/promise');

async function check(config) {
  const { host, port = 3306, user, password, database, timeout = 5000 } = config;

  if (!host || !user) return {
    status: 'error',
    state: null,
    metrics: null,
    lastError: 'Hôte et utilisateur requis',
    notifications: [{ title: 'Config manquante — MySQL', message: 'Hôte et utilisateur requis', level: 'error', type: 'status_change' }],
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
      notifications: [{
        title: `MySQL ${host} — Inaccessible`,
        message: err.message,
        level: 'error',
        type: 'status_change',
      }],
    };
  } finally {
    if (conn) conn.end().catch(() => {});
  }
}

module.exports = { check };
