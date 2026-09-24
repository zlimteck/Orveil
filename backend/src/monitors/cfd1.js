const axios = require('axios');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');

// Cloudflare D1 free plan daily caps — not exposed by the API, hardcoded per Cloudflare docs
const FREE_DAILY_ROWS_READ = 5_000_000;
const FREE_DAILY_ROWS_WRITTEN = 100_000;

async function fetchDatabase(token, accountId, databaseId, http) {
  const res = await http.get(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data.result;
}

async function fetchUsage(token, accountId, databaseId, http) {
  const today = new Date().toISOString().slice(0, 10);
  const query = `
    query D1Usage($accountTag: string!, $databaseId: string, $date: Date) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          d1AnalyticsAdaptiveGroups(limit: 1000, filter: { date: $date, databaseId: $databaseId }) {
            sum { rowsRead rowsWritten readQueries writeQueries }
          }
        }
      }
    }`;
  const res = await http.post('https://api.cloudflare.com/client/v4/graphql',
    { query, variables: { accountTag: accountId, databaseId, date: today } },
    { headers: { Authorization: `Bearer ${token}` } },
  );

  const groups = res.data?.data?.viewer?.accounts?.[0]?.d1AnalyticsAdaptiveGroups || [];
  return groups.reduce((acc, g) => ({
    rowsRead: acc.rowsRead + (g.sum.rowsRead || 0),
    rowsWritten: acc.rowsWritten + (g.sum.rowsWritten || 0),
    readQueries: acc.readQueries + (g.sum.readQueries || 0),
    writeQueries: acc.writeQueries + (g.sum.writeQueries || 0),
  }), { rowsRead: 0, rowsWritten: 0, readQueries: 0, writeQueries: 0 });
}

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { apiToken, accountId, databaseId, planType = 'free', proxy } = config;
  if (!apiToken || !accountId || !databaseId) {
    return { status: 'error', state: null, metrics: null, notifications: [
      { ...L.missingConfig('Cloudflare D1', 'API Token, Account ID and Database ID required'), level: 'error', type: 'status_change' }
    ]};
  }

  const proxyAgents = getProxyAgents(proxy);
  const http = axios.create({
    timeout: 10000,
    ...(proxyAgents && { httpsAgent: proxyAgents.httpsAgent, httpAgent: proxyAgents.httpAgent }),
  });

  const [db, usage] = await Promise.all([
    fetchDatabase(apiToken, accountId, databaseId, http),
    fetchUsage(apiToken, accountId, databaseId, http),
  ]);

  const isFree = planType === 'free';
  const readPct = isFree ? Math.round((usage.rowsRead / FREE_DAILY_ROWS_READ) * 1000) / 10 : null;
  const writePct = isFree ? Math.round((usage.rowsWritten / FREE_DAILY_ROWS_WRITTEN) * 1000) / 10 : null;

  const critical = isFree && (readPct >= 100 || writePct >= 100);
  const warning = isFree && !critical && (readPct >= 90 || writePct >= 90);
  const wasCritical = lastState?.critical === true;

  const notifications = [];
  if (lastState !== null) {
    if (critical && !wasCritical) {
      notifications.push({ ...L.d1QuotaExceeded(db?.name || databaseId, readPct, writePct), level: 'error', type: 'alert' });
    } else if (!critical && wasCritical) {
      notifications.push({ ...L.d1QuotaRecovered(db?.name || databaseId), level: 'success', type: 'alert' });
    }
  }

  return {
    status: critical ? 'error' : warning ? 'warning' : 'online',
    state: { critical, rowsRead: usage.rowsRead, rowsWritten: usage.rowsWritten },
    metrics: {
      name: db?.name || null,
      sizeBytes: db?.file_size ?? null,
      numTables: db?.num_tables ?? null,
      rowsRead: usage.rowsRead,
      rowsWritten: usage.rowsWritten,
      readQueries: usage.readQueries,
      writeQueries: usage.writeQueries,
      readPct,
      writePct,
      planType,
    },
    notifications,
  };
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  return L.d1Report(state?.rowsRead, state?.rowsWritten);
}

module.exports = { check, report };
