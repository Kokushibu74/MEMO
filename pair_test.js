const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestWaWebVersion
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const readline = require('readline');

const AUTH_DIR = './pair_test_session';

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

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.clear();

  console.log(`
╔══════════════════════════════════════════════╗
║       🧠 MEMO PAIRING CODE ENGINE           ║
║             515 RESTART MODE                ║
╚══════════════════════════════════════════════╝
`);

  const input = await ask(
    'WhatsApp number (11 digits): '
  );

  if (!/^01[3-9][0-9]{8}$/.test(input)) {
    console.log('');
    console.log('❌ Invalid 11-digit number.');
    process.exit(1);
  }

  const phone = '880' + input.slice(1);

  console.log('');
  console.log('✓ Number accepted');

  const {
    state,
    saveCreds
  } = await useMultiFileAuthState(AUTH_DIR);

  let version;

  try {
    const latest =
      await fetchLatestWaWebVersion();

    version = latest.version;

    console.log(
      '✓ WA Web:',
      version.join('.')
    );
  } catch {
    console.log(
      '⚠️ Using Baileys default version'
    );
  }

  let restartCount = 0;
  let pairingDone = false;
  let stopped = false;

  async function connect() {

    if (stopped) return;

    restartCount++;

    console.log('');
    console.log(
      `🔄 Socket attempt #${restartCount}`
    );

    const config = {
      auth: state,

      logger: pino({
        level: 'silent'
      }),

      browser: [
        'Ubuntu',
        'Chrome',
        '20.0.04'
      ],

      markOnlineOnConnect: false,

      connectTimeoutMs: 90000,
      defaultQueryTimeoutMs: 90000,
      qrTimeout: 120000,

      syncFullHistory: false,
      generateHighQualityLinkPreview: false
    };

    if (version) {
      config.version = version;
    }

    const sock =
      makeWASocket(config);

    sock.ev.on(
      'creds.update',
      saveCreds
    );

    let requestedThisSocket = false;

    sock.ev.on(
      'connection.update',
      async update => {

        const {
          connection,
          lastDisconnect
        } = update;

        if (connection) {
          console.log(
            'STATUS →',
            connection
          );
        }

        /*
         * Request pairing code once.
         */
        if (
          connection === 'connecting' &&
          !requestedThisSocket &&
          !state.creds.registered &&
          !pairingDone
        ) {

          requestedThisSocket = true;

          console.log(
            '⏳ Preparing pairing code...'
          );

          await sleep(2500);

          if (stopped || pairingDone) {
            return;
          }

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

            console.log(`
╔══════════════════════════════════════════════╗
║              🔐 PAIRING CODE                ║
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
              '⏳ Enter this code in WhatsApp NOW.'
            );
            console.log('');
            console.log(
              'The socket may show 515 after this.'
            );
            console.log(
              '515 will be handled automatically.'
            );
            console.log('');

          } catch (err) {

            console.log('');
            console.log(
              '🔴 Pairing request failed:'
            );
            console.log(
              err.message
            );

            console.log(
              'Status:',
              err?.output?.statusCode ||
              err?.data?.statusCode ||
              'unknown'
            );

            stopped = true;
            process.exit(1);
          }
        }

        /*
         * Successful login.
         */
        if (
          connection === 'open' &&
          !stopped
        ) {

          stopped = true;
          pairingDone = true;

          console.log(`
╔══════════════════════════════════════════════╗
║        🟢 WHATSAPP CONNECTED               ║
╠══════════════════════════════════════════════╣
║          MEMO LINKED SUCCESSFULLY          ║
╚══════════════════════════════════════════════╝
`);

          console.log(
            '✓ Session saved'
          );

          console.log(
            '✓ Pairing complete'
          );

          console.log('');
          console.log(
            'Test session:'
          );
          console.log(
            AUTH_DIR
          );

          process.exit(0);
        }

        /*
         * 515 = restart required.
         * Do NOT delete auth.
         */
        if (
          connection === 'close' &&
          !stopped
        ) {

          const status =
            lastDisconnect?.error?.output?.statusCode ||
            lastDisconnect?.error?.data?.statusCode ||
            'unknown';

          console.log('');
          console.log(
            '🔴 Socket closed'
          );
          console.log(
            'Status:',
            status
          );

          if (status === 515) {

            console.log(
              '🟡 Restart requested by WhatsApp'
            );

            console.log(
              '✓ Keeping pairing session'
            );

            console.log(
              '🔄 Reconnecting...'
            );

            await sleep(1500);

            if (!stopped) {
              connect();
            }

            return;
          }

          console.log('');
          console.log(
            '❌ Non-restart connection failure.'
          );

          stopped = true;
          process.exit(1);
        }
      }
    );
  }

  await connect();
}

main().catch(err => {
  console.log('');
  console.log(
    '🔴 FATAL ERROR'
  );
  console.log(
    err.message
  );
  process.exit(1);
});
