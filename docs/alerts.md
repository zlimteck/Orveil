# Alerts per monitor type

All monitor types send exactly **one alert when going down** and **one alert on recovery** — no repeat notifications while the service stays down. Incidents are opened on first alert and closed on recovery.

## Configurable specific alerts

Type-specific alerts (listed below) can be individually enabled or disabled per monitor in the **Notifications** tab of each service. Some alerts also expose a configurable threshold (e.g. disk usage %). Changes take effect on the next check.

Additional type-specific alerts:

| Type | Extra alerts |
|------|-------------|
| **HTTP** | SSL expiry warning · SSL expired · Response time threshold exceeded |
| **Multi-step HTTP** | *(down/recovery only)* |
| **Ping** | *(down/recovery only)* |
| **Port Forwarding** | *(down/recovery only)* |
| **DNS** | *(down/recovery only)* |
| **SSH** | High CPU · High RAM · High disk usage · Custom command output mismatch |
| **MySQL** | *(down/recovery only)* |
| **Redis** | *(down/recovery only)* |
| **MongoDB** | *(down/recovery only)* |
| **Docker** | Container stopped · Container running again |
| **Proxmox** | High CPU · High RAM |
| **Cloudflare** | Per-tunnel offline / restored |
| **AdGuard DNS** | Protection disabled / re-enabled |
| **AdGuard Home** | Protection disabled / re-enabled |
| **Portainer** | Container stopped · Container running again |
| **Tailscale** | Device offline / restored |
| **Home Assistant** | Entity becomes unavailable · Entity restored |
| **Syncthing** | Folder error · Device disconnected / reconnected |
| **Immich** | Critical disk usage |
| **Unraid** | Array stopped · Disk error |
| **Speedtest Tracker** | Last test failed |
| **Jellyfin** | *(down/recovery only)* |
| **Ollama** | *(down/recovery only)* |
| **OpenWebUI** | *(down/recovery only)* |
| **Sonarr / Radarr / Prowlarr** | Health warning detected / resolved |
| **Overseerr** | New pending requests |
| **qBittorrent** | *(down/recovery only)* |
| **Autobrr** | *(down/recovery only)* |
| **HMS** | Per-VPS unreachable · High CPU · High memory |
| **Ultra.cc** | Low storage · Low traffic |
| **rclone** | Transfer errors detected · Transfer errors resolved |
| **Hetzner Storage Box** | Disk usage > 90% |
| **Heartbeat** | *(down/recovery only)* |
