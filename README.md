<div align="center">
  <img src="docs/logo.svg" alt="Orveil" width="80" />
  <h1>Orveil</h1>
  <p>Self-hosted monitoring that goes beyond uptime checks.<br>
  Incidents with severity, SLA tracking, post-mortems, AI assistant, and MCP integration — in a single Docker container.</p>

  [![Image Size](https://img.shields.io/docker/image-size/zlimteck/orveil/latest?style=flat-square&logo=docker&logoColor=white&color=2496ED)](https://hub.docker.com/r/zlimteck/orveil)
  [![CI](https://img.shields.io/github/actions/workflow/status/zlimteck/orveil/docker.yml?style=flat-square&logo=github-actions&logoColor=white&label=build)](https://github.com/zlimteck/orveil/actions/workflows/docker.yml)
  [![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
  [![Platform](https://img.shields.io/badge/platform-amd64%20%7C%20arm64-lightgrey?style=flat-square)](https://hub.docker.com/r/zlimteck/orveil)
</div>

---

![Dashboard](docs/screenshots/1-Dashboard.png)

---

## Quick start

**Prerequisites:** Docker + Docker Compose

Create a `docker-compose.yml` with the following content, then run `docker compose up -d`:

```yaml
services:
  mongodb:
    image: mongo:8
    container_name: orveil-mongo
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: orveil
      MONGO_INITDB_ROOT_PASSWORD: orveil_pass
      MONGO_INITDB_DATABASE: orveil
    volumes:
      - orveil_mongo:/data/db
    networks:
      - orveil
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"]
      interval: 10s
      timeout: 5s
      retries: 6
      start_period: 15s

  docker-proxy:
    image: tecnativa/docker-socket-proxy:latest
    container_name: orveil-docker-proxy
    restart: unless-stopped
    environment:
      CONTAINERS: 1
      INFO: 1
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - orveil

  apprise:
    image: caronc/apprise:latest
    container_name: orveil-apprise
    restart: unless-stopped
    ports:
      - "127.0.0.1:8008:8000"                   # bound to localhost only
    networks:
      - orveil

  orveil:
    image: zlimteck/orveil:latest
    container_name: orveil
    restart: unless-stopped
    ports:
      - "3050:5050"
    environment:
      MONGODB_URI: mongodb://orveil:orveil_pass@mongodb:27017/orveil?authSource=admin
      APPRISE_API_URL: http://apprise:8000
      DOCKER_PROXY_URL: http://docker-proxy:2375
      PORT: 5050
      NODE_ENV: production
      JWT_SECRET: ""                             # REQUIRED: openssl rand -hex 32
      ADMIN_USERNAME: admin
      ADMIN_PASSWORD: ""                         # REQUIRED: random password generated on first start if omitted
      FRONTEND_URL: "http://localhost:3050"        # use https://... if behind a reverse proxy — enables Secure cookie automatically
      ENCRYPTION_KEY:                            # optional: openssl rand -hex 32
      METRICS_TOKEN:                             # optional: openssl rand -hex 32
    depends_on:
      mongodb:
        condition: service_healthy
      apprise:
        condition: service_started
      docker-proxy:
        condition: service_started
    networks:
      - orveil

volumes:
  orveil_mongo:

networks:
  orveil:
    driver: bridge
```

| Service | URL |
|---------|-----|
| App (frontend + API) | http://localhost:3050 |
| Apprise API | http://localhost:8008 |

If `ADMIN_PASSWORD` is not set, a random password is generated on first start and printed once in the container logs:

```bash
docker logs orveil
```

Set `ADMIN_PASSWORD` in your `.env` to control the initial password.

---

## Features

**Monitoring**
- **37 monitor types** — HTTP/HTTPS, Multi-step HTTP, Ping (TCP/ICMP), Port Forwarding, SSH, DNS, MySQL, Redis, MongoDB, Docker, Proxmox, Cloudflare, AdGuard DNS, AdGuard Home, Portainer, Tailscale, Home Assistant, Syncthing, Immich, Unraid, Speedtest Tracker, Jellyfin, Ollama, OpenWebUI, Sonarr, Radarr, Prowlarr, Overseerr, qBittorrent, Autobrr, Dispatcharr, Navidrome, rclone, Hetzner Storage Box, HMS, Ultra.cc, Heartbeat
- Adaptive polling — faster rechecks when a service is down
- Monitor dependencies — suppress alerts when a parent is already down
- SSL certificate monitoring with expiry warning

**Incidents & SLA**
- Auto-open / auto-close incidents with P1–P4 severity
- War room — full-screen view of all active incidents
- Post-mortem reports attached to resolved incidents
- SLA targets per monitor — met/breached indicator on the Stats page
- 30-day statistics: MTTR, MTTN, incident heatmap, maintenance-adjusted uptime

![Stats](docs/screenshots/2-stats.png)

![War room](docs/screenshots/4-war-room.png)

**Alerts**
- Apprise notifications — [100+ channels](https://github.com/caronc/apprise/wiki): Pushover, Telegram, Discord, Slack, email and more
- Notification cooldown — prevents alert storms during flapping
- Per-monitor configurable alert rules — enable/disable specific alerts (container stopped, high CPU, disk critical…) and adjust thresholds per service
- Weekly summary report

**Automation & integrations**
- [MCP server](docs/mcp.md) — let AI assistants query monitors, incidents, and stats (Claude Desktop, etc.)
- [Prometheus metrics](docs/prometheus.md) — `GET /api/metrics` with Grafana-ready labels
- REST API with Bearer auth, fully documented in-app
- Per-monitor changelog webhooks for CI/CD integration
- Backup & restore (JSON export/import)

**Account security**
- TOTP two-factor authentication with backup codes
- Passkeys (WebAuthn — Face ID, Touch ID, hardware security key)
- Active session management — GeoIP location, per-session revocation
- Password change with automatic revocation of all other sessions

**UX**
- Public status page — shareable `/status` with 90-day uptime history
- Global search `Cmd+K` — monitors, incidents, annotations, post-mortems
- Drag & drop reordering, category grouping, pin monitors, bulk actions
- Orveil AI — built-in Claude assistant for natural-language infra Q&A
- FR / EN interface · Auto / light / dark theme · Mobile PWA

→ [Complete feature list](docs/features.md)

![Status page](docs/screenshots/3-status_page.png)

---

## Available monitors

| Type | What it checks |
|------|----------------|
| **HTTP** | HTTP/HTTPS endpoint — status code, keyword match, auth, SSL expiry, response time threshold |
| **Multi-step HTTP** | Chain multiple requests with variable extraction and interpolation between steps |
| **Ping** | TCP port check or ICMP ping — latency and packet loss (mode selectable per monitor) |
| **Port Forwarding** | TCP connect check to verify a forwarded port is reachable from outside |
| **DNS** | DNS record resolution (A, AAAA, CNAME, MX, TXT, NS) with optional value assertion |
| **SSH** | CPU / RAM / disk via SSH (password or private key) — optional custom command with expected output check |
| **MySQL** | Ping a MySQL/MariaDB server and retrieve version |
| **Redis** | PING a Redis instance and retrieve version |
| **MongoDB** | Ping a MongoDB instance and retrieve version — supports optional authentication |
| **Docker** | Container count and status via Docker socket |
| **Proxmox** | Node CPU / RAM via API token |
| **Cloudflare** | Tunnel status and hostnames via API token |
| **AdGuard DNS** | DNS protection status and request stats via cloud API |
| **AdGuard Home** | Self-hosted DNS protection — blocked queries %, total queries, safebrowsing |
| **Portainer** | Container list per environment via API key |
| **Tailscale** | Tailnet device list with online/offline status via Tailscale cloud API |
| **Home Assistant** | Instance status, version, and selected entity states via long-lived access token |
| **Syncthing** | Synced folders and connected devices via API key |
| **Immich** | Photo / video count and disk usage via API key |
| **Unraid** | Array state, disk usage, CPU / RAM, temperature via GraphQL API |
| **Speedtest Tracker** | Latest speedtest result — download, upload, ping, jitter |
| **Jellyfin** | Active sessions, library counts, server version |
| **Ollama** | Running model list and server availability |
| **OpenWebUI** | Model count, version, and availability — API key optional |
| **Sonarr** | Series count, missing episodes, download queue, health warnings |
| **Radarr** | Movie count, missing movies, download queue, health warnings |
| **Prowlarr** | Active/total indexers, health warnings |
| **Overseerr** | Pending and total requests |
| **qBittorrent** | Active/total torrents, download/upload speed, version — username/password auth |
| **Autobrr** | Active/total filters, releases pushed/rejected, version — API key auth |
| **Dispatcharr** | Active streams, total viewers, channel count and version — API key auth (`X-API-Key`) |
| **Navidrome** | Artist count, now playing, version — Subsonic MD5 auth (username + password) |
| **HMS (HostMyServers)** | VPS status and specs via API token |
| **Ultra.cc** | Seedbox storage and traffic via Stats API URL |
| **rclone** | Transfer stats (DL/UL speed, active transfers, errors), active mounts, jobs, remote quota and version via rclone RC API — or push stats from an external script (see [rclone push stats](#rclone-push-stats)) |
| **Hetzner Storage Box** | Disk usage/free/total, snapshot size and location via Hetzner API (Bearer token) |
| **Heartbeat** | Cron job / script monitor — alerts if no ping received within expected interval |

→ [Alerts sent per monitor type](docs/alerts.md)

---

## Notifications (Apprise)

Go to **Settings** and add your Apprise URLs — one per line:

```
pover://UserKey@ApiToken/          # Pushover
tgram://BotToken/ChatID/           # Telegram
discord://WebhookID/WebhookToken/  # Discord
slack://TokenA/TokenB/TokenC/      # Slack
mailto://user:pass@gmail.com       # Email
```

Full list: https://github.com/caronc/apprise/wiki

---

## Changelog webhooks

Each monitor has a **webhook token** (visible in its config panel) that lets external tools push changelog entries automatically — useful for CI/CD pipelines or redeploy scripts.

### Standard CI/CD

**Endpoint:** `POST /api/webhook/changelog`

Token can be passed in the request body or in a `token` / `Authorization: Bearer` header.

```json
{
  "token": "YOUR_MONITOR_WEBHOOK_TOKEN",
  "version": "1.2.3",
  "description": "Updated dependencies",
  "deployedAt": "2026-07-20T14:00:00Z"
}
```

`version` is required. `description` and `deployedAt` are optional (defaults to empty string and current time).

**Example — redeploy via Portainer + log to Orveil:**

```bash
#!/bin/bash
VERSION="${1:-$(date +%Y%m%d)}"
DESCRIPTION="${2:-Redeploy}"
PORTAINER_WEBHOOK="https://portainer.example.com/api/webhooks/YOUR_WEBHOOK_ID"
ORVEIL_URL="https://orveil.example.com/api/webhook/changelog"
ORVEIL_TOKEN="YOUR_MONITOR_WEBHOOK_TOKEN"

curl -X POST "$PORTAINER_WEBHOOK"
curl -X POST "$ORVEIL_URL" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$ORVEIL_TOKEN\",\"version\":\"$VERSION\",\"description\":\"$DESCRIPTION\"}"
```

### GitHub

**Endpoint:** `POST /api/webhook/github/:token`

Put your monitor webhook token directly in the URL. Supports `release`, `push` (branch and tag), and `create` (tag) events.

In GitHub → repository Settings → Webhooks:
- **Payload URL**: `https://orveil.example.com/api/webhook/github/YOUR_MONITOR_WEBHOOK_TOKEN`
- **Content type**: `application/json`
- **Events**: *Releases* and/or *Pushes*

Entries created automatically:
| GitHub event | Version | Description |
|---|---|---|
| Release published | tag name (e.g. `v1.2.3`) | Release title + body |
| Push tag | tag name | Last commit message |
| Push branch | `branch@abc1234` | Last commit message |

### Dispatcharr

**Endpoint:** `POST /api/webhook/dispatcharr`

Pass the monitor token in the `token` header. Configure a **Payload Template** in Dispatcharr for each event type with the event name hardcoded:

**EPG Refresh:**
```json
{"event": "epg_refresh", "source_name": "{{source_name}}", "channels": "{{channels}}", "programs": "{{programs}}", "skipped_programs": "{{skipped_programs}}", "unmapped_channels": "{{unmapped_channels}}"}
```

**Channel events:**
```json
{"event": "channel_start", "channel_name": "{{channel_name}}", "stream_name": "{{stream_name}}", "client_ip": "{{client_ip}}"}
```

Supported events: `channel_start`, `channel_stop`, `channel_reconnect`, `channel_error`, `channel_failover`, `stream_switch`, `recording_start`, `recording_end`, `epg_refresh`, `m3u_refresh`, `client_connect`, `client_disconnect`, `login_failed`, `epg_blocked`, `m3u_blocked`, `vod_start`, `vod_stop`.

Events are automatically mapped to human-readable labels (`EPG Refreshed`, `Channel Started`, etc.).

---

## rclone push stats

By default, the rclone monitor polls the rclone RC API (`rclone rcd`) for transfer stats. If you run backups via a standalone script (e.g. on Unraid), the daemon never sees those transfers and stats stay at zero.

**Push mode** solves this: your script sends live stats directly to Orveil every few seconds, which broadcasts them instantly via SSE to the dashboard. Both modes coexist — pushed stats take priority for 2 minutes, then the daemon stats resume automatically.

### Setup

1. Open your rclone monitor settings → **Integrations** tab
2. Generate a push token — the tab shows your **Monitor ID**, **token**, and a ready-to-use bash snippet
3. Drop the snippet into your backup script on the remote server

### Bash script example

```bash
#!/bin/bash
MONITOR_ID="<your_monitor_id>"
TOKEN="<your_push_token>"
ORVEIL="https://orveil.example.com"

push() {
  local ul=$1 dl=$2 active=$3 total=$4 errors=$5 file=$6
  curl -sf -X POST "$ORVEIL/api/monitors/$MONITOR_ID/push-stats" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"ulSpeed\":$ul,\"dlSpeed\":$dl,\"transfersActive\":$active,\"transfersTotal\":$total,\"errors\":$errors,\"fileName\":\"$file\"}" \
    > /dev/null
}

# Run rclone and push stats every 5 seconds
rclone sync source: dest: --stats 5s --stats-one-line \
  2> >(while IFS= read -r line; do
    # Parse the line and call push() with extracted values
    transfers=$(echo "$line" | grep -oP '\d+(?= transfer)' || echo 0)
    errors=$(echo "$line" | grep -oP '\d+(?= error)' || echo 0)
    push 0 0 "${transfers:-0}" 0 "${errors:-0}" "$line"
  done)

push 0 0 0 0 0 ""  # signal completion
```

### API reference

**Endpoint:** `POST /api/monitors/:id/push-stats`

Auth: `Authorization: Bearer <token>` or `?token=<token>`

| Field | Type | Description |
|-------|------|-------------|
| `ulSpeed` | number | Upload speed in bytes/s |
| `dlSpeed` | number | Download speed in bytes/s |
| `transfersActive` | number | Files currently transferring |
| `transfersTotal` | number | Total files transferred so far |
| `errors` | number | Error count |
| `checks` | number | Files checked |
| `fileName` | string | Name of the file currently being transferred |
| `elapsed` | string | Human-readable elapsed time (e.g. `ETA 2m30s`) |
| `done` | boolean | Set to `true` on the final call to signal the transfer is complete |

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_USER` | `orveil` | MongoDB username |
| `MONGO_PASS` | `orveil_pass` | MongoDB password |
| `JWT_SECRET` | **required** | JWT signing secret — `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | *(none)* | AES-256-GCM key for encrypting sensitive credentials at rest — **strongly recommended** |
| `ADMIN_USERNAME` | `admin` | Admin account username |
| `ADMIN_PASSWORD` | *(random)* | Admin account password — printed in logs on first start if not set. **Set this explicitly.** |
| `DOCKER_PROXY_URL` | *(none)* | URL of the Docker socket proxy — set to `http://docker-proxy:2375` when using the compose above |
| `FRONTEND_URL` | `http://localhost:3050` | Public URL of the app. Controls session cookie security automatically — `http://` disables the `Secure` flag, `https://` enables it. Also restricts CORS in production. |
| `METRICS_TOKEN` | *(none)* | Static Bearer token for the Prometheus metrics endpoint |

**Generate an encryption key:**

```bash
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env
```

When set, all sensitive monitor fields (API keys, tokens, passwords, private keys, proxy credentials) are encrypted in the database using AES-256-GCM.

---

## License

[MIT](LICENSE)
