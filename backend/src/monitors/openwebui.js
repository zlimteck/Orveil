const axios = require('axios');
const https = require('https');
const cfHeaders = require('./cfHeaders');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { apiUrl, apiKey, rejectUnauthorized = true, proxy } = config;

  if (!apiUrl) return {
    status: 'error', state: null, metrics: null,
    notifications: [{ ...L.missingConfig('OpenWebUI', 'URL required'), level: 'error', type: 'status_change' }],
  };

  const base = apiUrl.replace(/\/$/, '');
  const proxyAgents = getProxyAgents(proxy);
  const headers = {
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...cfHeaders(config),
  };
  const http = axios.create({
    timeout: 10000,
    httpsAgent: proxyAgents?.httpsAgent || new https.Agent({ rejectUnauthorized }),
    ...(proxyAgents && { httpAgent: proxyAgents.httpAgent }),
    headers,
  });

  const start = Date.now();
  try {
    const [versionRes, modelsRes] = await Promise.all([
      http.get(`${base}/api/version`),
      http.get(`${base}/api/models`),
    ]);
    const responseTime = Date.now() - start;

    const version = versionRes.data?.version || null;
    const models = modelsRes.data?.data || modelsRes.data?.models || [];
    const modelsCount = models.length;
    const modelNames = models.map(m => m.name || m.id).filter(Boolean);

    // Optional: models currently loaded in Ollama VRAM
    let modelsRunning = null;
    try {
      const psRes = await http.get(`${base}/ollama/api/ps`);
      const running = psRes.data?.models || [];
      modelsRunning = running.length;
    } catch { /* no Ollama backend or endpoint not available */ }

    // Optional: total users count (requires admin API key)
    let usersCount = null;
    if (apiKey) {
      try {
        const usersRes = await http.get(`${base}/api/users`);
        const users = usersRes.data;
        usersCount = Array.isArray(users) ? users.length : null;
      } catch { /* not admin or endpoint unavailable */ }
    }

    const state = { version, modelsCount, modelNames, modelsRunning, usersCount, responseTime };
    const metrics = {
      version,
      modelsCount,
      modelNames,
      responseTime,
      statusCode: versionRes.status,
      ...(modelsRunning !== null && { modelsRunning }),
      ...(usersCount !== null && { usersCount }),
    };

    return { status: 'online', lastError: null, state, metrics, notifications: [] };
  } catch (err) {
    return {
      status: 'offline',
      lastError: err.message,
      state: null,
      metrics: null,
      notifications: [{ ...L.unreachable('OpenWebUI', '', err.message), level: 'error', type: 'status_change' }],
    };
  }
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  if (!state) return { title: 'OpenWebUI', message: 'No data.' };
  return L.openwebuiReport(state);
}

module.exports = { check, report };
