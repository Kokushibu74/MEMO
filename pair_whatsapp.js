const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestWaWebVersion
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const readline = require('readline');

function ask(text) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(text, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.clear();

  console.log(`
╔══════════════════════════════════════════════╗
║          🧠 MEMO WHATSAPP LINK              ║
║             PAIRING CODE MODE               ║
╚══════════════════════════════════════════════╝
`);

  const number = await ask(
    'WhatsApp number (11 digits): '
  );

  if (!/^01[3-9][0-9]{8}$/.test(number)) {
    console.log('');
    console.log('❌ Invalid 11-digit Bangladesh number');
    console.log('Example: 01612345678');
    process.exit(1);
  }

  const phone = '880' + number.substring(1);

  console.log('');
  console.log('✓ Number accepted');
  console.log('✓ Pairing number:', phone);
  console.log('');

  const { state, saveCreds } =
    await useMultiFileAuthState('./session');

  let version;

  try {
    const latest =
      await fetchLatestWaWebVersion();

    version = latest.version;

    console.log(
      '✓ WA Web version:',
      version.join('.')
    );
  } catch (err) {
    console.log(
      '⚠️ Could not fetch latest WA version'
    );
  }

  const config = {
    auth: state,

    logger: pino({
      level: 'silent'
    }),

    browser: [
      'Memo AI',
      'Chrome',
      '1.0.0'
    ],

    markOnlineOnConnect: false,

    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    qrTimeout: 120000,

    syncFullHistory: false,
    generateHighQualityLinkPreview: false
  };

  if (version) {
    config.version = version;
  }

  console.log('');
  console.log(
    '⏳ Connecting to WhatsApp...'
  );

  const sock = makeWASocket(config);

  sock.ev.on(
    'creds.update',
    saveCreds
  );

  let codeRequested = false;
  let closed = false;

  sock.ev.on(
    'connection.update',
    async update => {
      const {
        connection,
        qr,
        lastDisconnect
      } = update;

      /*
       * Pairing code mode intentionally ignores QR.
       */

      if (
        !codeRequested &&
        !state.creds.registered &&
        connection === 'connecting'
      ) {
        codeRequested = true;

        console.log('');
        console.log(
          '🟢 WhatsApp socket is connecting'
        );
        console.log(
          '⏳ Requesting pairing code...'
        );

        try {
          /*
           * Small delay allows the WebSocket handshake
           * to settle before requesting the code.
           */
          await new Promise(
            resolve => setTimeout(resolve, 1500)
          );

          const code =
            await sock.requestPairingCode(phone);

          const raw = String(code);

          const display =
            raw.length === 8
              ? raw.slice(0, 4) +
                '-' +
                raw.slice(4)
              : raw;

          console.log(`
╔══════════════════════════════════════════════╗
║              🔐 PAIRING CODE               ║
╠══════════════════════════════════════════════╣
║                 ${display}                 ║
╚══════════════════════════════════════════════╝
`);

          console.log(
            'WhatsApp → Settings → Linked devices'
          );
          console.log(
            '→ Link a device → Link with phone number instead'
          );
          console.log('');
          console.log(
            '⏳ Enter the code on your phone...'
          );
          console.log('');

        } catch (err) {
          console.log('');
          console.log(
            '🔴 Pairing code request failed'
          );
          console.log(
            'Error:',
            err.message
          );

          const status =
            err?.output?.statusCode ||
            err?.data?.statusCode ||
            'unknown';

          console.log(
            'Status:',
            status
          );

          console.log('');

          if (status === 428) {
            console.log(
              '⚠️ WhatsApp closed the pairing handshake.'
            );
            console.log(
              'This is a WhatsApp/Baileys pairing-code rejection.'
            );
          }

          process.exit(1);
        }
      }

      if (connection === 'open') {
        console.log('');
        console.log(
          '╔══════════════════════════════════════════════╗'
        );
        console.log(
          '║        🟢 WHATSAPP CONNECTED               ║'
        );
        console.log(
          '╠══════════════════════════════════════════════╣'
        );
        console.log(
          '║          MEMO LINKED SUCCESSFULLY          ║'
        );
        console.log(
          '╚══════════════════════════════════════════════╝'
        );
        console.log('');
        console.log(
          '✓ Session saved'
        );
        console.log(
          '✓ Pairing complete'
        );
        console.log('');
        console.log(
          'Now run: memo'
        );
        console.log('');

        return;
      }

      if (
        connection === 'close' &&
        !closed
      ) {
        closed = true;

        const status =
          lastDisconnect?.error?.output?.statusCode ||
          lastDisconnect?.error?.data?.statusCode ||
          'unknown';

        console.log('');
        console.log(
          '🔴 WhatsApp connection closed'
        );
        console.log(
          'Status:',
          status
        );
        console.log('');

        process.exit(1);
      }
    }
  );
}

main().catch(err => {
  console.log('');
  console.log(
    '🔴 Fatal error:',
    err.message
  );
  process.exit(1);
});
