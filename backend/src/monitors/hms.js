const axios = require('axios');
const cfHeaders = require('./cfHeaders');

const http = axios.create({ timeout: 10000 });

async function fetchVps(hmsToken, vpsId, vpsName, extraHeaders = {}) {
  const auth = hmsToken.startsWith('Bearer ') ? hmsToken : `Bearer ${hmsToken}`;
  const headers = { Authorization: auth, ...extraHeaders };

  const infoRes = await http.get(`https://www.hostmyservers.fr/api/cloud/${vpsId}`, { headers });
  const info = infoRes.data?.data;
  if (!info) throw new Error(`Infos introuvables pour VPS ${vpsName}`);

  return {
    id: vpsId,
    name: vpsName || info.hostname,
    hostname: info.hostname,
    ipv4: info.ipv4 || null,
    ipv6: info.ipv6 || null,
    state: info.state,
    os: info.system?.os_short || null,
    datacenter: info.model?.datacenter || null,
    vcores: info.model?.vcore || null,
    disk_gb: info.model?.disk || null,
    ram_gb: info.model?.memory || null,
    expired_at: info.expired_at || null,
  };
}

async function check(config, lastState) {
  const { hmsToken, vpsList } = config;

  if (!hmsToken || !vpsList?.length) {
    return { status: 'error', state: null, metrics: null, notifications: [
      { title: 'Config manquante — HMS', message: 'HMS Token et au moins un VPS requis', level: 'error', type: 'error' }
    ]};
  }

  const results = [];
  const errors = [];

  for (const vps of vpsList) {
    try {
      const data = await fetchVps(hmsToken, vps.id, vps.name, cfHeaders(config));
      results.push(data);
    } catch (err) {
      console.error(`[HMS] Erreur VPS ${vps.name || vps.id}:`, err.message);
      errors.push({ id: vps.id, name: vps.name, error: err.message });
    }
  }

  const notifications = [];
  const prevMap = lastState?.vps
    ? Object.fromEntries(lastState.vps.map(v => [v.id, v]))
    : null;

  if (prevMap) {
    for (const vps of results) {
      const prev = prevMap[vps.id];
      if (prev) {
        if (vps.cpu > 90 && prev.cpu <= 90) {
          notifications.push({
            title: `⚠️ CPU élevé — ${vps.name}`,
            message: `CPU à ${vps.cpu}% sur ${vps.name} (${vps.ipv4 || vps.id})`,
            level: 'warning', type: 'status_change',
          });
        }
        if (vps.memory_pct > 90 && prev.memory_pct <= 90) {
          notifications.push({
            title: `⚠️ Mémoire saturée — ${vps.name}`,
            message: `RAM à ${vps.memory_pct}% sur ${vps.name} (${vps.memory_used}/${vps.max_memory} MB)`,
            level: 'warning', type: 'status_change',
          });
        }
      }
    }
    for (const err of errors) {
      const prev = prevMap[err.id];
      if (prev && !prev.error) {
        notifications.push({
          title: `❌ VPS inaccessible — ${err.name}`,
          message: err.error,
          level: 'error', type: 'status_change',
        });
      }
    }
  }

  const status = errors.length === vpsList.length ? 'error'
    : errors.length > 0 ? 'warning'
    : 'online';

  const state = { vps: results, errors };
  const metrics = {
    vps_count: results.length,
    avg_cpu: results.length ? Math.round(results.reduce((s, v) => s + v.cpu, 0) / results.length) : 0,
    avg_memory_pct: results.length ? Math.round(results.reduce((s, v) => s + v.memory_pct, 0) / results.length) : 0,
    vps: results,
  };

  return { status, state, metrics, notifications };
}

async function report(config, state) {
  const vpsList = state?.vps || [];
  let msg = `🖥️ Rapport VPS — ${vpsList.length} serveur(s)\n`;
  for (const v of vpsList) {
    msg += `\n🖥️ ${v.name} (${v.ipv4 || v.id})`;
    msg += `\n  État: ${v.state} | ${v.vcores} vCore | ${v.ram_gb} GB RAM | ${v.datacenter || ''}`;
  }
  if (state?.errors?.length) {
    msg += `\n\n❌ Erreurs: ${state.errors.map(e => e.name).join(', ')}`;
  }
  return { title: '🖥️ Rapport VPS HMS', message: msg };
}

module.exports = { check, report };
