const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  DisconnectReason
} = require('@whiskeysockets/baileys');

const app = express();
app.disable('x-powered-by');
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-MEMO-Token']
}));
app.use(express.json({ limit: '32kb' }));

const PORT = Number(process.env.PORT || 3000);
const GATEWAY_TOKEN = String(process.env.MEMO_GATEWAY_TOKEN || '');
const AUTH_DIR = process.env.MEMO_AUTH_DIR || path.join(process.cwd(), 'auth_info_baileys');

let sock = null;
let latestQR = '';
let waConnected = false;
let connectedPhone = '';
let socketReady = false;
let authRegistered = false;
let connectionState = 'initializing';
let initInProgress = false;
let pairingRequestedAt = 0;

const processedMsgIds = new Set();
const sentMsgIds = new Set();
const messagesStore = [];
const pairAttempts = new Map();

function secureEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}

function requireGatewayToken(req, res, next) {
  if (!GATEWAY_TOKEN) {
    return res.status(503).json({ error: 'Gateway token is not configured on the server' });
  }
  if (!secureEqual(req.get('X-MEMO-Token'), GATEWAY_TOKEN)) {
    return res.status(401).json({ error: 'Invalid gateway access token' });
  }
  next();
}

function pairRateLimited(ip) {
  const now = Date.now();
  const recent = (pairAttempts.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);
  if (recent.length >= 5) {
    pairAttempts.set(ip, recent);
    return true;
  }
  recent.push(now);
  pairAttempts.set(ip, recent);
  return false;
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'memo-wa-bridge', connectionState });
});

app.use('/status', requireGatewayToken);
app.use('/pair', requireGatewayToken);
app.use('/send', requireGatewayToken);

async function initWhatsApp() {
  if (initInProgress) return;
  initInProgress = true;
  socketReady = false;
  connectionState = 'initializing';

  try {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    authRegistered = Boolean(state.creds.registered);
    const { version } = await fetchLatestBaileysVersion();

    const currentSock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'),
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
      keepAliveIntervalMs: 25_000,
      markOnlineOnConnect: false,
      syncFullHistory: false
    });
    sock = currentSock;
    connectionState = 'connecting';

    currentSock.ev.on('creds.update', async () => {
      await saveCreds();
      authRegistered = Boolean(state.creds.registered);
    });

    currentSock.ev.on('connection.update', ({ connection, qr, lastDisconnect }) => {
      if (sock !== currentSock) return;
      // The socket is safe to call only after Baileys has emitted its first connection update.
      socketReady = true;
      if (qr) latestQR = qr;

      if (connection === 'connecting') {
        connectionState = 'connecting';
      } else if (connection === 'open') {
        waConnected = true;
        connectionState = 'open';
        authRegistered = true;
        latestQR = '';
        pairingRequestedAt = 0;
        connectedPhone = currentSock.user?.id?.split(':')[0] || '';
        console.log('WhatsApp linked and socket opened for', connectedPhone);
      } else if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        waConnected = false;
        socketReady = false;
        connectionState = statusCode === DisconnectReason.loggedOut ? 'logged_out' : 'closed';
        connectedPhone = '';
        latestQR = '';
        sock = null;
        console.warn('WhatsApp connection closed; status:', statusCode || 'unknown');
        if (statusCode !== DisconnectReason.loggedOut) {
          setTimeout(() => { initInProgress = false; initWhatsApp(); }, 4000);
        }
      }
    });

    currentSock.ev.on('messages.upsert', ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const m of messages || []) {
        if (!m.message || m.key.fromMe || !m.key.id || processedMsgIds.has(m.key.id)) continue;
        processedMsgIds.add(m.key.id);
        const jid = m.key.remoteJid || '';
        if (jid.endsWith('@g.us') || jid.endsWith('@broadcast') || jid === 'status@broadcast') continue;
        const sender = jid.replace('@s.whatsapp.net', '').replace('@lid', '');
        const messageText = m.message.conversation
          || m.message.extendedTextMessage?.text
          || m.message.imageMessage?.caption
          || m.message.videoMessage?.caption
          || '';
        if (!sender || !messageText.trim()) continue;
        messagesStore.unshift({
          id: m.key.id,
          client: '+' + sender,
          text: messageText.trim(),
          timestamp: Date.now(),
          replied: sentMsgIds.has(m.key.id),
          handled: sentMsgIds.has(m.key.id)
        });
        if (messagesStore.length > 500) messagesStore.length = 500;
      }
    });
  } catch (err) {
    socketReady = false;
    waConnected = false;
    connectionState = 'error';
    sock = null;
    console.error('WhatsApp gateway init failed:', err.message || err);
    setTimeout(() => { initInProgress = false; initWhatsApp(); }, 5000);
  }
}

