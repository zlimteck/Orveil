const axios = require('axios');
const https = require('https');
const cfHeaders = require('./cfHeaders');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');

async function check(config) {
  const { apiUrl, apiKey, rejectUnauthorized = true, proxy } = config;
  if (!apiUrl) throw new Error('apiUrl required');

  const baseUrl = apiUrl.replace(/\/$/, '');
  const start = Date.now();
  const proxyAgents = getProxyAgents(proxy);
  const httpsAgent = proxyAgents?.httpsAgent || new https.Agent({ rejectUnauthorized });
  const cf = cfHeaders(config);
  const headers = { ...cf, ...(apiKey ? { 'X-API-Token': apiKey } : {}) };
  const opts = { httpsAgent, timeout: 8000, headers };

  const [statsRes, filtersRes, configRes] = await Promise.all([
    axios.get(`${baseUrl}/api/release/stats`, opts),
    axios.get(`${baseUrl}/api/filters`, opts),
    axios.get(`${baseUrl}/api/config`, opts).catch(() => null),
  ]);

  const responseTime = Date.now() - start;
  const version = configRes?.data?.version ?? null;
  const stats = statsRes.data || {};
  const filters = Array.isArray(filtersRes.data) ? filtersRes.data : [];
  const filtersTotal = filters.length;
  const filtersEnabled = filters.filter(f => f.enabled).length;
  const releasesTotal = stats.total_count ?? null;
  const releasesPushed = stats.push_approved_count ?? null;
  const releasesRejected = stats.push_rejected_count ?? null;

  return {
    status: 'online',
    statusCode: 200,
    responseTime,
    state: { version, filtersTotal, filtersEnabled, releasesTotal, releasesPushed, releasesRejected },
    metrics: { version, filtersTotal, filtersEnabled, releasesTotal, releasesPushed, releasesRejected, responseTime, statusCode: 200 },
  };
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  return L.autobrrReport(state);
}

module.exports = { check, report };
