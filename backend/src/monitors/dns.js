const dns = require('node:dns/promises');
const i18n = require('../i18n');

const RESOLVERS = {
  A:     (h) => dns.resolve4(h),
  AAAA:  (h) => dns.resolve6(h),
  CNAME: (h) => dns.resolveCname(h),
  MX:    (h) => dns.resolveMx(h).then(r => r.map(e => e.exchange)),
  TXT:   (h) => dns.resolveTxt(h).then(r => r.map(a => a.join(''))),
  NS:    (h) => dns.resolveNs(h),
};

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { hostname, recordType = 'A', expectedValue } = config;

  if (!hostname) return {
    status: 'error',
    state: null,
    metrics: null,
    lastError: 'Hostname required',
    notifications: [{ ...L.missingConfig('DNS', 'Hostname required'), level: 'error', type: 'status_change' }],
  };

  const resolver = RESOLVERS[recordType];
  if (!resolver) return {
    status: 'error',
    state: null,
    metrics: null,
    lastError: `Unknown DNS type: ${recordType}`,
    notifications: [{ ...L.dnsUnknownType(recordType), level: 'error', type: 'status_change' }],
  };

  const start = Date.now();
  try {
    const records = await resolver(hostname);
    const responseTime = Date.now() - start;
    const resolved = records.join(', ');

    let status = 'online';
    let lastError = null;

    if (expectedValue) {
      const expected = expectedValue.trim().toLowerCase();
      const match = records.some(r => r.toLowerCase().includes(expected));
      if (!match) {
        status = 'warning';
        lastError = `Expected value "${expectedValue}" not found — got: ${resolved}`;
      }
    }

    return {
      status,
      lastError,
      state: { hostname, recordType, resolved, responseTime },
      metrics: { responseTime },
      notifications: status !== 'online' ? [{ ...L.dnsUnexpectedValue(hostname, expectedValue, resolved), level: 'warning', type: 'status_change' }] : [],
    };
  } catch (err) {
    return {
      status: 'offline',
      lastError: `DNS resolution failed: ${err.message}`,
      state: { hostname, recordType, resolved: null },
      metrics: null,
      notifications: [{ ...L.dnsFailed(hostname, err.message), level: 'error', type: 'status_change' }],
    };
  }
}

module.exports = { check };
