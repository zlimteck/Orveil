const axios = require('axios');
const https = require('https');
const cfHeaders = require('./cfHeaders');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');
const { ruleConfig } = require('../config/alertRules');

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { apiUrl, apiKey, rejectUnauthorized = true, proxy } = config;

  if (!apiUrl || !apiKey) return {
    status: 'error', state: null, metrics: null,
    notifications: [{ ...L.missingConfig('Radarr', 'URL and API key required'), level: 'error', type: 'status_change' }],
  };

  const base = apiUrl.replace(/\/$/, '');
  const proxyAgents = getProxyAgents(proxy);
  const http = axios.create({
    timeout: 10000,
    httpsAgent: proxyAgents?.httpsAgent || new https.Agent({ rejectUnauthorized }),
    ...(proxyAgents && { httpAgent: proxyAgents.httpAgent }),
    headers: { 'X-Api-Key': apiKey, ...cfHeaders(config) },
  });

  const start = Date.now();
  try {
    const [statusRes, healthRes, movieRes, missingRes, queueRes] = await Promise.all([
      http.get(`${base}/api/v3/system/status`),
      http.get(`${base}/api/v3/health`),
      http.get(`${base}/api/v3/movie`),
      http.get(`${base}/api/v3/wanted/missing?pageSize=1`),
      http.get(`${base}/api/v3/queue?pageSize=1`),
    ]);
    const responseTime = Date.now() - start;

    const version = statusRes.data?.version || null;
    const warnings = (healthRes.data || []).filter(h => h.type === 'warning' || h.type === 'error');
    const movieCount = Array.isArray(movieRes.data) ? movieRes.data.length : 0;
    const missingCount = missingRes.data?.totalRecords ?? 0;
    const queueCount = queueRes.data?.totalRecords ?? 0;

    const healthRule = ruleConfig(config.alertRules, 'radarr', 'health_warning');
    const notifications = [];
    if (healthRule.enabled && warnings.length > 0 && (!lastState || lastState.warningsCount === 0)) {
      notifications.push({ ...L.arrHealthWarning('Radarr', warnings[0].message), level: 'warning', type: 'alert' });
    }

    const state = { version, movieCount, missingCount, queueCount, warningsCount: warnings.length };
    const metrics = { version, movieCount, missingCount, queueCount, warningsCount: warnings.length, responseTime, statusCode: statusRes.status };

    return { status: 'online', lastError: null, state, metrics, notifications };
  } catch (err) {
    return {
      status: 'offline', lastError: err.message, state: null, metrics: null,
      notifications: [{ ...L.unreachable('Radarr', '', err.message), level: 'error', type: 'status_change' }],
    };
  }
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  if (!state) return { title: 'Radarr', message: 'No data.' };
  return L.radarrReport(state);
}

module.exports = { check, report };
