const axios = require('axios');
const https = require('https');
const cfHeaders = require('./cfHeaders');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');


async function login(baseUrl, username, password, httpsAgent) {
  const res = await axios.post(
    `${baseUrl}/api/v2/auth/login`,
    new URLSearchParams({ username, password }),
    { httpsAgent, timeout: 8000, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, maxRedirects: 0 },
  );
  const cookies = res.headers['set-cookie'] || [];
  const sid = cookies.find(c => c.startsWith('SID='));
  if (!sid || res.data === 'Fails.') throw new Error('Login failed — check credentials');
  return sid.split(';')[0];
}

async function check(config) {
  const { apiUrl, username = 'admin', password = '', rejectUnauthorized = true, proxy } = config;
  if (!apiUrl) throw new Error('apiUrl required');

  const baseUrl = apiUrl.replace(/\/$/, '');
  const start = Date.now();
  const proxyAgents = getProxyAgents(proxy);
  const httpsAgent = proxyAgents?.httpsAgent || new https.Agent({ rejectUnauthorized });
  const cf = cfHeaders(config);

  const cookie = await login(baseUrl, username, password, httpsAgent);
  const headers = { Cookie: cookie, ...cf };
  const opts = { httpsAgent, timeout: 8000, headers };

  const [versionRes, infoRes, torrentsRes] = await Promise.all([
    axios.get(`${baseUrl}/api/v2/app/version`, opts),
    axios.get(`${baseUrl}/api/v2/transfer/info`, opts),
    axios.get(`${baseUrl}/api/v2/torrents/info`, opts),
  ]);

  const responseTime = Date.now() - start;
  const version = versionRes.data?.trim?.() ?? null;
  const info = infoRes.data || {};
  const torrents = Array.isArray(torrentsRes.data) ? torrentsRes.data : [];
  const torrentsTotal = torrents.length;
  const torrentsActive = torrents.filter(t =>
    ['downloading', 'uploading', 'stalledDL', 'stalledUP', 'forcedDL', 'forcedUP'].includes(t.state),
  ).length;
  const dlSpeed = info.dl_info_speed ?? 0;
  const ulSpeed = info.up_info_speed ?? 0;

  return {
    status: 'online',
    statusCode: 200,
    responseTime,
    state: { version, torrentsTotal, torrentsActive, dlSpeed, ulSpeed },
    metrics: { version, torrentsTotal, torrentsActive, dlSpeed, ulSpeed, responseTime, statusCode: 200 },
  };
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  return L.qbittorrentReport(state);
}

module.exports = { check, report };
