const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestWaWebVersion,
  DisconnectReason
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const HOME = process.env.HOME;
const MEMO_DIR = path.join(HOME, 'memo');
const SESSION_DIR = path.join(MEMO_DIR, 'session');

let PHONE = '';
let pairingRequested = false;
let loginComplete = false;
let attempt = 0;

function ask(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getPhone() {

  console.clear();

  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║           🧠 MEMO AI ASSISTANT              ║');
  console.log('║              WHATSAPP LOGIN                 ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  console.log('🇧🇩 Country prefix: +88');
  console.log('📱 Enter your 11 digit Bangladesh number');
  console.log('   Example: 016XXXXXXXX');
  console.log('');

  while (true) {

    const input = await ask('WhatsApp number: ');

    if (/^01[3-9][0-9]{8}$/.test(input)) {

      PHONE = '880' + input.slice(1);

      console.log('');
      console.log('🟢 Number accepted');
      console.log('📞 WhatsApp:', '+' + PHONE);
      console.log('');

      return;
    }

    console.log('');
    console.log('🔴 Invalid number.');
    console.log('Use exactly 11 digits: 01XXXXXXXXX');
    console.log('');
  }
}

async function createSocket(state, saveCreds, version) {

  attempt++;

  console.log('');
  console.log('══════════════════════════════════════════════');
  console.log(`🔄 WhatsApp connection attempt #${attempt}`);
  console.log('══════════════════════════════════════════════');

  const config = {

    auth: state,

    logger: pino({
      level: 'silent'
    }),

    printQRInTerminal: false,

    browser: [
      'Ubuntu',
      'Chrome',
      '122.0.0.0'
    ],

    markOnlineOnConnect: true,

    syncFullHistory: false,

    connectTimeoutMs: 90000,

    defaultQueryTimeoutMs: 90000,

    qrTimeout: 120000,

    generateHighQualityLinkPreview: false
  };

  if (version) {
    config.version = version;
  }

  const sock = makeWASocket(config);

  sock.ev.on('creds.update', async () => {

    try {
      await saveCreds();
    } catch (e) {
      console.log(
        '🔴 Credentials save error:',
        e.message
      );
    }

  });

  sock.ev.on('connection.update', async update => {

    if (update.connection === 'connecting') {

      console.log(
        '🟡 Connecting to WhatsApp...'
      );
    }

    /*
     * IMPORTANT:
     * QR is NOT displayed.
     * We only use the QR event as the signal
     * that WhatsApp is ready for pairing-code request.
     */
    if (
      update.qr &&
      !pairingRequested &&
      !state.creds.registered
    ) {

      pairingRequested = true;

      console.log('');
      console.log(
        '🟢 WhatsApp pairing channel ready'
      );

      console.log(
        '⏳ Generating pairing code...'
      );

      try {

        const code =
          await sock.requestPairingCode(
            PHONE
          );

        const raw = String(code);

        const display =
          raw.length === 8
            ? raw.slice(0, 4) +
              '-' +
              raw.slice(4)
            : raw;

        console.log('');
        console.log(
          '╔══════════════════════════════════════════════╗'
        );
        console.log(
          '║              🔐 PAIRING CODE               ║'
        );
        console.log(
          '╠══════════════════════════════════════════════╣'
        );
        console.log(
          `║                 ${display}                 ║`
        );
        console.log(
          '╚══════════════════════════════════════════════╝'
        );
        console.log('');

        console.log(
          '📱 WhatsApp → Settings → Linked devices'
        );

        console.log(
          '→ Link a device → Link with phone number instead'
        );

        console.log('');
        console.log(
          '⚠️ Enter the code above in WhatsApp.'
        );
        console.log('');

      } catch (e) {

        console.log('');
        console.log(
          '🔴 Pairing code error:',
          e.message
        );

        console.log(
          'Status:',
          e?.output?.statusCode ||
          e?.data?.statusCode ||
          'unknown'
        );

        process.exit(1);
      }
    }

    /*
     * LOGIN SUCCESS
     */
    if (
      update.connection === 'open'
    ) {

      loginComplete = true;

      console.log('');
      console.log(
        '╔══════════════════════════════════════════════╗'
      );
      console.log(
        '║          🟢 WHATSAPP LOGIN SUCCESS         ║'
      );
      console.log(
        '╚══════════════════════════════════════════════╝'
      );

      console.log('');
      console.log(
        '✓ Session saved'
      );

      console.log(
        '✓ WhatsApp linked'
      );

      console.log(
        '✓ Starting Memo Neural Core...'
      );

      console.log('');

      await sleep(1500);

      /*
       * Start the real Memo application only AFTER
       * WhatsApp login has succeeded.
       */
      const child = spawn(
        process.execPath,
        ['whatsapp.js'],
        {
          cwd: MEMO_DIR,
          stdio: 'inherit',
          env: process.env
        }
      );

      child.on('exit', code => {

        console.log('');
        console.log(
          `🔴 Memo stopped. Exit code: ${code}`
        );

        process.exit(
          typeof code === 'number'
            ? code
            : 1
        );
      });

      return;
    }

    /*
     * 515 = restart required
     *
     * DO NOT ask for phone number again.
     * DO NOT generate another pairing code.
     * Reuse the same session.
     */
    if (
      update.connection === 'close' &&
      !loginComplete
    ) {

      const error =
        update.lastDisconnect?.error;

      const status =
        error?.output?.statusCode ||
        error?.data?.statusCode ||
        'unknown';

      console.log('');
      console.log(
        '🔴 WhatsApp connection closed'
      );

      console.log(
        'Status:',
        status
      );

      console.log(
        'Error:',
        error?.message ||
        'unknown'
      );

      /*
       * WhatsApp 515
       */
      if (
        status ===
        DisconnectReason.restartRequired
      ) {

        console.log('');
        console.log(
          '🟡 WhatsApp requested restart...'
        );

        console.log(
          '🟡 Keeping the same login session.'
        );

        console.log(
          '🟡 Phone number will NOT be requested again.'
        );

        console.log('');

        /*
         * Recreate socket using same auth state.
         */
        pairingRequested = true;

        await sleep(2000);

        await createSocket(
          state,
          saveCreds,
          version
        );

        return;
      }

      /*
       * 401 = unauthorized.
       */
      if (
        status ===
        DisconnectReason.loggedOut ||
        status === 401
      ) {

        console.log('');
        console.log(
          '🔴 WhatsApp rejected the session.'
        );

        console.log(
          'The login session must be created again.'
        );

        console.log('');
        console.log(
          'Session directory:',
          SESSION_DIR
        );

        process.exit(1);
      }

      /*
       * Other temporary connection errors.
       */
      if (attempt < 5) {

        console.log('');
        console.log(
          '🟡 Temporary connection failure.'
        );

        console.log(
          '🔄 Retrying...'
        );

        await sleep(3000);

        await createSocket(
          state,
          saveCreds,
          version
        );

      } else {

        console.log('');
        console.log(
          '🔴 Maximum connection attempts reached.'
        );

        process.exit(1);
      }
    }
  });

  return sock;
}

async function main() {

  /*
   * Ask number ONLY ONCE.
   */
  await getPhone();

  /*
   * Existing session is intentionally preserved.
   * If it is a fresh install, pairing happens.
   */
  fs.mkdirSync(
    SESSION_DIR,
    {
      recursive: true
    }
  );

  const {
    state,
    saveCreds
  } =
    await useMultiFileAuthState(
      SESSION_DIR
    );

  console.log('');
  console.log(
    '🔎 Checking WhatsApp Web version...'
  );

  let version = null;

  try {

    const latest =
      await fetchLatestWaWebVersion();

    version =
      latest.version;

    console.log(
      '✓ WA Web:',
      version.join('.')
    );

    console.log(
      '✓ Latest:',
      latest.isLatest
    );

  } catch (e) {

    console.log(
      '🟡 Version check failed:',
      e.message
    );

    console.log(
      'Using Baileys default version.'
    );
  }

  /*
   * If already registered, don't ask for pairing.
   */
  if (state.creds.registered) {

    console.log('');
    console.log(
      '🟢 Existing WhatsApp session found.'
    );

    console.log(
      '⏳ Connecting...'
    );

    pairingRequested = true;
  }

  await createSocket(
    state,
    saveCreds,
    version
  );
}

main().catch(error => {

  console.log('');
  console.log(
    '╔══════════════════════════════════════════════╗'
  );
  console.log(
    '║              🔴 MEMO LOGIN ERROR            ║'
  );
  console.log(
    '╚══════════════════════════════════════════════╝'
  );

  console.log('');
  console.log(
    error.stack ||
    error.message
  );

  process.exit(1);
});
