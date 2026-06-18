// Chartable numeric metrics per monitor type.
// Each entry: { key: string, fr: string, en: string }
const CONFIG = {
  http: [
    { key: 'responseTime', fr: 'Temps de réponse (ms)', en: 'Response time (ms)' },
    { key: 'statusCode',   fr: 'Status HTTP',           en: 'HTTP status' },
  ],
  ping: [
    { key: 'latency', fr: 'Latence (ms)', en: 'Latency (ms)' },
    { key: 'loss',    fr: 'Perte (%)',    en: 'Loss (%)' },
  ],
  unraid: [
    { key: 'diskPct',           fr: 'Disque (%)',          en: 'Disk (%)' },
    { key: 'cpuPct',            fr: 'CPU (%)',              en: 'CPU (%)' },
    { key: 'ramPct',            fr: 'RAM (%)',              en: 'RAM (%)' },
    { key: 'tempAvg',           fr: 'Température (°C)',     en: 'Temperature (°C)' },
    { key: 'containersRunning', fr: 'Containers actifs',    en: 'Running containers' },
    { key: 'diskErrors',        fr: 'Erreurs disque',       en: 'Disk errors' },
  ],
  proxmox: [
    { key: 'cpuPct',     fr: 'CPU (%)',      en: 'CPU (%)' },
    { key: 'memPct',     fr: 'RAM (%)',      en: 'RAM (%)' },
    { key: 'vmRunning',  fr: 'VMs actives',  en: 'Running VMs' },
    { key: 'lxcRunning', fr: 'LXC actifs',   en: 'Running LXC' },
  ],
  ssh: [
    { key: 'memPct',  fr: 'RAM (%)',     en: 'RAM (%)' },
    { key: 'diskPct', fr: 'Disque (%)', en: 'Disk (%)' },
  ],
  adguard: [
    { key: 'pct_requests',   fr: 'Requêtes (%)',          en: 'Requests (%)' },
    { key: 'devices',        fr: 'Appareils',              en: 'Devices' },
    { key: 'used_requests',  fr: 'Requêtes utilisées',     en: 'Used requests' },
  ],
  immich: [
    { key: 'diskPct', fr: 'Disque (%)', en: 'Disk (%)' },
    { key: 'photos',  fr: 'Photos',     en: 'Photos' },
    { key: 'videos',  fr: 'Vidéos',     en: 'Videos' },
  ],
  portainer: [
    { key: 'containersRunning', fr: 'Containers actifs',   en: 'Running containers' },
    { key: 'containersStopped', fr: 'Containers arrêtés',  en: 'Stopped containers' },
    { key: 'environments',      fr: 'Environnements',       en: 'Environments' },
  ],
  docker: [
    { key: 'containersRunning', fr: 'Containers actifs',  en: 'Running containers' },
    { key: 'containersStopped', fr: 'Containers arrêtés', en: 'Stopped containers' },
  ],
  hms: [
    { key: 'vps_count',      fr: 'VPS actifs',        en: 'Active VPS' },
    { key: 'avg_cpu',        fr: 'CPU moyen (%)',      en: 'Avg CPU (%)' },
    { key: 'avg_memory_pct', fr: 'RAM moyenne (%)',    en: 'Avg RAM (%)' },
  ],
  cloudflare: [
    { key: 'total',   fr: 'Tunnels actifs', en: 'Active tunnels' },
    { key: 'healthy', fr: 'Tunnels sains',  en: 'Healthy tunnels' },
  ],
  syncthing: [
    { key: 'folders_synced',    fr: 'Dossiers synchronisés', en: 'Synced folders' },
    { key: 'devices_connected', fr: 'Appareils connectés',   en: 'Connected devices' },
    { key: 'folders_total',     fr: 'Dossiers total',        en: 'Total folders' },
  ],
  ultracc: [
    { key: 'free_pct', fr: 'Stockage libre (%)', en: 'Free storage (%)' },
  ],
  heartbeat: [
    { key: 'minutesSince', fr: 'Min. depuis dernier ping', en: 'Min. since last ping' },
  ],
};

/** Returns the chartable metrics for a given type */
export function getMetrics(type) {
  return CONFIG[type] || [];
}

/** Returns the label for a specific metric key */
export function getMetricLabel(type, key, lang = 'fr') {
  const m = (CONFIG[type] || []).find(m => m.key === key);
  if (!m) return key;
  return lang === 'fr' ? m.fr : m.en;
}

/** Extracts the numeric value to display from a snapshot point */
export function extractValue(point, cardMetric) {
  if (cardMetric && point.metrics && point.metrics[cardMetric] != null) {
    return point.metrics[cardMetric];
  }
  return point.value;
}
