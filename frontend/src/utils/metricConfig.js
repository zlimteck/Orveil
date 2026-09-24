// Chartable numeric metrics per monitor type.
// Each entry: { key, fr, en, unit }
const CONFIG = {
  http: [
    { key: 'responseTime', fr: 'Temps de réponse', en: 'Response time', unit: 'ms' },
  ],
  ping: [
    { key: 'latency', fr: 'Latence',  en: 'Latency', unit: 'ms' },
    { key: 'loss',    fr: 'Perte',    en: 'Loss',    unit: '%' },
  ],
  unraid: [
    { key: 'diskPct',           fr: 'Disque',               en: 'Disk',               unit: '%' },
    { key: 'cpuPct',            fr: 'CPU',                   en: 'CPU',                unit: '%' },
    { key: 'ramPct',            fr: 'RAM',                   en: 'RAM',                unit: '%' },
    { key: 'tempAvg',           fr: 'Température',           en: 'Temperature',         unit: '°C' },
    { key: 'containersRunning', fr: 'Containers actifs',     en: 'Running containers', unit: '' },
    { key: 'diskErrors',        fr: 'Erreurs disque',        en: 'Disk errors',        unit: '' },
  ],
  proxmox: [
    { key: 'cpuPct',       fr: 'CPU',              en: 'CPU',              unit: '%' },
    { key: 'memPct',       fr: 'RAM',              en: 'RAM',              unit: '%' },
    { key: 'vmRunning',    fr: 'VMs actives',      en: 'Running VMs',      unit: '' },
    { key: 'lxcRunning',   fr: 'LXC actifs',       en: 'Running LXC',      unit: '' },
    { key: 'responseTime', fr: 'Temps de réponse', en: 'Response time',    unit: 'ms' },
  ],
  ssh: [
    { key: 'cpuPct',  fr: 'CPU',    en: 'CPU',  unit: '%' },
    { key: 'memPct',  fr: 'RAM',    en: 'RAM',  unit: '%' },
    { key: 'diskPct', fr: 'Disque', en: 'Disk', unit: '%' },
  ],
  homeassistant: [
    { key: 'version', fr: 'Version', en: 'Version', unit: '' },
  ],
  adguardhome: [
    { key: 'blockedPct',   fr: 'Bloquées %',   en: 'Blocked %',  unit: '%' },
    { key: 'totalQueries', fr: 'Requêtes',      en: 'Queries',    unit: '' },
    { key: 'blocked',      fr: 'Bloquées',      en: 'Blocked',    unit: '' },
  ],
  adguard: [
    { key: 'pct_requests',   fr: 'Requêtes',          en: 'Requests',      unit: '%' },
    { key: 'devices',        fr: 'Appareils',          en: 'Devices',       unit: '' },
    { key: 'used_requests',  fr: 'Requêtes utilisées', en: 'Used requests', unit: '' },
  ],
  immich: [
    { key: 'diskPct',      fr: 'Disque',           en: 'Disk',           unit: '%' },
    { key: 'photos',       fr: 'Photos',           en: 'Photos',         unit: '' },
    { key: 'videos',       fr: 'Vidéos',           en: 'Videos',         unit: '' },
    { key: 'responseTime', fr: 'Temps de réponse', en: 'Response time',  unit: 'ms' },
  ],
  jellyfin: [
    { key: 'activeSessions', fr: 'Sessions actives', en: 'Active sessions', unit: '' },
    { key: 'movies',         fr: 'Films',            en: 'Movies',          unit: '' },
    { key: 'series',         fr: 'Séries',           en: 'Series',          unit: '' },
    { key: 'songs',          fr: 'Musiques',         en: 'Songs',           unit: '' },
    { key: 'responseTime',   fr: 'Temps de réponse', en: 'Response time',   unit: 'ms' },
  ],
  portainer: [
    { key: 'containersRunning', fr: 'Containers actifs',  en: 'Running containers', unit: '' },
    { key: 'containersStopped', fr: 'Containers arrêtés', en: 'Stopped containers', unit: '' },
    { key: 'environments',      fr: 'Environnements',     en: 'Environments',       unit: '' },
    { key: 'responseTime',      fr: 'Temps de réponse',   en: 'Response time',      unit: 'ms' },
  ],
  docker: [
    { key: 'containersRunning', fr: 'Containers actifs',  en: 'Running containers', unit: '' },
    { key: 'containersStopped', fr: 'Containers arrêtés', en: 'Stopped containers', unit: '' },
  ],
  hms: [
    { key: 'vps_count',      fr: 'VPS actifs',     en: 'Active VPS',  unit: '' },
    { key: 'avg_cpu',        fr: 'CPU moyen',       en: 'Avg CPU',     unit: '%' },
    { key: 'avg_memory_pct', fr: 'RAM moyenne',     en: 'Avg RAM',     unit: '%' },
  ],
  cloudflare: [
    { key: 'total',   fr: 'Tunnels actifs', en: 'Active tunnels',  unit: '' },
    { key: 'healthy', fr: 'Tunnels sains',  en: 'Healthy tunnels', unit: '' },
  ],
  cfd1: [
    { key: 'readPct',     fr: 'Quota lecture',   en: 'Read quota',    unit: '%' },
    { key: 'writePct',    fr: 'Quota écriture',  en: 'Write quota',   unit: '%' },
    { key: 'rowsRead',    fr: 'Lignes lues',     en: 'Rows read',     unit: '' },
    { key: 'rowsWritten', fr: 'Lignes écrites',  en: 'Rows written',  unit: '' },
    { key: 'sizeBytes',   fr: 'Taille',          en: 'Size',          unit: 'B' },
  ],
  cfworkers: [
    { key: 'requests',   fr: 'Requêtes (24h)',    en: 'Requests (24h)', unit: '' },
    { key: 'errors',     fr: 'Erreurs',            en: 'Errors',         unit: '' },
    { key: 'errorRate',  fr: "Taux d'erreur",      en: 'Error rate',     unit: '%' },
    { key: 'cpuTimeP50', fr: 'CPU p50',            en: 'CPU p50',        unit: 'ms' },
    { key: 'cpuTimeP99', fr: 'CPU p99',            en: 'CPU p99',        unit: 'ms' },
  ],
  syncthing: [
    { key: 'folders_synced',    fr: 'Dossiers sync.',  en: 'Synced folders',    unit: '' },
    { key: 'devices_connected', fr: 'Appareils',       en: 'Connected devices', unit: '' },
    { key: 'folders_total',     fr: 'Dossiers total',  en: 'Total folders',     unit: '' },
  ],
  ultracc: [
    { key: 'free_pct', fr: 'Stockage libre', en: 'Free storage', unit: '%' },
  ],
  heartbeat: [
    { key: 'minutesSince', fr: 'Depuis dernier ping', en: 'Since last ping', unit: 'min' },
  ],
  speedtest: [
    { key: 'downloadMbps', fr: 'Download',  en: 'Download', unit: 'Mbps' },
    { key: 'uploadMbps',   fr: 'Upload',    en: 'Upload',   unit: 'Mbps' },
    { key: 'pingMs',       fr: 'Ping',      en: 'Ping',     unit: 'ms' },
    { key: 'jitterMs',     fr: 'Jitter',    en: 'Jitter',   unit: 'ms' },
  ],
  dns: [
    { key: 'responseTime', fr: 'Temps de résolution', en: 'Resolution time', unit: 'ms' },
  ],
  mysql: [
    { key: 'responseTime', fr: 'Temps de réponse', en: 'Response time', unit: 'ms' },
  ],
  redis: [
    { key: 'responseTime', fr: 'Temps de réponse', en: 'Response time', unit: 'ms' },
  ],
  mongodb: [
    { key: 'responseTime', fr: 'Temps de réponse', en: 'Response time', unit: 'ms' },
  ],
  tailscale: [
    { key: 'online',  fr: 'En ligne',  en: 'Online',  unit: '' },
    { key: 'offline', fr: 'Hors ligne', en: 'Offline', unit: '' },
    { key: 'total',   fr: 'Total',     en: 'Total',   unit: '' },
  ],
  ollama: [
    { key: 'modelsCount',  fr: 'Modèles',           en: 'Models',         unit: '' },
    { key: 'responseTime', fr: 'Temps de réponse',  en: 'Response time',  unit: 'ms' },
  ],
  sonarr: [
    { key: 'seriesCount',  fr: 'Séries',           en: 'Series',          unit: '' },
    { key: 'missingCount', fr: 'Épisodes manquants', en: 'Missing episodes', unit: '' },
    { key: 'queueCount',   fr: 'File de téléch.',  en: 'Queue',           unit: '' },
    { key: 'responseTime', fr: 'Temps de réponse', en: 'Response time',   unit: 'ms' },
  ],
  radarr: [
    { key: 'movieCount',   fr: 'Films',            en: 'Movies',          unit: '' },
    { key: 'missingCount', fr: 'Films manquants',  en: 'Missing movies',  unit: '' },
    { key: 'queueCount',   fr: 'File de téléch.',  en: 'Queue',           unit: '' },
    { key: 'responseTime', fr: 'Temps de réponse', en: 'Response time',   unit: 'ms' },
  ],
  prowlarr: [
    { key: 'indexersEnabled', fr: 'Indexeurs actifs', en: 'Active indexers', unit: '' },
    { key: 'indexersTotal',   fr: 'Indexeurs total',  en: 'Total indexers',  unit: '' },
    { key: 'responseTime',    fr: 'Temps de réponse', en: 'Response time',   unit: 'ms' },
  ],
  overseerr: [
    { key: 'requestsPending', fr: 'Demandes en attente', en: 'Pending requests', unit: '' },
    { key: 'requestsTotal',   fr: 'Demandes total',      en: 'Total requests',   unit: '' },
    { key: 'responseTime',    fr: 'Temps de réponse',    en: 'Response time',    unit: 'ms' },
  ],
  openwebui: [
    { key: 'modelsCount',   fr: 'Modèles dispo',      en: 'Available models', unit: '' },
    { key: 'modelsRunning', fr: 'Modèles en RAM',      en: 'Models in RAM',    unit: '' },
    { key: 'usersCount',    fr: 'Utilisateurs',        en: 'Users',            unit: '' },
    { key: 'responseTime',  fr: 'Temps de réponse',   en: 'Response time',    unit: 'ms' },
  ],
  qbittorrent: [
    { key: 'torrentsActive', fr: 'Torrents actifs',   en: 'Active torrents', unit: '' },
    { key: 'torrentsTotal',  fr: 'Torrents total',    en: 'Total torrents',  unit: '' },
    { key: 'dlSpeed',        fr: 'Vitesse DL',        en: 'Download speed',  unit: 'B/s' },
    { key: 'ulSpeed',        fr: 'Vitesse UL',        en: 'Upload speed',    unit: 'B/s' },
    { key: 'responseTime',   fr: 'Temps de réponse',  en: 'Response time',   unit: 'ms' },
  ],
  autobrr: [
    { key: 'filtersEnabled',    fr: 'Filtres actifs',        en: 'Active filters',    unit: '' },
    { key: 'filtersTotal',      fr: 'Filtres total',         en: 'Total filters',     unit: '' },
    { key: 'releasesTotal',     fr: 'Releases total',        en: 'Total releases',    unit: '' },
    { key: 'releasesPushed',    fr: 'Releases poussées',     en: 'Releases pushed',   unit: '' },
    { key: 'releasesRejected',  fr: 'Releases rejetées',     en: 'Releases rejected', unit: '' },
    { key: 'responseTime',      fr: 'Temps de réponse',      en: 'Response time',     unit: 'ms' },
  ],
  navidrome: [
    { key: 'artistCount',   fr: 'Artistes',          en: 'Artists',       unit: '' },
    { key: 'nowPlaying',    fr: 'En écoute',          en: 'Now playing',   unit: '' },
    { key: 'responseTime',  fr: 'Temps de réponse',   en: 'Response time', unit: 'ms' },
  ],
  dispatcharr: [
    { key: 'activeStreams',   fr: 'Streams actifs',    en: 'Active streams',  unit: '' },
    { key: 'streamsTotal',    fr: 'Streams total',     en: 'Total streams',   unit: '' },
    { key: 'totalViewers',    fr: 'Spectateurs',       en: 'Viewers',         unit: '' },
    { key: 'channelsTotal',   fr: 'Chaînes',           en: 'Channels',        unit: '' },
    { key: 'responseTime',    fr: 'Temps de réponse',  en: 'Response time',   unit: 'ms' },
  ],
  rclone: [
    { key: 'dlSpeed',           fr: 'Vitesse DL',          en: 'Download speed',    unit: 'B/s' },
    { key: 'ulSpeed',           fr: 'Vitesse UL',          en: 'Upload speed',      unit: 'B/s' },
    { key: 'transfersActive',   fr: 'Transferts actifs',   en: 'Active transfers',  unit: '' },
    { key: 'transfersTotal',    fr: 'Transferts total',    en: 'Total transfers',   unit: '' },
    { key: 'errors',            fr: 'Erreurs',             en: 'Errors',            unit: '' },
    { key: 'diskPct',           fr: 'Disque utilisé',      en: 'Disk used',         unit: '%' },
    { key: 'mountCount',        fr: 'Montages actifs',     en: 'Active mounts',     unit: '' },
    { key: 'jobCount',          fr: 'Jobs actifs',         en: 'Active jobs',       unit: '' },
    { key: 'responseTime',      fr: 'Temps de réponse',    en: 'Response time',     unit: 'ms' },
  ],
  hetzner: [
    { key: 'diskPct',      fr: 'Disque %',          en: 'Disk %',         unit: '%' },
    { key: 'diskUsedGB',   fr: 'Disque utilisé',    en: 'Disk used',      unit: 'GB' },
    { key: 'diskFreeGB',   fr: 'Disque libre',      en: 'Disk free',      unit: 'GB' },
    { key: 'diskTotalGB',  fr: 'Disque total',      en: 'Total disk',     unit: 'GB' },
    { key: 'snapUsedGB',   fr: 'Snapshots (taille)', en: 'Snapshots size', unit: 'GB' },
    { key: 'responseTime', fr: 'Temps de réponse',  en: 'Response time',  unit: 'ms' },
  ],
  multistep: [
    { key: 'totalDuration', fr: 'Durée totale',    en: 'Total duration', unit: 'ms' },
    { key: 'stepsPassed',   fr: 'Étapes réussies', en: 'Steps passed',   unit: '' },
  ],
};

