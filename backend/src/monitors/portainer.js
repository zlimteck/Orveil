const axios = require('axios');
const https = require('https');
const cfHeaders = require('./cfHeaders');

async function check(config, lastState) {
  const { apiUrl, apiKey, rejectUnauthorized = true } = config;

  if (!apiUrl || !apiKey) return { status: 'error', state: null, metrics: null, notifications: [
    { title: 'Config manquante — Portainer', message: 'URL et clé API requises', level: 'error', type: 'error' }
  ]};

  const base = apiUrl.replace(/\/$/, '');
  const headers = { 'X-API-Key': apiKey, ...cfHeaders(config) };

  const http = axios.create({
    timeout: 10000,
    httpsAgent: new https.Agent({ rejectUnauthorized }),
    headers,
  });

  try {
    const endpointsRes = await http.get(`${base}/api/endpoints`, {
      responseType: 'text',
      validateStatus: () => true,
    });
    if (endpointsRes.status === 401 || endpointsRes.status === 403) {
      throw new Error(`${endpointsRes.status} — Clé API invalide ou insuffisante`);
    }
    if (typeof endpointsRes.data === 'string' && endpointsRes.data.trimStart().startsWith('<')) {
throw new Error(`URL incorrecte (HTML reçu, status ${endpointsRes.status}) — vérifiez l'URL Portainer`);
    }
    if (endpointsRes.status >= 400) {
      throw new Error(`HTTP ${endpointsRes.status} — ${endpointsRes.data?.toString().slice(0, 100)}`);
    }
    const parsed = typeof endpointsRes.data === 'string' ? JSON.parse(endpointsRes.data) : endpointsRes.data;
    const endpoints = Array.isArray(parsed) ? parsed : (parsed?.value || []);

    let containersRunning = 0;
    let containersStopped = 0;

    for (const ep of endpoints.slice(0, 5)) {
      try {
        const res = await http.get(`${base}/api/endpoints/${ep.Id}/docker/containers/json?all=1`);
        const containers = res.data || [];
        containersRunning += containers.filter(c => c.State === 'running').length;
        containersStopped += containers.filter(c => c.State !== 'running').length;
      } catch {}
    }

    const state = { environments: endpoints.length, containersRunning, containersStopped };
    const metrics = { environments: endpoints.length, containersRunning, containersStopped };
    const status = containersRunning > 0 || endpoints.length > 0 ? 'online' : 'warning';

    return { status, state, metrics, notifications: [] };
  } catch (err) {
    return { status: 'error', state: lastState, metrics: null, notifications: [
      { title: '❌ Portainer — Erreur API', message: err.message, level: 'error', type: 'error' }
    ]};
  }
}

async function report(config, state) {
  if (!state) return { title: '🐳 Portainer', message: 'Aucune donnée.' };
  return {
    title: '🐳 Rapport Portainer',
    message: `Environnements : ${state.environments}\n✅ Containers actifs : ${state.containersRunning}\n⛔ Arrêtés : ${state.containersStopped}`,
  };
}

module.exports = { check, report };
