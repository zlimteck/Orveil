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
    notifications: [{ ...L.missingConfig('Overseerr', 'URL and API key required'), level: 'error', type: 'status_change' }],
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
    const [statusRes, requestsRes, pendingRes] = await Promise.all([
      http.get(`${base}/api/v1/status`),
      http.get(`${base}/api/v1/request?take=1&skip=0`),
      http.get(`${base}/api/v1/request?take=1&skip=0&filter=pending`),
    ]);
    const responseTime = Date.now() - start;

    const version = statusRes.data?.version || null;
    const requestsTotal = requestsRes.data?.pageInfo?.results ?? 0;
    const requestsPending = pendingRes.data?.pageInfo?.results ?? 0;

    const pendingRule = ruleConfig(config.alertRules, 'overseerr', 'pending_requests');
    const notifications = [];
    if (pendingRule.enabled && requestsPending > 0 && (!lastState || lastState.requestsPending === 0)) {
      notifications.push({ ...L.overseerrPendingRequests(requestsPending), level: 'info', type: 'alert' });
    }

    const state = { version, requestsTotal, requestsPending };
    const metrics = { version, requestsTotal, requestsPending, responseTime, statusCode: statusRes.status };

    return { status: 'online', lastError: null, state, metrics, notifications };
  } catch (err) {
    return {
      status: 'offline', lastError: err.message, state: null, metrics: null,
      notifications: [{ ...L.unreachable('Overseerr', '', err.message), level: 'error', type: 'status_change' }],
    };
  }
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  if (!state) return { title: 'Overseerr', message: 'No data.' };
  return L.overseerrReport(state);
}

module.exports = { check, report };
