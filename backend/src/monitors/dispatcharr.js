const axios = require('axios');
const https = require('https');
const cfHeaders = require('./cfHeaders');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { apiUrl, apiKey, rejectUnauthorized = true, proxy } = config;

  if (!apiUrl || !apiKey) return {
    status: 'error', state: null, metrics: null,
    notifications: [{ ...L.missingConfig('Dispatcharr', 'URL and API key required'), level: 'error', type: 'status_change' }],
  };

  const base = apiUrl.replace(/\/$/, '');
  const proxyAgents = getProxyAgents(proxy);
  const http = axios.create({
    timeout: 10000,
    httpsAgent: proxyAgents?.httpsAgent || new https.Agent({ rejectUnauthorized }),
    ...(proxyAgents && { httpAgent: proxyAgents.httpAgent }),
    headers: { 'X-API-Key': apiKey, ...cfHeaders(config) },
  });

  const start = Date.now();
  try {
    const [versionRes, streamsRes, channelsRes] = await Promise.all([
      http.get(`${base}/api/core/version/`),
      http.get(`${base}/api/channels/streams/`),
      http.get(`${base}/api/channels/channels/`),
    ]);
    const responseTime = Date.now() - start;

    const version = versionRes.data?.version ?? null;

    const streams = Array.isArray(streamsRes.data?.results)
      ? streamsRes.data.results
      : Array.isArray(streamsRes.data) ? streamsRes.data : [];

    const channels = Array.isArray(channelsRes.data?.results)
      ? channelsRes.data.results
      : Array.isArray(channelsRes.data) ? channelsRes.data : [];

    const streamsTotal = streams.length;
    const activeStreams = streams.filter(s => (s.current_viewers ?? 0) > 0).length;
    const totalViewers = streams.reduce((sum, s) => sum + (s.current_viewers ?? 0), 0);
    const channelsTotal = channels.length;

    const state = { version, streamsTotal, activeStreams, totalViewers, channelsTotal };
    const metrics = { version, streamsTotal, activeStreams, totalViewers, channelsTotal, responseTime, statusCode: 200 };

    return { status: 'online', lastError: null, state, metrics, notifications: [] };
  } catch (err) {
    return {
      status: 'offline', lastError: err.message, state: null, metrics: null,
      notifications: [{ ...L.unreachable('Dispatcharr', '', err.message), level: 'error', type: 'status_change' }],
    };
  }
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  if (!state) return { title: 'Dispatcharr', message: 'No data.' };
  return L.dispatcharrReport(state);
}

module.exports = { check, report };