app.get('/status', (_req, res) => {
  const unhandled = messagesStore.filter(m => !m.handled && !m.replied);
  const latest = messagesStore.slice(0, 50);
  const merged = [...new Map([...unhandled, ...latest].map(m => [m.id, m])).values()];
  res.json({
    ok: true,
    ready: socketReady,
    registered: authRegistered,
    connectionState,
    waConnected,
    phone: connectedPhone,
    qr: latestQR,
    messages: merged
  });
});

app.post('/pair', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  try {
    const phone = String(req.body.phone || '').replace(/[^0-9]/g, '');
    if (!/^\d{8,15}$/.test(phone)) {
      return res.status(400).json({ error: 'Enter a valid international phone number including country code' });
    }
    if (!sock || !socketReady) {
      return res.status(503).json({ error: 'WhatsApp socket is still initializing; wait a few seconds and retry' });
    }
    if (waConnected || authRegistered) {
      return res.status(409).json({ error: 'A WhatsApp account is already linked to this gateway. Log out/reset its saved session first.' });
    }
    if (Date.now() - pairingRequestedAt < 30_000) {
      return res.status(429).json({ error: 'A pairing code was just requested. Wait 30 seconds before requesting another.' });
    }
    if (pairRateLimited(ip)) {
      return res.status(429).json({ error: 'Too many pairing requests. Wait 10 minutes and try again.' });
    }

    pairingRequestedAt = Date.now();
    const code = await sock.requestPairingCode(phone);
    if (!code) throw new Error('WhatsApp did not return a pairing code');
    res.json({ ok: true, code: String(code).replace(/[^A-Z0-9-]/gi, ''), phone });
  } catch (err) {
    pairingRequestedAt = 0;
    console.error('Pairing code request failed:', err.message || err);
    res.status(502).json({ error: err.message || 'Failed to request a real WhatsApp pairing code' });
  }
});


app.post('/ack', (req, res) => {
  const msgId = String(req.body?.msgId || '');
  if (!msgId) return res.status(400).json({ error: 'msgId is required' });
  const item = messagesStore.find(m => m.id === msgId);
  if (!item) return res.status(404).json({ error: 'Incoming message not found' });
  item.handled = true;
  res.json({ ok: true, replied: item.replied });
});

app.post('/send', async (req, res) => {
  try {
    const { to, text, msgId } = req.body || {};
    const clean = String(to || '').replace(/[^0-9]/g, '');
    const messageText = String(text || '').trim();
    if (!/^\d{8,15}$/.test(clean) || !messageText) {
      return res.status(400).json({ error: 'Valid recipient number and non-empty message are required' });
    }
    if (!waConnected || !sock) return res.status(503).json({ error: 'WhatsApp not connected' });
    if (msgId && sentMsgIds.has(String(msgId))) {
      return res.json({ ok: true, duplicate: true });
    }

    await sock.sendMessage(clean + '@s.whatsapp.net', { text: messageText });
    if (msgId) {
      const id = String(msgId);
      sentMsgIds.add(id);
      if (sentMsgIds.size > 1000) sentMsgIds.delete(sentMsgIds.values().next().value);
      const item = messagesStore.find(m => m.id === id);
      if (item) { item.replied = true; item.handled = true; }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('WhatsApp send failed:', err.message || err);
    res.status(502).json({ error: err.message || 'WhatsApp send failed' });
  }
});

app.listen(PORT, () => {
  console.log('MEMO WhatsApp Gateway listening on port ' + PORT);
  if (!GATEWAY_TOKEN) console.error('FATAL CONFIG: Set MEMO_GATEWAY_TOKEN before exposing this gateway publicly.');
  initWhatsApp();
});
