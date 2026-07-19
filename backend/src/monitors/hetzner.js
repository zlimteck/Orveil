const axios = require('axios');
const i18n = require('../i18n');

async function check(config) {
  const { apiToken, storageBoxId } = config;
  if (!apiToken || !storageBoxId) throw new Error('apiToken and storageBoxId required');

  const start = Date.now();
  const opts = {
    headers: { Authorization: `Bearer ${apiToken}` },
    timeout: 10000,
  };

  const res = await axios.get(`https://api.hetzner.com/v1/storage_boxes/${storageBoxId}`, opts);

  const responseTime = Date.now() - start;
  const box = res.data?.storage_box || {};

  const totalBytes = box.storage_box_type?.size ?? null;
  const usedBytes  = box.stats?.size ?? null;
  const snapBytes  = box.stats?.size_snapshots ?? null;

  const toGB = b => b != null ? parseFloat((b / 1073741824).toFixed(2)) : null;

  const diskTotalGB = toGB(totalBytes);
  const diskUsedGB  = toGB(usedBytes);
  const diskFreeGB  = diskTotalGB != null && diskUsedGB != null ? parseFloat((diskTotalGB - diskUsedGB).toFixed(2)) : null;
  const diskPct     = diskTotalGB && diskUsedGB != null ? Math.round((diskUsedGB / diskTotalGB) * 100) : null;
  const snapUsedGB  = toGB(snapBytes);

  const hostname    = box.server ?? null;
  const location    = box.location?.name ?? null;
  const name        = box.name ?? null;
  const username    = box.username ?? null;
  const status      = box.status ?? null;
  const snapshots   = null;
  const subaccounts = null;

  return {
    status: 'online',
    statusCode: 200,
    responseTime,
    state: { name, username, hostname, location, status, diskTotalGB, diskUsedGB, diskFreeGB, diskPct, snapUsedGB },
    metrics: { diskTotalGB, diskUsedGB, diskFreeGB, diskPct, snapUsedGB, responseTime, statusCode: 200 },
  };
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  return L.hetznerReport(state);
}

module.exports = { check, report };
