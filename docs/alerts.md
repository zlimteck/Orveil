# Alerts per monitor type

All monitor types send exactly **one alert when going down** and **one alert on recovery** — no repeat notifications while the service stays down. Incidents are opened on first alert and closed on recovery.

Additional type-specific alerts:

| Type | Extra alerts |
|------|-------------|
| **HTTP** | SSL expiry warning · SSL expired · Response time threshold exceeded |
| **SSH** | High CPU · High RAM · High disk usage |
| **Proxmox** | High CPU · High RAM |
| **Cloudflare** | Per-tunnel offline / restored |
| **AdGuard DNS** | Protection disabled / re-enabled |
| **AdGuard Home** | Protection disabled / re-enabled |
| **Syncthing** | Folder error · Device disconnected / reconnected |
| **Immich** | Critical disk usage |
| **HMS** | Per-VPS unreachable · High CPU · High memory |
| **Ultra.cc** | Low storage · Low traffic |
| **Unraid** | Array stopped · Disk error |
| **Home Assistant** | Entity becomes unavailable · Entity restored |
