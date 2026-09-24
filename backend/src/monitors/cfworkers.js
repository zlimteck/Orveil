const axios = require('axios');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');

async function fetchScript(token, accountId, scriptName, http) {
  try {
    const res = await http.get(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data.result;
  } catch {
    return null;
  }
}

async function fetchUsage(token, accountId, scriptName, http) {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const query = `
    query WorkersUsage($accountTag: string!, $scriptName: string, $start: string!, $end: string!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workersInvocationsAdaptive(limit: 1000, filter: { scriptName: $scriptName, datetime_geq: $start, datetime_leq: $end }) {
            sum { requests errors subrequests }
            quantiles { cpuTimeP50 cpuTimeP99 }
          }
        }
      }
    }`;
  const res = await http.post('https://api.cloudflare.com/client/v4/graphql', {
    query,
    variables: { accountTag: accountId, scriptName, start: start.toISOString(), end: end.toISOString() },
  }, { headers: { Authorization: `Bearer ${token}` } });

  const groups = res.data?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive || [];
  const totals = groups.reduce((acc, g) => ({
    requests: acc.requests + (g.sum?.requests || 0),
    errors: acc.errors + (g.sum?.errors || 0),
    subrequests: acc.subrequests + (g.sum?.subrequests || 0),
  }), { requests: 0, errors: 0, subrequests: 0 });

  const last = groups[groups.length - 1];
  return { ...totals, cpuTimeP50: last?.quantiles?.cpuTimeP50 ?? null, cpuTimeP99: last?.quantiles?.cpuTimeP99 ?? null };
}

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { apiToken, accountId, scriptName, errorRateThreshold = 5, proxy } = config;
  if (!apiToken || !accountId || !scriptName) {
    return { status: 'error', state: null, metrics: null, notifications: [
      { ...L.missingConfig('Cloudflare Workers', 'API Token, Account ID and Script Name required'), level: 'error', type: 'status_change' }
    ]};
  }

  const proxyAgents = getProxyAgents(proxy);
  const http = axios.create({
    timeout: 10000,
    ...(proxyAgents && { httpsAgent: proxyAgents.httpsAgent, httpAgent: proxyAgents.httpAgent }),
  });

  const [script, usage] = await Promise.all([
    fetchScript(apiToken, accountId, scriptName, http),
    fetchUsage(apiToken, accountId, scriptName, http),
  ]);

  const errorRate = usage.requests > 0 ? Math.round((usage.errors / usage.requests) * 1000) / 10 : 0;
  const unhealthy = usage.requests > 0 && errorRate >= errorRateThreshold;
  const wasUnhealthy = lastState?.unhealthy === true;

  const notifications = [];
  if (lastState !== null) {
    if (unhealthy && !wasUnhealthy) {
      notifications.push({ ...L.workersErrorRateHigh(scriptName, errorRate), level: 'error', type: 'alert' });
    } else if (!unhealthy && wasUnhealthy) {
      notifications.push({ ...L.workersErrorRateRecovered(scriptName), level: 'success', type: 'alert' });
    }
  }

  return {
    status: unhealthy ? 'warning' : 'online',
    state: { unhealthy, requests: usage.requests, errors: usage.errors, errorRate },
    metrics: {
      requests: usage.requests,
      errors: usage.errors,
      errorRate,
      subrequests: usage.subrequests,
      cpuTimeP50: usage.cpuTimeP50,
      cpuTimeP99: usage.cpuTimeP99,
      modifiedOn: script?.modified_on || null,
    },
    notifications,
  };
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  return L.workersReport(state?.requests || 0, state?.errors || 0, state?.errorRate || 0);
}

module.exports = { check, report };
