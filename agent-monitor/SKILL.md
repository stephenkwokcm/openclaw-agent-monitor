---
name: agent-monitor
description: Real-time agent activity dashboard for Discord. Tracks all agent/cron/sub-agent sessions via OpenClaw lifecycle hooks and maintains a live status board in a designated Discord channel. Use when you want visibility into what agents are doing — no polling, fully event-driven. Sessions are auto-tracked on bootstrap, updated on message activity, and cleaned up when idle.
---

# Agent Monitor

Event-driven agent activity dashboard for Discord. Installs as an OpenClaw hook — no skill instructions needed, just enable and go.

## What It Does

- Listens to `agent:bootstrap`, `message:sent`, `message:received`, and `command` events
- Tracks active sessions in gateway memory with last-activity timestamps
- Maintains a single auto-updating status message in your monitor channel
- Auto-removes sessions after 3 minutes of inactivity
- Deletes the board message when all sessions complete

## Status Indicators

- 🟢 Active (last activity < 2 min)
- 🟡 Slow (2–5 min no activity)
- 🔴 Stuck (> 5 min no activity)

## Setup

1. Create a `#agent-monitor` channel in your Discord server
2. Enable the hook:

```bash
openclaw hooks enable agent-monitor
```

3. (Optional) Set a custom channel ID in your OpenClaw config:

```json
{
  "hooks": {
    "agent-monitor": {
      "enabled": true,
      "env": {
        "MONITOR_CHANNEL_ID": "your-channel-id"
      }
    }
  }
}
```

A channel ID is required — set it via the env config shown above.

## How It Looks

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

## Architecture

- **Zero polling** — purely event-driven via OpenClaw hook system
- **Debounced updates** — batches rapid events into a single Discord API call (2s debounce)
- **Cleanup interval** — every 15s checks for stale sessions to remove
- **Direct Discord REST** — reads bot token from OpenClaw config, no extra dependencies
- **Main session excluded** — only tracks cron, ACP, sub-agent, and spawned sessions
