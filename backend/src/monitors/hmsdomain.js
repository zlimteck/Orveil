const axios = require('axios');
const cfHeaders = require('./cfHeaders');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');
const { ruleConfig } = require('../config/alertRules');

async function fetchDomain(hmsToken, domain, extraHeaders = {}, proxy = null) {
  const auth = hmsToken.startsWith('Bearer ') ? hmsToken : `Bearer ${hmsToken}`;
  const headers = { Authorization: auth, ...extraHeaders };
  const proxyAgents = getProxyAgents(proxy);
  const http = axios.create({
    timeout: 10000,
    ...(proxyAgents && { httpsAgent: proxyAgents.httpsAgent, httpAgent: proxyAgents.httpAgent }),
  });

  const res = await http.get(`https://www.hostmyservers.fr/api/domain/${domain}`, { headers });
  const info = res.data?.data;
  if (!info) throw new Error(`Info not found for domain ${domain}`);

  return {
    domain,
    statusCode: res.status,
    status: info.status,
    statusLabel: info.status_label || null,
    isLocked: !!info.is_locked,
    nameservers: info.nameservers || [],
    expiredAt: info.expired_at || null,
  };
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { hmsToken, domainList, proxy } = config;

  if (!hmsToken || !domainList?.length) {
    return { status: 'error', state: null, metrics: null, notifications: [
      { ...L.missingConfig('HMS Domain', 'HMS Token and at least one domain required'), level: 'error', type: 'status_change' }
    ]};
  }

  const results = [];
  const errors = [];

  for (const d of domainList) {
    try {
      const data = await fetchDomain(hmsToken, d.domain, cfHeaders(config), proxy);
      data.daysLeft = daysUntil(data.expiredAt);
      results.push(data);
    } catch (err) {
      console.error(`[HMS Domain] error ${d.domain}:`, err.message);
      errors.push({ domain: d.domain, error: err.message });
    }
  }

  const notifications = [];
  const prevMap = lastState?.domains
    ? Object.fromEntries(lastState.domains.map(d => [d.domain, d]))
    : null;

  const expiringRule     = ruleConfig(config.alertRules, 'hmsdomain', 'expiring_soon');
  const unreachableRule  = ruleConfig(config.alertRules, 'hmsdomain', 'domain_unreachable');

  if (prevMap) {
    for (const d of results) {
      const prev = prevMap[d.domain];
      if (prev && expiringRule.enabled && d.daysLeft != null
        && d.daysLeft <= expiringRule.threshold && (prev.daysLeft == null || prev.daysLeft > expiringRule.threshold)) {
        notifications.push({ ...L.hmsDomainExpiringSoon(d.domain, d.daysLeft), level: 'warning', type: 'alert' });
      }
    }
    for (const err of errors) {
      const prev = prevMap[err.domain];
      if (unreachableRule.enabled && prev && !prev.error) {
        notifications.push({ ...L.hmsDomainUnreachable(err.domain, err.error), level: 'error', type: 'alert' });
      }
    }
  }

  const expiringRuleForStatus = ruleConfig(config.alertRules, 'hmsdomain', 'expiring_soon');
  const anyExpiring = results.some(d => d.daysLeft != null && d.daysLeft <= expiringRuleForStatus.threshold);

  const status = errors.length === domainList.length ? 'error'
    : errors.length > 0 || anyExpiring ? 'warning'
    : 'online';

  const state = { domains: results, errors };
  const metrics = {
    domain_count: results.length,
    min_days_left: results.length ? Math.min(...results.map(d => d.daysLeft ?? Infinity)) : null,
    domains: results,
    statusCode: results[0]?.statusCode ?? null,
  };

  return { status, state, metrics, notifications };
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const domains = state?.domains || [];
  return L.hmsDomainReport(domains, state?.errors);
}

module.exports = { check, report };
