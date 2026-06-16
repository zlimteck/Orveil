# NotifHub

Unified monitoring dashboard with notifications via [Apprise](https://github.com/caronc/apprise/wiki). Monitor your self-hosted services, get alerted on incidents, and send notifications to any channel.

![Dashboard](docs/screenshots/01-Dashboard.png)

![New service](docs/screenshots/02-NewService.png)

## Features

- **Unified dashboard** — status overview of all your services at a glance
- **11 monitor types** — HTTP/HTTPS, Ping/TCP, SSH, Proxmox, Cloudflare, AdGuard, Portainer, Syncthing, Immich, HostMyServers, Ultra.cc
- **Incident tracking** — automatic incident open/close with duration history
- **Apprise notifications** — Pushover, Telegram, Discord, Slack, email, and [100+ more](https://github.com/caronc/apprise/wiki)
- **Manual notifications** — send a message to all channels directly from the UI
- **Light / dark theme** — persisted per browser
- **FR / EN interface** — language toggle in the sidebar
- **REST API** — full API with Bearer token auth, documented in-app

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Database | MongoDB |
| Notifications | Apprise (self-hosted sidecar) |
| Deployment | Docker Compose |

## Quick start

**Prerequisites:** Docker + Docker Compose

```bash
git clone https://github.com/zlimteck/notifhub.git
cd notifhub
cp .env.example .env
# Edit .env — change JWT_SECRET and ADMIN_PASSWORD before exposing publicly
docker compose up -d
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3050 |
| Backend API | http://localhost:5050 |
| Apprise API | http://localhost:8008 |

Default credentials: `admin` / `notifhub`

## Available monitors

| Type | What it checks |
|------|----------------|
| **HTTP** | HTTP/HTTPS endpoint — status code, optional keyword match, TLS cert |
| **Ping** | ICMP ping or TCP port reachability |
| **SSH** | CPU / RAM via SSH (password or private key) |
| **Proxmox** | Node CPU / RAM via API token |
| **Cloudflare** | Tunnel status via API token |
| **AdGuard** | DNS protection status and request stats |
| **Portainer** | Container count via API key |
| **Syncthing** | Synced folders via API key |
| **Immich** | Disk usage via API key |
| **HMS (HostMyServers)** | VPS CPU / RAM via API token |
| **Ultra.cc** | Seedbox storage and traffic via Stats API URL |

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

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_USER` | `notifhub` | MongoDB username |
| `MONGO_PASS` | `notifhub_pass` | MongoDB password |
| `JWT_SECRET` | `notifhub-change-me-in-production` | JWT signing secret — **change this** |
| `ADMIN_USERNAME` | `admin` | Admin account username |
| `ADMIN_PASSWORD` | `notifhub` | Admin account password — **change this** |
| `VITE_API_URL` | `http://localhost:5050` | Backend URL (build-time, frontend only) |

## License

[MIT](LICENSE)