function haEntityMetrics(config) {
  const entityOptions = (config?.entities || []).map(e => ({
    key: `entity__${e.entity_id.replace(/\./g, '__')}`,
    fr: e.friendly_name || e.entity_id,
    en: e.friendly_name || e.entity_id,
    unit: '',
  }));
  return [
    { key: 'activeEntities', fr: 'Entités actives', en: 'Active entities', unit: '' },
    ...entityOptions,
  ];
}

/** Returns the chartable metrics for a given type */
function customMetricEntries(customMetrics) {
  if (!Array.isArray(customMetrics)) return [];
  return customMetrics
    .filter(cm => cm?.name)
    .map(cm => ({
      key: `__custom_${cm.name.replace(/[^a-zA-Z0-9_]/g, '_')}`,
      fr: cm.name,
      en: cm.name,
      unit: cm.unit || '',
    }));
}

export function getMetrics(type, config, customMetrics) {
  const base = type === 'homeassistant' ? haEntityMetrics(config) : (CONFIG[type] || []);
  return [...base, ...customMetricEntries(customMetrics)];
}

/** Returns the label for a specific metric key */
export function getMetricLabel(type, key, lang = 'fr', config, customMetrics) {
  if (type === 'homeassistant') {
    const m = haEntityMetrics(config).find(m => m.key === key);
    if (m) return lang === 'fr' ? m.fr : m.en;
  }
  const custom = customMetricEntries(customMetrics).find(m => m.key === key);
  if (custom) return lang === 'fr' ? custom.fr : custom.en;
  const m = (CONFIG[type] || []).find(m => m.key === key);
  if (!m) return key;
  return lang === 'fr' ? m.fr : m.en;
}

/** Returns unit suffix for a metric key */
export function getMetricUnit(type, key, customMetrics) {
  const custom = customMetricEntries(customMetrics).find(m => m.key === key);
  if (custom) return custom.unit;
  const m = (CONFIG[type] || []).find(m => m.key === key);
  return m?.unit ?? '';
}

/** Formats a metric value with its unit */
export function formatMetricValue(type, key, value, customMetrics) {
  if (value == null) return '—';
  const unit = getMetricUnit(type, key, customMetrics);
  const num = Number.isInteger(value) ? value : parseFloat(value.toFixed(1));
  return unit ? `${num}${unit}` : `${num}`;
}

/** Extracts the numeric value to display from a snapshot point */
export function extractValue(point, cardMetric) {
  if (cardMetric && point.metrics && point.metrics[cardMetric] != null) {
    return point.metrics[cardMetric];
  }
  return point.value;
}
