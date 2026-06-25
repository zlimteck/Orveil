# Prometheus & Grafana integration

Orveil exposes a Prometheus-compatible metrics endpoint at `GET /api/metrics` (authenticated with your MCP/REST API key). To wire it up with Grafana, a Prometheus scraper is required as an intermediary.

## Starting Prometheus alongside Orveil

The repository ships with a pre-configured `prometheus.yml`. The metrics endpoint uses a dedicated static token (`METRICS_TOKEN`) that you define — no need to wait for the MCP key to be generated.

**Step 1 — generate a token and add it to your `.env`:**

```bash
echo "METRICS_TOKEN=$(openssl rand -hex 32)" >> .env
```

**Step 2 — copy the example config and set your token:**

```bash
cp prometheus.yml.example prometheus.yml
```

Then edit `prometheus.yml` and replace `VOTRE_METRICS_TOKEN`:

```yaml
bearer_token: your_token_here   # same value as METRICS_TOKEN in .env
```

**Step 3 — start everything with the `monitoring` profile:**

```bash
docker compose --profile monitoring up -d
```

Prometheus will be available on **http://localhost:9090** and scrapes Orveil every 30 seconds.

## Connecting Grafana

1. In Grafana, go to **Connections → Data sources → Add data source**
2. Choose **Prometheus**
3. Set the URL to `http://orveil-prometheus:9090` (if Grafana runs in the same Docker network) or `http://localhost:9090` (if Grafana runs on the host)
4. Click **Save & test**

## Available metrics

| Metric | Type | Description |
|--------|------|-------------|
| `orveil_monitor_status` | gauge | `1` = online, `0` = offline/error/unknown |
| `orveil_monitor_latency_ms` | gauge | Last recorded latency in milliseconds |
| `orveil_monitor_uptime_24h_pct` | gauge | Uptime over the last 24 hours (%) |
| `orveil_monitor_uptime_7d_pct` | gauge | Uptime over the last 7 days (%) |
| `orveil_monitor_uptime_30d_pct` | gauge | Uptime over the last 30 days (%) |
| `orveil_incidents_open_total` | gauge | Number of currently open incidents |

All metrics carry labels `id`, `name`, `type`, and `category` for easy filtering.

## Adding Grafana to the stack (optional)

If you also want Grafana managed by Docker Compose, add this service to your `docker-compose.yml`:

```yaml
grafana:
  image: grafana/grafana:latest
  container_name: orveil-grafana
  restart: unless-stopped
  ports:
    - "3000:3000"
  volumes:
    - grafana_data:/var/lib/grafana
  depends_on:
    - prometheus
  networks:
    - orveil
  profiles:
    - monitoring
```

And add `grafana_data:` under the `volumes:` key. Then access Grafana at **http://localhost:3000** (default credentials: `admin` / `admin`).
