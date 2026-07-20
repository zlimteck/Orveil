// Alert rules available per monitor type.
// Each rule: { key, defaultEnabled, threshold? { default, min, max, unit } }
const ALERT_RULES = {
  http: [
    { key: 'ssl_expiry',       defaultEnabled: true },
    { key: 'response_time',    defaultEnabled: true },
  ],
  ssh: [
    { key: 'high_cpu',  defaultEnabled: true, threshold: { default: 90, min: 1, max: 100, unit: '%' } },
    { key: 'high_ram',  defaultEnabled: true, threshold: { default: 90, min: 1, max: 100, unit: '%' } },
    { key: 'high_disk', defaultEnabled: true, threshold: { default: 90, min: 1, max: 100, unit: '%' } },
    { key: 'custom_command_mismatch', defaultEnabled: true },
  ],
  proxmox: [
    { key: 'high_cpu', defaultEnabled: true, threshold: { default: 90, min: 1, max: 100, unit: '%' } },
    { key: 'high_ram', defaultEnabled: true, threshold: { default: 90, min: 1, max: 100, unit: '%' } },
  ],
  cloudflare: [
    { key: 'tunnel_offline', defaultEnabled: true },
  ],
  adguard: [
    { key: 'protection_disabled', defaultEnabled: true },
  ],
  adguardhome: [
    { key: 'protection_disabled', defaultEnabled: true },
  ],
  syncthing: [
    { key: 'folder_error',         defaultEnabled: true },
    { key: 'device_disconnected',  defaultEnabled: true },
  ],
  immich: [
    { key: 'storage_critical', defaultEnabled: true, threshold: { default: 90, min: 1, max: 100, unit: '%' } },
  ],
  hms: [
    { key: 'vps_unreachable', defaultEnabled: true },
    { key: 'high_cpu',        defaultEnabled: true, threshold: { default: 90, min: 1, max: 100, unit: '%' } },
    { key: 'high_memory',     defaultEnabled: true, threshold: { default: 90, min: 1, max: 100, unit: '%' } },
  ],
  ultracc: [
    { key: 'low_storage', defaultEnabled: true },
    { key: 'low_traffic', defaultEnabled: true },
  ],
  unraid: [
    { key: 'array_stopped', defaultEnabled: true },
    { key: 'disk_error',    defaultEnabled: true },
  ],
  homeassistant: [
    { key: 'entity_unavailable', defaultEnabled: true },
  ],
  sonarr: [
    { key: 'health_warning', defaultEnabled: true },
  ],
  radarr: [
    { key: 'health_warning', defaultEnabled: true },
  ],
  prowlarr: [
    { key: 'health_warning', defaultEnabled: true },
  ],
  overseerr: [
    { key: 'pending_requests', defaultEnabled: true },
  ],
  tailscale: [
    { key: 'device_offline', defaultEnabled: true },
  ],
  speedtest: [
    { key: 'test_failed', defaultEnabled: true },
  ],
  docker: [
    { key: 'container_stopped', defaultEnabled: true },
  ],
  portainer: [
    { key: 'container_stopped', defaultEnabled: true },
  ],
  rclone: [
    { key: 'transfer_errors', defaultEnabled: true },
  ],
  hetzner: [
    { key: 'storage_critical', defaultEnabled: true, threshold: { default: 90, min: 1, max: 100, unit: '%' } },
  ],
};

// Returns the effective value for a rule: { enabled, threshold? }
function ruleConfig(alertRules, type, key) {
  const defs = (ALERT_RULES[type] || []).find(r => r.key === key);
  if (!defs) return { enabled: false };
  const saved = alertRules?.[key];
  const enabled = saved?.enabled !== undefined ? saved.enabled : defs.defaultEnabled;
  const threshold = defs.threshold
    ? (saved?.threshold !== undefined ? saved.threshold : defs.threshold.default)
    : undefined;
  return threshold !== undefined ? { enabled, threshold } : { enabled };
}

module.exports = { ALERT_RULES, ruleConfig };
