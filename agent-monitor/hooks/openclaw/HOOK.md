---
name: agent-monitor
description: "Real-time agent activity dashboard in Discord"
metadata: {"openclaw":{"emoji":"⚡","events":["agent:bootstrap","message:sent","message:received","command"]}}
---

# Agent Monitor Hook

Real-time event-driven agent activity dashboard. Posts a live status board to a Discord channel, updated on every agent lifecycle event.

## How It Works

- Listens to `agent:bootstrap`, `message:sent`, `message:received`, and `command` events
- Tracks active sessions in memory with last-activity timestamps
- Sends/edits a single status message in the monitor channel via Discord REST API
- Auto-removes sessions after 3 minutes of inactivity
- Status indicators: `🟢` active, `🟡` slow (>2m), `🔴` stuck (>5m)
- Deletes the status message when all sessions complete

## Configuration

Set `MONITOR_CHANNEL_ID` in the hook env config:

```json
{
  "hooks": {
    "agent-monitor": {
      "enabled": true,
      "env": {
        "MONITOR_CHANNEL_ID": "your-discord-channel-id"
      }
    }
  }
}
```
