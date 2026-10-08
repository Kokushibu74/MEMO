const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const readline = require('readline');

const BAILEYS = '@whiskeysockets/baileys';

function ask(q) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(q, a => {
      rl.close();
      resolve(a.trim());
    });
  });
}

function run(cmd) {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
  } catch (e) {
    return `ERROR: ${e.message}`;
  }
}

function safePackageVersion(name) {
  try {
    return require(`${name}/package.json`).version;
  } catch {
    return 'NOT INSTALLED';
  }
}

function listFiles(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

async function main() {
  console.clear();

  console.log(`
╔══════════════════════════════════════════════════╗
║        🧠 MEMO / WHATSAPP FULL DIAGNOSTIC       ║
║              PAIRING CODE INVESTIGATION         ║
╚══════════════════════════════════════════════════╝
`);

  console.log('========== SYSTEM ==========');
  console.log('Node       :', process.version);
  console.log('Platform   :', process.platform);
  console.log('Arch       :', process.arch);
  console.log('Android    :', run('getprop ro.build.version.release'));
  console.log('Device     :', run('getprop ro.product.model'));
  console.log('Termux     :', process.env.PREFIX || 'unknown');

  console.log('');
  console.log('========== PACKAGES ==========');
  console.log(
    'Baileys    :',
    safePackageVersion(BAILEYS)
  );
  console.log(
    'Pino       :',
    safePackageVersion('pino')
  );

  console.log('');
  console.log('========== NPM ==========');
  console.log(
    run('npm list --depth=0 2>/dev/null')
  );

  console.log('');
  console.log('========== NETWORK ==========');
  console.log(
    'Public IP:'
  );
  console.log(
    run('curl -4 -s --max-time 10 https://api.ipify.org')
  );

  console.log('');
  console.log(
    'WhatsApp endpoint test:'
  );
  console.log(
    run(
      'curl -I -s --max-time 10 https://web.whatsapp.com | head -n 5'
    )
  );

  console.log('');
  console.log('========== EXISTING MEMO ==========');

  const memoDir =
    path.join(process.env.HOME, 'memo');

  console.log(
    'Memo directory:',
    memoDir
  );

  console.log(
    'Memo files:',
    listFiles(memoDir).join(', ')
  );

  console.log('');
  console.log(
    'Main session exists:',
    fs.existsSync(
      path.join(memoDir, 'session')
    )
  );

  console.log(
    'Test session exists:',
    fs.existsSync(
      path.join(memoDir, 'pair_test_session')
    )
  );

  console.log('');
  console.log('========== BAILEYS API ==========');

  try {
    const baileys =
      require(BAILEYS);

    console.log(
      'Baileys loaded: YES'
    );

    console.log(
      'Exports:',
      Object.keys(baileys)
        .sort()
        .join(', ')
    );

    console.log(
      'makeWASocket:',
      typeof baileys.default
    );

    console.log(
      'useMultiFileAuthState:',
      typeof baileys.useMultiFileAuthState
    );

    console.log(
      'fetchLatestWaWebVersion:',
      typeof baileys.fetchLatestWaWebVersion
    );

    console.log(
      'fetchLatestBaileysVersion:',
      typeof baileys.fetchLatestBaileysVersion
    );

  } catch (e) {
    console.log(
      'Baileys load ERROR:',
      e.message
    );
  }

  console.log('');
  console.log('========== WHATSAPP TEST ==========');

  const input = await ask(
    'WhatsApp number (11 digits): '
  );

  if (!/^01[3-9][0-9]{8}$/.test(input)) {
    console.log('');
    console.log(
      '❌ Invalid Bangladesh number'
    );
    process.exit(1);
  }

  const phone =
    '880' + input.slice(1);

  console.log(
    'Phone format:',
    phone
  );

  /*
   * Completely isolated diagnostic auth.
   * Main Memo session is NEVER touched.
   */
  const testDir =
    path.join(
      memoDir,
      'diagnostic_session'
    );

  fs.rmSync(
    testDir,
    {
      recursive: true,
      force: true
    }
  );

  fs.mkdirSync(
    testDir,
    {
      recursive: true
    }
  );

  console.log(
    'Diagnostic session:',
    testDir
  );

  const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestWaWebVersion,
    DisconnectReason
  } = require(BAILEYS);

  const pino = require('pino');

  const {
    state,
    saveCreds
  } = await useMultiFileAuthState(
    testDir
  );

  console.log('');
  console.log(
    'Fetching current WhatsApp Web version...'
  );

  let version = null;

  try {
    const latest =
      await fetchLatestWaWebVersion();

    version = latest.version;

    console.log(
      'WA Web version:',
      version.join('.')
    );

    console.log(
      'isLatest:',
      latest.isLatest
    );

  } catch (e) {
    console.log(
      'Version fetch ERROR:',
      e.message
    );
  }

  const config = {
    auth: state,

    logger: pino({
      level: 'silent'
    }),

    /*
     * Do NOT show QR.
     * Pairing-code mode only.
     */
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

  console.log('');
  console.log(
    'Creating diagnostic socket...'
  );

  const sock =
    makeWASocket(config);

  sock.ev.on(
    'creds.update',
    async () => {
      try {
        await saveCreds();
        console.log(
          '[creds.update] SAVED'
        );
      } catch (e) {
        console.log(
          '[creds.update] SAVE ERROR:',
          e.message
        );
      }
    }
  );

  let pairingRequested = false;
  let finished = false;

  sock.ev.on(
    'connection.update',
    async update => {

      console.log(
        '\n[connection.update]'
      );

      console.log(
        JSON.stringify(
          {
            connection:
              update.connection || null,

            hasQR:
              Boolean(update.qr),

            isNewLogin:
              update.isNewLogin || false,

            receivedPendingNotifications:
              update.receivedPendingNotifications ||
              false,

            lastDisconnect:
              update.lastDisconnect
                ? {
                    message:
                      update.lastDisconnect.error?.message,

                    statusCode:
                      update.lastDisconnect.error
                        ?.output
                        ?.statusCode,

                    dataStatusCode:
                      update.lastDisconnect.error
                        ?.data
                        ?.statusCode
                  }
                : null
          },
          null,
          2
        )
      );

      /*
       * OFFICIAL-STYLE TRIGGER:
       * pairing code request is tied to QR event,
       * but QR itself is never rendered.
       */
      if (
        update.qr &&
        !pairingRequested &&
        !state.creds.registered
      ) {

        pairingRequested = true;

        console.log('');
        console.log(
          '🟢 QR REF RECEIVED'
        );
        console.log(
          '✓ QR will NOT be displayed'
        );
        console.log(
          '⏳ Requesting pairing code...'
        );

        try {

          const code =
            await sock.requestPairingCode(
              phone
            );

          const raw =
            String(code);

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
            'ENTER THIS CODE IN WHATSAPP'
          );

          console.log(
            'Settings → Linked devices →'
          );

          console.log(
            'Link a device → Link with phone number instead'
          );

          console.log('');

        } catch (e) {

          console.log('');
          console.log(
            '🔴 requestPairingCode ERROR'
          );

          console.log(
            'message:',
            e.message
          );

          console.log(
            'status:',
            e?.output?.statusCode ||
            e?.data?.statusCode ||
            'unknown'
          );
        }
      }

      if (
        update.connection === 'open'
      ) {

        finished = true;

        console.log('');
        console.log(
          '╔══════════════════════════════════════════════╗'
        );
        console.log(
          '║            🟢 LINK SUCCESS                 ║'
        );
        console.log(
          '╚══════════════════════════════════════════════╝'
        );

        console.log('');
        console.log(
          'NEW LOGIN:',
          update.isNewLogin
        );

        console.log(
          'Session saved:',
          testDir
        );

        setTimeout(
          () => process.exit(0),
          1500
        );
      }

      if (
        update.connection === 'close' &&
        !finished
      ) {

        const error =
          update.lastDisconnect?.error;

        const status =
          error?.output?.statusCode ||
          error?.data?.statusCode ||
          'unknown';

        console.log('');
        console.log(
          '╔══════════════════════════════════════════════╗'
        );
        console.log(
          '║             🔴 CONNECTION CLOSE             ║'
        );
        console.log(
          '╚══════════════════════════════════════════════╝'
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

        console.log(
          'LoggedOut:',
          status ===
            DisconnectReason.loggedOut
        );

        console.log(
          'RestartRequired:',
          status ===
            DisconnectReason.restartRequired
        );

        console.log(
          'Main Memo session touched: NO'
        );

        /*
         * Diagnostic only:
         * do not automatically reconnect.
         * We want the exact first failure.
         */

        process.exit(0);
      }
    }
  );

  /*
   * Safety timeout.
   */
  setTimeout(() => {

    if (!finished) {

      console.log('');
      console.log(
        '⏱️ Diagnostic timeout reached.'
      );

      console.log(
        'Pairing requested:',
        pairingRequested
      );

      console.log(
        'Main Memo session touched: NO'
      );

      process.exit(0);
    }

  }, 120000);
}

main().catch(err => {

  console.log('');
  console.log(
    '╔══════════════════════════════════════════════╗'
  );
  console.log(
    '║              🔴 FATAL ERROR                ║'
  );
  console.log(
    '╚══════════════════════════════════════════════╝'
  );

  console.log(
    err.stack || err.message
  );

  process.exit(1);
});
