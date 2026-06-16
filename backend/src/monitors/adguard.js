const axios = require('axios');

const BASE = 'https://api.adguard-dns.io/oapi/v1';
const http = axios.create({ timeout: 10000 });

async function refreshToken(refreshTok) {
  const res = await http.post(`${BASE}/oauth_token`,
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshTok }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return { accessToken: res.data.access_token, refreshToken: res.data.refresh_token };
}

async function fetchData(accessToken) {
  const [srv, acc] = await Promise.all([
    http.get(`${BASE}/dns_servers`, { headers: { Authorization: `Bearer ${accessToken}` } }),
    http.get(`${BASE}/account/limits`, { headers: { Authorization: `Bearer ${accessToken}` } }),
  ]);
  const server = srv.data[0];
  const account = acc.data;
  return {
    server_name: server.name,
    protection_enabled: server.settings.protection_enabled,
    user_rules_count: server.settings.user_rules_settings.rules_count,
    filter_list_count: server.settings.filter_lists_settings.filter_list.length,
    devices: server.device_ids.length,
    used_requests: account.requests.used,
    limit_requests: account.requests.limit,
  };
}

async function check(config, lastState) {
  let { accessToken, refreshTok } = config;
  if (!accessToken && !refreshTok) {
    return { status: 'error', state: null, metrics: null, configUpdate: null, notifications: [
      { title: 'Config manquante — AdGuard', message: 'Access token ou refresh token requis', level: 'error', type: 'error' }
    ]};
  }

  let data;
  let configUpdate = null;

  try {
    data = await fetchData(accessToken);
  } catch (err) {
    if (err.response?.status === 401 && refreshTok) {
      try {
        const tokens = await refreshToken(refreshTok);
        accessToken = tokens.accessToken;
        configUpdate = { accessToken: tokens.accessToken, refreshTok: tokens.refreshToken };
        data = await fetchData(accessToken);
      } catch (e) {
        return { status: 'error', state: null, metrics: null, configUpdate: null, notifications: [
          { title: '❌ AdGuard — Token invalide', message: `Impossible de rafraîchir le token: ${e.message}`, level: 'error', type: 'error' }
        ]};
      }
    } else {
      return { status: 'error', state: lastState, metrics: null, configUpdate: null, notifications: [
        { title: '❌ AdGuard — Erreur API', message: err.message, level: 'error', type: 'error' }
      ]};
    }
  }

  const notifications = [];

  if (lastState !== null) {
    if (!data.protection_enabled && lastState.protection_enabled) {
      notifications.push({
        title: '⚠️ AdGuard DNS — Protection désactivée',
        message: `La protection DNS AdGuard a été désactivée sur le serveur "${data.server_name}".`,
        level: 'warning', type: 'status_change',
      });
    } else if (data.protection_enabled && lastState.protection_enabled === false) {
      notifications.push({
        title: '✅ AdGuard DNS — Protection réactivée',
        message: `La protection DNS AdGuard est de nouveau active sur "${data.server_name}".`,
        level: 'success', type: 'status_change',
      });
    }
  }

  const status = data.protection_enabled ? 'online' : 'warning';
  const metrics = {
    protection: data.protection_enabled,
    devices: data.devices,
    used_requests: data.used_requests,
    limit_requests: data.limit_requests,
    pct_requests: Math.round((data.used_requests / data.limit_requests) * 100),
  };

  return { status, state: data, metrics, configUpdate, notifications };
}

async function report(config, state) {
  if (!state) return { title: '📊 AdGuard DNS', message: 'Aucune donnée disponible.' };
  const prot = state.protection_enabled ? '✅ Activée' : '❌ Désactivée';
  const pct = state.limit_requests ? Math.round((state.used_requests / state.limit_requests) * 100) : 0;
  const msg = `📊 Rapport AdGuard DNS — ${state.server_name}

🛡️ Protection : ${prot}
📋 Règles utilisateur : ${state.user_rules_count}
📝 Listes de filtres : ${state.filter_list_count}
📱 Appareils : ${state.devices}
📈 Requêtes : ${state.used_requests} / ${state.limit_requests} (${pct}%)`;

  return { title: '📊 Rapport AdGuard DNS', message: msg };
}

module.exports = { check, report };
