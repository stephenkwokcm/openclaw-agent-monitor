/**
 * Agent Monitor Hook — Real-time activity dashboard for Discord
 *
 * Tracks agent sessions via lifecycle events and maintains a live
 * status board in #agent-monitor. Fully event-driven, no polling.
 */

const { readFileSync } = require('fs');
const { join } = require('path');

// --- Constants ---
const FALLBACK_CHANNEL_ID = '';
const STALE_MS = 5 * 60 * 1000;   // 5 min → stuck (red)
const SLOW_MS  = 2 * 60 * 1000;   // 2 min → slow (yellow)
const DONE_MS  = 3 * 60 * 1000;   // 3 min no activity → remove
const CLEANUP_INTERVAL = 15000;    // Cleanup check every 15s
const DEBOUNCE_MS = 2000;          // Debounce board updates

// --- State (persists in gateway process memory) ---
const sessions = new Map();
let botToken = '';
let channelId = '';
let statusMsgId = null;
let debounceTimer = null;
let cleanupTimer = null;
let ready = false;

// --- Init (once) ---
function init() {
  if (ready) return;
  ready = true;

  channelId = process.env.MONITOR_CHANNEL_ID || FALLBACK_CHANNEL_ID;

  try {
    const cfg = JSON.parse(
      readFileSync(join(process.env.HOME || '/root', '.openclaw', 'openclaw.json'), 'utf-8'),
    );
    botToken = cfg?.channels?.discord?.token || '';
  } catch {
    console.error('[agent-monitor] Failed to read config for bot token');
  }

  cleanupTimer = setInterval(() => void cleanup(), CLEANUP_INTERVAL);
}

// --- Discord REST helpers ---
async function api(method, path, body) {
  if (!botToken) return null;
  try {
    const res = await fetch(`https://discord.com/api/v10${path}`, {
      method,
      headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) return null;
    if (res.status === 204) return {};
    return await res.json();
  } catch {
    return null;
  }
}

// --- Formatting ---
function statusIcon(lastActivity) {
  const gap = Date.now() - lastActivity;
  if (gap > STALE_MS) return '🔴';
  if (gap > SLOW_MS) return '🟡';
  return '🟢';
}

function fmtDur(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function inferType(key) {
  if (key.includes(':cron:')) return 'cron';
  if (key.includes(':acp:') || key.includes('acp-')) return 'acp';
  if (key.includes(':subagent:') || key.includes('subagent')) return 'subagent';
  if (key.includes(':spawn:')) return 'spawned';
  return 'session';
}

function inferLabel(key) {
  const parts = key.split(':');
  const last = parts[parts.length - 1];
  if (last && /^[a-f0-9-]{8,}$/i.test(last) && parts.length > 1) {
    return parts[parts.length - 2] || last;
  }
  return last || key;
}

function buildBoard() {
  if (sessions.size === 0) return '';

  const now = Date.now();
  const lines = [
    '```',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `⚡ AGENT MONITOR — ${sessions.size} active`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
  ];

  for (const s of sessions.values()) {
    const icon = statusIcon(s.lastActivity);
    const runtime = fmtDur(now - s.startedAt);
    const lastAgo = fmtDur(now - s.lastActivity);

    lines.push(`${icon} ${s.label}`);
    lines.push(`   ├ Type: ${s.type}`);
    lines.push(`   ├ Runtime: ${runtime}`);

    if (now - s.lastActivity > STALE_MS) {
      lines.push(`   └ ⚠️ No activity for ${lastAgo}`);
    } else {
      lines.push(`   └ Last activity: ${lastAgo} ago`);
    }
    lines.push('');
  }

  const hkt = new Date().toLocaleTimeString('en-HK', {
    timeZone: 'Asia/Hong_Kong',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push(`Updated: ${hkt} HKT`);
  lines.push('```');

  return lines.join('\n');
}

// --- Board update (debounced) ---
function scheduleUpdate() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void pushUpdate(), DEBOUNCE_MS);
}

async function pushUpdate() {
  if (!channelId) return;

  const content = buildBoard();

  if (!content) {
    if (statusMsgId) {
      await api('DELETE', `/channels/${channelId}/messages/${statusMsgId}`);
      statusMsgId = null;
    }
    return;
  }

  if (statusMsgId) {
    const res = await api('PATCH', `/channels/${channelId}/messages/${statusMsgId}`, { content });
    if (!res) statusMsgId = null;
  }

  if (!statusMsgId) {
    const res = await api('POST', `/channels/${channelId}/messages`, { content });
    if (res?.id) statusMsgId = res.id;
  }
}

// --- Cleanup stale sessions ---
async function cleanup() {
  if (sessions.size === 0) return;

  const now = Date.now();
  let changed = false;

  for (const [key, s] of sessions) {
    if (now - s.lastActivity > DONE_MS) {
      sessions.delete(key);
      changed = true;
    }
  }

  if (changed) scheduleUpdate();
}

// --- Hook entry point ---
const handler = async (event) => {
  if (!event || typeof event !== 'object') return;

  init();

  const key = event.sessionKey || '';
  if (!key || key === 'agent:main:main') return;

  if (event.type === 'agent' && event.action === 'bootstrap') {
    sessions.set(key, {
      key,
      type: inferType(key),
      label: inferLabel(key),
      startedAt: Date.now(),
      lastActivity: Date.now(),
    });
    scheduleUpdate();
    return;
  }

  if (event.type === 'message' && (event.action === 'sent' || event.action === 'received')) {
    const existing = sessions.get(key);
    if (existing) {
      existing.lastActivity = Date.now();
    } else {
      sessions.set(key, {
        key,
        type: inferType(key),
        label: inferLabel(key),
        startedAt: Date.now(),
        lastActivity: Date.now(),
      });
    }
    scheduleUpdate();
    return;
  }

  if (event.type === 'command') {
    const action = event.action;
    if (action === 'stop' || action === 'reset' || action === 'new') {
      if (sessions.has(key)) {
        sessions.delete(key);
        scheduleUpdate();
      }
    }
  }
};

module.exports = handler;
module.exports.default = handler;
