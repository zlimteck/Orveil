# MCP Server

Orveil exposes a [Model Context Protocol](https://modelcontextprotocol.io) server so AI assistants can query your monitoring data directly.

## Tools available

### Read

| Tool | Description |
|------|-------------|
| `list_monitors` | List all monitors with status, SLA target, category, confirmAfter, maintenance state (filterable by status / category / enabled) |
| `get_monitor` | Full details, metrics, recent snapshots, and changelog entries for a specific monitor |
| `list_incidents` | Recent incidents with severity, duration, postmortem — filterable by open/resolved or monitor |
| `get_stats` | Global counts per status |
| `get_stats_detailed` | Full statistics: MTTR, MTTN, uptime per monitor (30d), SLA compliance, incidents/day, severity breakdown |
| `list_annotations` | Manual event markers attached to monitors |
| `list_postmortems` | Incidents with a written post-mortem (summary, root cause, impact, resolution, lessons) |
| `get_uptime` | Daily uptime history per monitor (up to 90 days) |

### Write

| Tool | Description |
|------|-------------|
| `trigger_check` | Trigger an immediate check for a monitor |
| `create_annotation` | Add an event marker on a monitor's metric graph (e.g. "backup started", "deployed v2.1") |
| `set_maintenance` | Put a monitor in maintenance mode for N minutes — suppresses alerts |
| `cancel_maintenance` | Cancel an active maintenance window immediately |
| `resolve_incident` | Manually close an open incident with an optional postmortem summary |
| `create_changelog` | Add a deployment/version entry to a monitor's graph |

Resources `orveil://monitors/{name}` are also available for direct URI access.

## Streamable HTTP (remote)

The MCP endpoint is available at `/api/mcp`. The API key is auto-generated on first start and visible in **Settings → Integrations → MCP Server**.

```json
{
  "mcpServers": {
    "orveil": {
      "url": "http://your-server:3050/api/mcp",
      "type": "streamable-http",
      "headers": {
        "Authorization": "Bearer <your-mcp-api-key>"
      }
    }
  }
}
```

## stdio (local / Claude Desktop)

```json
{
  "mcpServers": {
    "orveil": {
      "command": "node",
      "args": ["/path/to/orveil/backend/mcp-stdio.js"],
      "env": {
        "MONGO_URI": "mongodb://orveil:orveil_pass@localhost:27017/orveil"
      }
    }
  }
}
```

The same API key also works as a Bearer token on all `/api` REST endpoints.
