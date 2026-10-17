const express = require('express');
const cors = require('cors');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');

const app = express();
app.use(cors());
app.use(express.json());

let sock = null;
let latestQR = '';
let waConnected = false;
let connectedPhone = '';
let socketReady = false;
let authRegistered = false;
let connectionState = 'initializing';
const processedMsgIds = new Set();
const messagesStore = [];

async function initWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
    authRegistered = Boolean(state.creds.registered);
    const { version } = await fetchLatestBaileysVersion();
    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome')
    });
    socketReady = true;
    connectionState = 'connecting';

    sock.ev.on('creds.update', async (creds) => {
      await saveCreds(creds);
      authRegistered = Boolean(state.creds.registered);
    });
  sock.ev.on('connection.update', (update) => {
    const { connection, qr } = update;
    if (qr) latestQR = qr;
    if (connection === 'connecting') connectionState = 'connecting';
    if (connection === 'open') {
      waConnected = true;
      connectionState = 'open';
      authRegistered = true;
      latestQR = '';
      connectedPhone = sock?.user?.id?.split(':')[0] || '';
    } else if (connection === 'close') {
      waConnected = false;
      socketReady = false;
      connectionState = 'closed';
      connectedPhone = '';
      sock = null;
      setTimeout(() => initWhatsApp(), 4000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of messages) {
      if (!m.message || m.key.fromMe) continue;
      const msgId = m.key.id;
      if (processedMsgIds.has(msgId)) continue;
      processedMsgIds.add(msgId);
      const sender = (m.key.remoteJid || '').replace('@s.whatsapp.net', '');
      const text = m.message.conversation || m.message?.extendedTextMessage?.text || '';
      if (text) {
        messagesStore.unshift({ id: msgId, client: '+' + sender, text, timestamp: Date.now(), replied: false });
        if (messagesStore.length > 200) messagesStore.pop();
      }
    }
    });
  } catch (err) {
    socketReady = false;
    waConnected = false;
    connectionState = 'error';
    console.error('WhatsApp gateway init failed:', err.message || err);
    setTimeout(() => initWhatsApp(), 5000);
  }
}

initWhatsApp();

app.get('/status', (req, res) => {
  res.json({ ok: true, ready: socketReady, registered: authRegistered, connectionState, waConnected, phone: connectedPhone, qr: latestQR, messages: messagesStore.slice(0, 50) });
});

app.post('/pair', async (req, res) => {
  try {
    const phone = String(req.body.phone || '').replace(/[^0-9]/g, '');
    if (!phone || phone.length < 7) return res.status(400).json({ error: 'Invalid phone number' });
    if (!sock || !socketReady) return res.status(503).json({ error: 'WhatsApp socket is still initializing; retry in a few seconds' });
    if (waConnected || authRegistered) return res.status(409).json({ error: 'This gateway already has a linked WhatsApp session' });
    const code = await sock.requestPairingCode(phone);
    res.json({ ok: true, code });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to request pairing code' });
  }
});

app.post('/send', async (req, res) => {
  try {
    const { to, text, msgId } = req.body;
    const clean = String(to || '').replace(/[^0-9]/g, '');
    const messageText = String(text || '').trim();
    if (!clean || clean.length < 7 || !messageText) return res.status(400).json({ error: 'Valid recipient number and message are required' });
    if (!waConnected || !sock) return res.status(503).json({ error: 'WhatsApp not connected' });
    await sock.sendMessage(clean + '@s.whatsapp.net', { text: messageText });
    if (msgId) {
      const item = messagesStore.find(m => m.id === msgId);
      if (item) item.replied = true;
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Memo 2.0 Cloud WA Gateway running on port ' + PORT));
