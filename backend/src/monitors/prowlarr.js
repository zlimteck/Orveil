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
    notifications: [{ ...L.missingConfig('Prowlarr', 'URL and API key required'), level: 'error', type: 'status_change' }],
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
    const [statusRes, healthRes, indexersRes] = await Promise.all([
      http.get(`${base}/api/v1/system/status`),
      http.get(`${base}/api/v1/health`),
      http.get(`${base}/api/v1/indexer`),
    ]);
    const responseTime = Date.now() - start;

    const version = statusRes.data?.version || null;
    const warnings = (healthRes.data || []).filter(h => h.type === 'warning' || h.type === 'error');
    const indexers = Array.isArray(indexersRes.data) ? indexersRes.data : [];
    const indexersTotal = indexers.length;
    const indexersEnabled = indexers.filter(i => i.enable).length;

    const healthRule = ruleConfig(config.alertRules, 'prowlarr', 'health_warning');
    const notifications = [];
    if (healthRule.enabled && warnings.length > 0 && (!lastState || lastState.warningsCount === 0)) {
      notifications.push({ ...L.arrHealthWarning('Prowlarr', warnings[0].message), level: 'warning', type: 'alert' });
    }

    const state = { version, indexersTotal, indexersEnabled, warningsCount: warnings.length };
    const metrics = { version, indexersTotal, indexersEnabled, warningsCount: warnings.length, responseTime, statusCode: statusRes.status };

    return { status: 'online', lastError: null, state, metrics, notifications };
  } catch (err) {
    return {
      status: 'offline', lastError: err.message, state: null, metrics: null,
      notifications: [{ ...L.unreachable('Prowlarr', '', err.message), level: 'error', type: 'status_change' }],
    };
  }
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  if (!state) return { title: 'Prowlarr', message: 'No data.' };
  return L.prowlarrReport(state);
}

module.exports = { check, report };
