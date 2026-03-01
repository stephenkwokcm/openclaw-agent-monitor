# 🦞 OpenClaw Agent Monitor

Real-time agent activity dashboard for [OpenClaw](https://github.com/openclaw/openclaw) + Discord. Event-driven — no polling.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ AGENT MONITOR — 2 active
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🟢 morning-briefing
   ├ Type: cron
   ├ Runtime: 45s
   └ Last activity: 12s ago

🔴 market-close
   ├ Type: cron
   ├ Runtime: 6m 10s
   └ ⚠️ No activity for 5m 30s

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Updated: 12:32:15 HKT
```

## What It Does

Tracks all agent/cron/sub-agent sessions and maintains a **single auto-updating message** in a Discord channel:

- **🟢 Active** — last activity < 2 minutes
- **🟡 Slow** — 2–5 minutes no activity
- **🔴 Stuck** — > 5 minutes no activity

Sessions are automatically removed after 3 minutes of inactivity. When all sessions complete, the status message is deleted.

## How It Works

Installs as an OpenClaw hook — fully event-driven, zero polling:

- `agent:bootstrap` — new session detected
- `message:sent` / `message:received` — activity heartbeat
- `command:stop/reset/new` — session ended

Updates are **debounced** (2s) to avoid Discord rate limits. A cleanup sweep runs every 15s to remove stale sessions.

## Install

### Via ClawHub (recommended)

```bash
clawhub install stephenkwokcm/openclaw-agent-monitor
```

### Manual

1. Clone this repo into your OpenClaw hooks directory:

```bash
git clone https://github.com/stephenkwokcm/openclaw-agent-monitor.git \
  ~/.openclaw/hooks/agent-monitor
```

2. Copy the hook handler:

```bash
cp -r agent-monitor/hooks/openclaw/* ~/.openclaw/hooks/agent-monitor/
```

3. Enable the hook in your OpenClaw config (`~/.openclaw/openclaw.json`):

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "agent-monitor": {
          "enabled": true
        }
      }
    }
  }
}
```

## Configuration

Create a `#agent-monitor` channel in your Discord server, then set the channel ID:

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "agent-monitor": {
          "enabled": true,
          "env": {
            "MONITOR_CHANNEL_ID": "your-discord-channel-id"
          }
        }
      }
    }
  }
}
```

The hook reads your Discord bot token from `channels.discord.token` in your OpenClaw config — no extra auth setup needed.

## Architecture

- **Zero polling** — purely event-driven via OpenClaw hook lifecycle
- **Debounced updates** — batches rapid events into a single Discord API call
- **In-memory state** — sessions tracked in gateway process memory (resets on restart)
- **Direct Discord REST** — no extra dependencies, uses native `fetch`
- **Main session excluded** — only tracks cron, ACP, sub-agent, and spawned sessions

## Requirements

- [OpenClaw](https://github.com/openclaw/openclaw) with Discord channel configured
- Node.js 18+ (for native `fetch`)

## License

MIT
