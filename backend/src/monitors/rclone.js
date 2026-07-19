const axios = require('axios');
const https = require('https');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');

function fmtBytes(b) {
  if (b == null) return '—';
  if (b < 1024) return `${b} B/s`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB/s`;
  return `${(b / 1024 / 1024).toFixed(2)} MB/s`;
}

async function check(config) {
  const { apiUrl, username, password, remoteName, rejectUnauthorized = true, proxy } = config;
  if (!apiUrl) throw new Error('apiUrl required');

  const baseUrl = apiUrl.replace(/\/$/, '');
  const start = Date.now();
  const proxyAgents = getProxyAgents(proxy);
  const httpsAgent = proxyAgents?.httpsAgent || new https.Agent({ rejectUnauthorized });

  const auth = username ? { username, password: password || '' } : undefined;
  const opts = { httpsAgent, timeout: 8000, auth, ...(proxyAgents && { httpAgent: proxyAgents.httpAgent }) };

  const [statsRes, versionRes, jobsRes, mountsRes] = await Promise.all([
    axios.post(`${baseUrl}/core/stats`, {}, opts),
    axios.post(`${baseUrl}/core/version`, {}, opts),
    axios.post(`${baseUrl}/job/list`, {}, opts).catch(() => null),
    axios.post(`${baseUrl}/mount/listmounts`, {}, opts).catch(() => null),
  ]);

  const aboutRes = remoteName
    ? await axios.post(`${baseUrl}/operations/about`, { fs: remoteName }, opts).catch(() => null)
    : null;

  const responseTime = Date.now() - start;
  const stats = statsRes.data || {};
  const ver = versionRes.data || {};
  const jobs = jobsRes?.data?.executing ? Object.keys(jobsRes.data.executing) : [];
  const mounts = mountsRes?.data?.mountPoints || [];
  const about = aboutRes?.data || null;

  const dlSpeed = stats.speed ?? 0;
  const ulSpeed = stats.transferring?.reduce((s, t) => s + (t.speedAvg || 0), 0) ?? 0;
  const transfersActive = stats.transferring?.length ?? 0;
  const transfersTotal = stats.transfers ?? 0;
  const errors = stats.errors ?? 0;
  const checks = stats.checks ?? 0;
  const version = ver.version ?? null;

  const diskTotal = about?.total ?? null;
  const diskUsed = about?.used ?? null;
  const diskFree = about?.free ?? null;
  const diskPct = diskTotal && diskUsed != null ? Math.round((diskUsed / diskTotal) * 100) : null;

  const mountCount = mounts.length;
  const jobCount = jobs.length;

  return {
    status: 'online',
    statusCode: 200,
    responseTime,
    state: { version, dlSpeed, ulSpeed, transfersActive, transfersTotal, errors, checks, diskTotal, diskUsed, diskFree, diskPct, mountCount, jobCount, mounts },
    metrics: { version, dlSpeed, ulSpeed, transfersActive, transfersTotal, errors, checks, diskTotal, diskUsed, diskFree, diskPct, mountCount, jobCount, responseTime, statusCode: 200 },
  };
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  return L.rcloneReport(state);
}

module.exports = { check, report };
