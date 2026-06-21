const dns = require('node:dns/promises');

const RESOLVERS = {
  A:     (h) => dns.resolve4(h),
  AAAA:  (h) => dns.resolve6(h),
  CNAME: (h) => dns.resolveCname(h),
  MX:    (h) => dns.resolveMx(h).then(r => r.map(e => e.exchange)),
  TXT:   (h) => dns.resolveTxt(h).then(r => r.map(a => a.join(''))),
  NS:    (h) => dns.resolveNs(h),
};

async function check(config) {
  const { hostname, recordType = 'A', expectedValue } = config;

  if (!hostname) return {
    status: 'error',
    state: null,
    metrics: null,
    lastError: 'Hostname requis',
    notifications: [{ title: 'Config manquante — DNS', message: 'Hostname requis', level: 'error', type: 'status_change' }],
  };

  const resolver = RESOLVERS[recordType];
  if (!resolver) return {
    status: 'error',
    state: null,
    metrics: null,
    lastError: `Type DNS inconnu : ${recordType}`,
    notifications: [{ title: 'DNS — Type inconnu', message: `Type ${recordType} non supporté`, level: 'error', type: 'status_change' }],
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
        lastError = `Valeur attendue "${expectedValue}" non trouvée — obtenu : ${resolved}`;
      }
    }

    return {
      status,
      lastError,
      state: { hostname, recordType, resolved, responseTime },
      metrics: { responseTime },
      notifications: status !== 'online' ? [{
        title: `DNS ${hostname} — Valeur inattendue`,
        message: lastError,
        level: 'warning',
        type: 'status_change',
      }] : [],
    };
  } catch (err) {
    const lastError = `Résolution DNS échouée : ${err.message}`;
    return {
      status: 'offline',
      lastError,
      state: { hostname, recordType, resolved: null },
      metrics: null,
      notifications: [{
        title: `DNS ${hostname} — Échec`,
        message: lastError,
        level: 'error',
        type: 'status_change',
      }],
    };
  }
}

module.exports = { check };
