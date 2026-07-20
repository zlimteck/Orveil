const axios = require('axios');
const https = require('https');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');
const { ruleConfig } = require('../config/alertRules');

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { apiUrl, apiKey, rejectUnauthorized = true, proxy } = config;

  if (!apiUrl || !apiKey) return {
    status: 'error', state: null, metrics: null,
    notifications: [{ ...L.missingConfig('Speedtest Tracker', 'URL and API key required'), level: 'error', type: 'status_change' }],
  };

  const base = apiUrl.replace(/\/$/, '');

  try {
    const proxyAgents = getProxyAgents(proxy);
    const res = await axios.get(`${base}/api/v1/results/latest`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      timeout: 15000,
      httpsAgent: proxyAgents?.httpsAgent || new https.Agent({ rejectUnauthorized }),
      ...(proxyAgents && { httpAgent: proxyAgents.httpAgent }),
    });

    const d = res.data?.data;
    if (!d) throw new Error('Unexpected API response');

    const rawDown = d.data?.download?.bandwidth;
    const rawUp   = d.data?.upload?.bandwidth;
    const downloadMbps = rawDown != null
      ? Math.round((rawDown / 125000) * 10) / 10
      : (d.download != null ? Math.round(parseFloat(d.download) * 10) / 10 : null);
    const uploadMbps = rawUp != null
      ? Math.round((rawUp / 125000) * 10) / 10
      : (d.upload != null ? Math.round(parseFloat(d.upload) * 10) / 10 : null);

    const pingMs   = d.data?.ping?.latency != null ? Math.round(d.data.ping.latency * 10) / 10 : (d.ping != null ? Math.round(parseFloat(d.ping) * 10) / 10 : null);
    const jitterMs = d.data?.ping?.jitter  != null ? Math.round(d.data.ping.jitter  * 10) / 10 : null;

    const successful = d.is_successful ?? d.status === 'completed' ?? true;
    const status = successful ? 'online' : 'warning';

    const failReason = !successful
      ? (d.data?.result?.message || d.message || L.speedtestFailedFallback)
      : null;

    const metrics = { downloadMbps, uploadMbps, pingMs, jitterMs };

    const testRule = ruleConfig(config.alertRules, 'speedtest', 'test_failed');
    const notifications = [];
    if (testRule.enabled && lastState && successful !== (lastState.successful ?? true)) {
      const notif = L.speedtestResult(successful, failReason);
      notifications.push({ ...notif, level: successful ? 'info' : 'warning', type: 'alert' });
    }

    return { status, lastError: failReason, state: { ...metrics, successful }, metrics, notifications };
  } catch (err) {
    console.error('[speedtest]', err.message);
    return {
      status: 'error', lastError: err.message, state: lastState, metrics: null,
      notifications: [{ ...L.apiError('Speedtest Tracker', err.message), level: 'error', type: 'status_change' }],
    };
  }
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  if (!state) return { title: 'Speedtest Tracker', message: 'No data.' };
  return L.speedtestReport(state);
}

module.exports = { check, report };
