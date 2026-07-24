const axios = require('axios');
const https = require('https');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');
const { ruleConfig } = require('../config/alertRules');

function fmtBytes(b) {
  if (b == null) return '—';
  if (b < 1024) return `${b} B/s`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB/s`;
  return `${(b / 1024 / 1024).toFixed(2)} MB/s`;
}

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
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

  const errRule = ruleConfig(config.alertRules, 'rclone', 'transfer_errors');
  const notifications = [];
  const prevErrors = lastState?.errors ?? 0;
  if (errRule.enabled) {
    if (errors > 0 && prevErrors === 0) {
      notifications.push({ ...L.rcloneTransferErrors(errors), level: 'warning', type: 'alert' });
    } else if (errors === 0 && prevErrors > 0) {
      notifications.push({ ...L.rcloneTransferErrorsResolved(), level: 'success', type: 'alert' });
    }
  }

  // If a script pushed stats recently (< 2 min), prefer them over daemon stats (which stay at 0)
  const pushed = lastState?.pushedAt ? new Date(lastState.pushedAt) : null;
  const pushFresh = pushed && (Date.now() - pushed.getTime()) < 2 * 60 * 1000;
  const activeDlSpeed      = pushFresh ? (lastState.dlSpeed      ?? dlSpeed)      : dlSpeed;
  const activeUlSpeed      = pushFresh ? (lastState.ulSpeed      ?? ulSpeed)      : ulSpeed;
  const activeTransfersActive = pushFresh ? (lastState.transfersActive ?? transfersActive) : transfersActive;
  const activeTransfersTotal  = pushFresh ? (lastState.transfersTotal  ?? transfersTotal)  : transfersTotal;
  const activeErrors       = pushFresh ? (lastState.errors       ?? errors)       : errors;
  const activeChecks       = pushFresh ? (lastState.checks       ?? checks)       : checks;

  return {
    status: 'online',
    statusCode: 200,
    responseTime,
    state: {
      version, mountCount, jobCount, mounts, diskTotal, diskUsed, diskFree, diskPct,
      dlSpeed: activeDlSpeed, ulSpeed: activeUlSpeed,
      transfersActive: activeTransfersActive, transfersTotal: activeTransfersTotal,
      errors: activeErrors, checks: activeChecks,
      ...(pushFresh ? { pushedAt: lastState.pushedAt, fileName: lastState.fileName, elapsed: lastState.elapsed, done: lastState.done } : {}),
    },
    metrics: {
      version, responseTime, statusCode: 200, mountCount, jobCount, diskTotal, diskUsed, diskFree, diskPct,
      dlSpeed: activeDlSpeed, ulSpeed: activeUlSpeed,
      transfersActive: activeTransfersActive, transfersTotal: activeTransfersTotal,
      errors: activeErrors, checks: activeChecks,
    },
    notifications,
  };
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  return L.rcloneReport(state);
}

module.exports = { check, report };
