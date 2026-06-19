const axios = require('axios');
const https = require('https');
const cfHeaders = require('./cfHeaders');

function makeClient(rejectUnauthorized = false, extraHeaders = {}) {
  return axios.create({
    timeout: 10000,
    httpsAgent: new https.Agent({ rejectUnauthorized }),
    headers: extraHeaders,
  });
}

async function getConnections(http, apiUrl, apiKey) {
  const res = await http.get(`${apiUrl}/rest/system/connections`, {
    headers: { 'X-API-Key': apiKey },
  });
  return res.data.connections || {};
}

async function getSystemStatus(http, apiUrl, apiKey) {
  const res = await http.get(`${apiUrl}/rest/system/status`, {
    headers: { 'X-API-Key': apiKey },
  });
  return res.data;
}

async function getConfig(http, apiUrl, apiKey) {
  const res = await http.get(`${apiUrl}/rest/system/config`, {
    headers: { 'X-API-Key': apiKey },
  });
  return res.data;
}

async function getFolderStatus(http, apiUrl, apiKey, folderId) {
  const res = await http.get(`${apiUrl}/rest/db/status?folder=${folderId}`, {
    headers: { 'X-API-Key': apiKey },
  });
  return res.data;
}

async function check(config, lastState) {
  const { apiUrl, apiKey, folderIds = [], rejectUnauthorized = false } = config;

  if (!apiUrl || !apiKey) {
    return { status: 'error', state: null, metrics: null, notifications: [
      { title: 'Config manquante — Syncthing', message: 'URL API et clé API requis', level: 'error', type: 'error' }
    ]};
  }

  const http = makeClient(rejectUnauthorized, cfHeaders(config));
  let cfg, connections, sysStatus, folders = [];

  try {
    [cfg, connections, sysStatus] = await Promise.all([
      getConfig(http, apiUrl, apiKey),
      getConnections(http, apiUrl, apiKey),
      getSystemStatus(http, apiUrl, apiKey),
    ]);

    const targetFolders = folderIds.length
      ? folderIds
      : (cfg.folders || []).map(f => f.id);

    for (const fid of targetFolders) {
      try {
        const status = await getFolderStatus(http, apiUrl, apiKey, fid);
        const folderCfg = cfg.folders?.find(f => f.id === fid);
        folders.push({
          id: fid,
          label: folderCfg?.label || fid,
          state: status.state,
          inSyncFiles: status.inSyncFiles,
          globalFiles: status.globalFiles,
          needBytes: status.needBytes,
        });
      } catch (e) {
        folders.push({ id: fid, label: fid, state: 'error', error: e.message });
      }
    }
  } catch (err) {
    return { status: 'error', state: lastState, metrics: null, notifications: [
      { title: 'Syncthing — Erreur API', message: err.message, level: 'error', type: 'error' }
    ]};
  }

  const deviceMap = Object.fromEntries((cfg.devices || []).map(d => [d.deviceID, d.name]));
  const myID = sysStatus?.myID;
  const hostDevice = myID ? { id: myID, name: deviceMap[myID] || 'Host', connected: true, isHost: true } : null;
  const peers = Object.entries(connections).map(([id, det]) => ({
    id,
    name: deviceMap[id] || 'Inconnu',
    connected: det.connected,
  }));
  const devices = hostDevice ? [hostDevice, ...peers] : peers;

  const notifications = [];
  const prevDeviceMap = lastState?.devices
    ? Object.fromEntries(lastState.devices.map(d => [d.id, d]))
    : null;

  if (prevDeviceMap) {
    for (const dev of devices) {
      const prev = prevDeviceMap[dev.id];
      if (prev) {
        if (!dev.connected && prev.connected) {
          notifications.push({
            title: `Syncthing — Appareil déconnecté`,
            message: `"${dev.name}" s'est déconnecté de Syncthing.`,
            level: 'warning', type: 'status_change',
          });
        } else if (dev.connected && !prev.connected) {
          notifications.push({
            title: `Syncthing — Appareil reconnecté`,
            message: `"${dev.name}" est de nouveau connecté.`,
            level: 'success', type: 'status_change',
          });
        }
      }
    }

    for (const folder of folders) {
      const prevF = lastState?.folders?.find(f => f.id === folder.id);
      if (prevF && folder.state === 'error' && prevF.state !== 'error') {
        notifications.push({
          title: `Syncthing — Erreur dossier`,
          message: `Le dossier "${folder.label}" est en erreur.`,
          level: 'error', type: 'status_change',
        });
      }
    }
  }

  const connectedCount = devices.filter(d => d.connected).length;
  const outOfSync = folders.filter(f => f.needBytes > 0 || f.state === 'error').length;
  const status = outOfSync > 0 ? 'warning' : 'online';

  const state = { devices, folders };
  const metrics = {
    devices_total: devices.length,
    devices_connected: connectedCount,
    folders_total: folders.length,
    folders_synced: folders.filter(f => f.needBytes === 0 && f.state !== 'error').length,
    devices,
    folders,
  };

  return { status, state, metrics, notifications };
}

async function report(config, state) {
  if (!state) return { title: 'Syncthing', message: 'Aucune donnée disponible.' };

  const devLines = (state.devices || []).map(d =>
    `${d.name} (${d.connected ? 'connecté' : 'déconnecté'})`
  ).join('\n');

  const folderLines = (state.folders || []).map(f => {
    const synced = f.needBytes === 0 && f.state !== 'error';
    return `${f.label} — ${f.state} (${f.inSyncFiles}/${f.globalFiles} fichiers)`;
  }).join('\n');

  const msg = `Rapport Syncthing

Appareils (${(state.devices || []).filter(d => d.connected).length}/${(state.devices || []).length} connectés) :
${devLines || 'Aucun appareil'}

Dossiers :
${folderLines || 'Aucun dossier'}`;

  return { title: 'Rapport Syncthing', message: msg };
}

module.exports = { check, report };
