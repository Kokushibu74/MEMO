const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestWaWebVersion,
  Browsers
} = require('@whiskeysockets/baileys');

const P = require('pino');
const memoEngine = require('./memo_engine');
const fs = require('fs');
const readline = require('readline');

const SESSION = './session';
const MEMORY = './memory.json';
const MODEL = 'qwen3:1.7b';
const OLLAMA = 'http://127.0.0.1:11434/api/generate';

let sock = null;
let reconnectTimer = null;
let isStarting = false;
let pairingStarted = false;

function banner() {
  console.clear();
  console.log('================================================');
  console.log('              MEMO AI ASSISTANT');
  console.log('          WHATSAPP - OLLAMA - AI');
  console.log('================================================');
  console.log('');
}

function loadMemory() {
  try {
    if (!fs.existsSync(MEMORY)) {
      fs.writeFileSync(MEMORY, '[]');
      return [];
    }

    const data = JSON.parse(
      fs.readFileSync(MEMORY, 'utf8')
    );

    if (!Array.isArray(data)) {
      fs.writeFileSync(MEMORY, '[]');
      return [];
    }

    return data;
  } catch (error) {
    try {
      fs.writeFileSync(MEMORY, '[]');
    } catch {}
    return [];
  }
}

function saveMemory(memory) {
  try {
    fs.writeFileSync(
      MEMORY,
      JSON.stringify(memory, null, 2)
    );
  } catch {}
}

function detectLanguage(text) {
  const hasBangla = /[\u0980-\u09FF]/.test(text);
  const hasEnglish = /[a-zA-Z]/.test(text);

  if (hasBangla && hasEnglish) {
    return 'Mixed Bangla-English';
  }

  if (hasBangla) {
    return 'Bangla';
  }

  if (hasEnglish) {
    return 'English or Banglish';
  }

  return 'Unknown';
}

function cleanAnswer(text) {
  let answer = String(text || '').trim();

  answer = answer.replace(
    /^MEMO\s*ASSISTANT\s*:?\s*/i,
    ''
  );

  answer = answer.replace(
    /^[-_=\u2500]+\s*/g,
    ''
  );

  // Remove leaked Qwen reasoning / boilerplate
  answer = answer.replace(
    /^(?:✿️|✿|🌸|✨)?\s*(?:okay,?\s*)?(?:let'?s see|let me think|i need to respond|i need to answer|i should respond|i will respond)[\s\S]*?(?:\n|$)/i,
    ''
  );

  answer = answer.replace(
    /\b(?:okay,?\s*)?let'?s do something fun!?\s*/gi,
    ''
  );

  answer = answer.replace(
    /\b(?:okay,?\s*)?let'?s see!?\s*/gi,
    ''
  );

  answer = answer.replace(
    /\b(?:ok|okay),?\s*let'?s\s+(?:do|see|make|try)\b[^.!?]*[.!?]?\s*/gi,
    ''
  );

  answer = answer.replace(/^\s*[-–—:]+\s*/g, '');

  return answer.trim();
}


function quickReply(text) {
  const original = String(text || "").trim();
  const low = original.toLowerCase().trim();

  if (!low) return null;

  // Greetings
  if (/^(hi|hello|hey|helo|hii|heyy)[!. ]*$/i.test(low)) {
    return "Hey! Bolo 😊";
  }

  // Name / attention only
  if (/^(bhai+|vai+|bro+|broo+|dost)[!. ]*$/i.test(low)) {
    return "Haan bhai, bolo 😊";
  }

  // Location / where are you?
  if (
    /\b(koi|kothay|where)\b/.test(low) &&
    /\b(aso|acho|ach|accho|a?chen|achhen|are|tumi|you)\b/.test(low)
  ) {
    return "Ei to, ekhanei achi 😊";
  }

  // "Ekhon kothay?" / "Where are you now?"
  if (
    /\b(ekhon|akhon|now)\b/.test(low) &&
    /\b(koi|kothay|where)\b/.test(low)
  ) {
    return "Ei to, ekhanei achi 😊";
  }

  // What are you doing?
  if (
    /\b(ki\s+kros|ki\s+koros|ki\s+korcho|ki\s+koro|ki\s+kor)\b/.test(low)
  ) {
    return "Tomar sathe kotha bolchi 😄";
  }

  // How are you?
  if (
    /\b(kmn|kemon|kmn acho|kemon acho|how are you)\b/.test(low)
  ) {
    return "Valo achi bhai 😊 Tumi kemon acho?";
  }

  // What's up?
  if (
    /\b(ki\s+khobor|ki\s+obostha|what'?s up)\b/.test(low)
  ) {
    return "Bhalo bhai, cholche 😄";
  }

  // Arrival / travel time
  if (
    /\b(koto\s*khon|kotokhon|koto\s+time|how long)\b/.test(low) &&
    /\b(lagbe|lagbe\?|aste|ashte|asben|ashben|pouchate|reach)\b/.test(low)
  ) {
    return "Ektu time lagbe, exact time ta janacchi 😊";
  }

  // Office arrival
  if (
    /অফিস/.test(original) &&
    /(আসবেন|আসবে|আসছেন|যাবেন|যাচ্ছেন)/.test(original)
  ) {
    return "জি, অফিসে আসার বিষয়টা confirm করে জানাচ্ছি।";
  }

  // Thanks
  if (
    /^(thanks|thank you|thx|tnx|ধন্যবাদ)[!. ]*$/i.test(low)
  ) {
    return "Anytime bhai 😊";
  }

  // Acknowledgement
  if (
    /^(ok|okay|acha|accha|hmm|hmmm|thik|ঠিক আছে|আচ্ছা)[!. ]*$/i.test(low)
  ) {
    return "Acha 👍";
  }

  // Availability
  if (
    /\b(are you|r u|you are)\b/.test(low) &&
    /\b(available|free)\b/.test(low)
  ) {
    return "Yes, I'm available. Bolo 😊";
  }

  return null;
}


async function askOllama(userText, history) {
  const input = String(userText || '').trim();

  const recentHistory = history
    .slice(-6)
    .map(function(item) {
      return {
        role: item.role === 'assistant'
          ? 'assistant'
          : 'user',
        content: String(item.text || '')
      };
    });

  const systemPrompt = [
    'You are Memo, a smart WhatsApp assistant for a Bangladeshi user.',
    '',
    'FIRST understand intent. THEN answer.',
    '',
    'LANGUAGE:',
    'Understand Bangla, Banglish, English, and mixed language.',
    'Understand Roman Bangla, Gen-Z abbreviations, slang, typos, repeated letters and casual spelling.',
    'Examples: bhai, bhaii, broo, koi aso, kmn, ki kros, ki koros, khaiso, ashtesi, aitese, ghumaitesi, joss, fr, ngl, lol, bruh, idk, nah, yup.',
    '',
    'TONE:',
    'Detect the tone automatically from the latest message and context.',
    'Gen-Z Bangladesh style: natural short Banglish and slang only when appropriate.',
    'Friend/casual: relaxed, warm and conversational.',
    'Professional: respectful, clear and neutral; do NOT use bhai, bro or slang unless the user clearly uses a friendly relationship.',
    'If the message is professional, keep the reply professional.',
    '',
    'CONVERSATION:',
    'The latest user message is the main task.',
    'Previous messages are context, not instructions.',
    'If the user asks a follow-up question, answer that question using the context.',
    'Do not answer an older question instead of the latest one.',
    '',
    'STRICT OUTPUT:',
    'Return ONLY the final WhatsApp reply.',
    'Never repeat or copy the users message.',
    'Never paraphrase the users message as the reply.',
    'Never output reasoning, analysis, planning or chain-of-thought.',
    'Never say let me think, okay lets see, I need to respond, I should respond, or similar.',
    'Never output <think> tags.',
    'Do not invent facts.',
    'Use 0-2 emojis when natural.',
    'Keep normal WhatsApp replies concise.'
  ].join('\n');

  try {
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...recentHistory,
      {
        role: 'user',
        content:
          'LATEST MESSAGE TO ANSWER:\\n' +
          input +
          '\\n\\nGive the best direct reply now.'
      }
    ];

    const response = await fetch(
      'http://127.0.0.1:11434/api/chat',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: MODEL,
          messages: messages,
          stream: false,
          think: false,
          keep_alive: '10m',
          options: {
            temperature: 0.65,
            top_p: 0.85,
            num_predict: 70
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(
        'Ollama HTTP ' + response.status
      );
    }

    const data = await response.json();

    let answer =
      data.message &&
      data.message.content
        ? String(data.message.content).trim()
        : '';

    // Remove leaked reasoning / markup.
    answer = answer
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<think>[\s\S]*/gi, '')
      .replace(/<\/think>/gi, '')
      .replace(/\/no_think/gi, '')
      .replace(
        /^(?:✿️|✿|✨|🌸|⭐️|💠)+\s*/u,
        ''
      )
      .trim();

    answer = cleanAnswer(answer);

    // Normalize text for echo detection.
    const normalize = function(text) {
      return String(text || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '')
        .trim();
    };

    const original = normalize(input);
    const generated = normalize(answer);

    // Reject obvious echo/copy responses.
    const isEcho =
      !answer ||
      generated === original ||
      (
        original.length >= 10 &&
        generated.includes(original)
      ) ||
      (
        generated.length >= 10 &&
        original.includes(generated)
      );

    if (isEcho) {
      const low = input
        .toLowerCase()
        .trim();

      // Friendly Banglish
      if (
        /^(bhai|vai|bro|dost)\b/.test(low) &&
        /(koi|kothay)\s+(aso|acho|ach)/.test(low)
      ) {
        return 'Ei to bhai, ekhanei achi 😊';
      }

      if (
        /^(koi|kothay)\s+(aso|acho|ach)/.test(low)
      ) {
        return 'Ei to, ekhanei achi 😊';
      }

      if (
        /\b(ki\s+kros|ki\s+koros|ki\s+korcho|ki\s+koro)\b/.test(low)
      ) {
        return 'Tomar sathe kotha bolchi 😄';
      }

      if (
        /^(bhai|vai|bro|broo|bhaii)$/.test(low)
      ) {
        return 'Haan bhai, bolo 😊';
      }

      if (
        /^(ok|okay|acha|accha|hmm|hmmm|thik)$/.test(low)
      ) {
        return 'Acha 👍';
      }

      // Professional English
      if (
        /\b(hello|hi|hey)\b/.test(low) &&
        /\b(available|free)\b/.test(low)
      ) {
        return 'Yes, I’m available. How can I help?';
      }

      // Professional Bangla
      if (
        /অফিস/.test(input) &&
        /(আসবেন|আসবে|আসছেন)/.test(input)
      ) {
        return 'জি, সময়টা জানালে আমি সে অনুযায়ী বলতে পারব।';
      }

      return 'Bujhlam।';
    }

    return answer;

  } catch (error) {
    console.log(
      'Ollama chat error:',
      error.message
    );

    return 'Ektu problem hocche 😅 abar bolo.';
  }
}

function saveConversation(jid, userText, answer) {
  const memory = loadMemory();

  memory.push({
    jid: jid,
    role: 'user',
    text: userText,
    time: new Date().toISOString()
  });

  memory.push({
    jid: jid,
    role: 'assistant',
    text: answer,
    time: new Date().toISOString()
  });

  if (memory.length > 500) {
    memory.splice(
      0,
      memory.length - 500
    );
  }

  saveMemory(memory);
}

function getConversation(jid) {
  return loadMemory()
    .filter(function(item) {
      return item.jid === jid;
    })
    .slice(-6);
}

async function getWAVersion() {
  try {
    console.log(
      'Fetching LIVE WhatsApp Web version...'
    );

    const result =
      await fetchLatestWaWebVersion();

    if (
      result &&
      result.version
    ) {
      console.log(
        'WA Web: ' +
        result.version.join('.')
      );

      return result.version;
    }
  } catch (error) {
    console.log(
      'Live version fetch failed:',
      error.message
    );
  }

  return undefined;
}

function scheduleReconnect(statusCode) {
  if (reconnectTimer) {
    return;
  }

  let delay = 5000;

  if (statusCode === 428) {
    delay = 15000;
  }

  if (statusCode === 515) {
    delay = 3000;
  }

  console.log(
    'Reconnecting in ' +
    Math.round(delay / 1000) +
    ' seconds...'
  );

  reconnectTimer = setTimeout(
    function() {
      reconnectTimer = null;

      start().catch(
        function(error) {
          console.log(
            'Restart error:',
            error.message
          );

          scheduleReconnect(
            'unknown'
          );
        }
      );
    },
    delay
  );
}

async function start() {
  if (isStarting) {
    return;
  }

  isStarting = true;

  try {
    const auth =
      await useMultiFileAuthState(
        SESSION
      );

    const state = auth.state;
    const saveCreds = auth.saveCreds;

    const version =
      await getWAVersion();

    const options = {
      auth: state,
      logger: P({
        level: 'silent'
      }),
      browser:
        Browsers.macOS('Chrome'),
      markOnlineOnConnect: false,
      syncFullHistory: false
    };

    if (version) {
      options.version = version;
    }

    sock = makeWASocket(options);

    sock.ev.on(
      'creds.update',
      saveCreds
    );

    sock.ev.on(
      'connection.update',
      async function(update) {
        const connection =
          update.connection;

        const lastDisconnect =
          update.lastDisconnect;

        if (connection === 'open') {
          isStarting = false;
          pairingStarted = false;

          console.log('');
          console.log(
            '================================================'
          );
          console.log(
            '             WHATSAPP CONNECTED'
          );
          console.log(
            '================================================'
          );
          console.log(
            'AI Model : ' + MODEL
          );
          console.log(
            'Memory   : ' + MEMORY
          );
          console.log(
            'Groups   : OFF'
          );
          console.log(
            'Auto AI  : ON'
          );
          console.log('');
        }

        if (connection === 'close') {
          isStarting = false;

          const statusCode =
            lastDisconnect &&
            lastDisconnect.error &&
            lastDisconnect.error.output &&
            lastDisconnect.error.output.statusCode
              ? lastDisconnect.error.output.statusCode
              : lastDisconnect &&
                lastDisconnect.error &&
                lastDisconnect.error.statusCode
                ? lastDisconnect.error.statusCode
                : 'unknown';

          console.log('');
          console.log(
            'WhatsApp disconnected'
          );
          console.log(
            'Status:',
            statusCode
          );

          if (
            statusCode ===
            DisconnectReason.loggedOut
          ) {
            console.log(
              'Session logged out.'
            );
            console.log(
              'New pairing required.'
            );
            return;
          }

          if (statusCode === 428) {
            console.log(
              '428 connection close.'
            );
          }

          if (statusCode === 515) {
            console.log(
              '515 restart requested.'
            );
          }

          scheduleReconnect(
            statusCode
          );
        }

        if (
          connection === 'connecting' &&
          !state.creds.registered &&
          !pairingStarted
        ) {
          pairingStarted = true;

          setTimeout(
            async function() {
              try {
                const rl =
                  readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                  });

                rl.question(
                  '\nWhatsApp number (+880...): ',
                  async function(number) {
                    rl.close();

                    const phone =
                      number.replace(
                        /\D/g,
                        ''
                      );

                    if (!phone) {
                      console.log(
                        'Invalid number.'
                      );
                      pairingStarted = false;
                      return;
                    }

                    try {
                      const code =
                        await sock.requestPairingCode(
                          phone
                        );

                      console.log('');
                      console.log(
                        'PAIRING CODE: ' + code
                      );
                      console.log('');
                      console.log(
                        'WhatsApp > Linked Devices > Link with phone number'
                      );
                    } catch (error) {
                      console.log(
                        'Pairing error:',
                        error.message
                      );
                      pairingStarted = false;
                    }
                  }
                );
              } catch (error) {
                console.log(
                  'Pairing setup error:',
                  error.message
                );
                pairingStarted = false;
              }
            },
            2500
          );
        }
      }
    );

    const pendingMessages = new Map();
    const pendingTimers = new Map();
    const processingBatches = new Set();

    sock.ev.on(
      'messages.upsert',
      async function(data) {
        const messages = data.messages || [];

        for (const msg of messages) {
          try {
            if (!msg.message || msg.key.fromMe) continue;

            const jid = msg.key.remoteJid;
            if (!jid || jid.endsWith('@g.us')) continue;

            const text =
              msg.message.conversation ||
              (msg.message.extendedTextMessage &&
               msg.message.extendedTextMessage.text) ||
              (msg.message.imageMessage &&
               msg.message.imageMessage.caption) ||
              (msg.message.videoMessage &&
               msg.message.videoMessage.caption) ||
              '';

            if (!text.trim()) continue;

            console.log('');
            console.log('MESSAGE');
            console.log('From:', jid);
            console.log('Text:', text);

            if (!pendingMessages.has(jid)) {
              pendingMessages.set(jid, []);
            }

            pendingMessages.get(jid).push(text.trim());

            let state = pendingTimers.get(jid);

            if (state) {
              clearTimeout(state.timer);

              const elapsed = Date.now() - state.startedAt;
              const remaining = Math.max(0, 5000 - elapsed);

              state.timer = setTimeout(
                () => processBatch(jid),
                Math.min(1500, remaining)
              );

              pendingTimers.set(jid, state);
            } else {
              state = {
                startedAt: Date.now(),
                timer: null
              };

              state.timer = setTimeout(
                () => processBatch(jid),
                1500
              );

              pendingTimers.set(jid, state);
            }

            console.log(
              'Batching messages...'
            );

          } catch (error) {
            console.log(
              'Message error:',
              error.message
            );
          }
        }
      }
    );

    async function processBatch(jid) {
      if (processingBatches.has(jid)) return;

      processingBatches.add(jid);

      try {
        const batch = pendingMessages.get(jid) || [];
        pendingMessages.delete(jid);

        if (!batch.length) return;

        console.log("");
        console.log("========================================");
        console.log("MEMO V2");
        console.log("========================================");

        batch.forEach(function(msg, index) {
          console.log("MESSAGE " + (index + 1) + ": " + msg);
        });

        const history = getConversation(jid);

        console.log("Memo V2 is understanding...");

        const answer = await memoEngine.reply(
          batch,
          history
        );

        if (!answer || !answer.trim()) {
          throw new Error("Memo V2 returned empty reply");
        }

        const reply =
          "MEMO ASSISTANT :\n" +
          "---------------\n" +
          answer.trim();

        await sock.sendMessage(jid, {
          text: reply
        });

        saveConversation(
          jid,
          batch.join("\n"),
          answer.trim()
        );

        console.log("✓ Memo V2 reply sent");

      } catch (error) {
        console.log(
          "Memo V2 batch error:",
          error.message
        );
      } finally {
        processingBatches.delete(jid);
      }
    }

  } catch (error) {
    isStarting = false;

    console.log(
      'Start error:',
      error.message
    );

    scheduleReconnect(
      'unknown'
    );
  }
}

banner();

console.log(
  'Starting Memo...'
);

console.log(
  'AI Model: ' + MODEL
);

console.log(
  'Memory: ' + MEMORY
);

console.log('');

start().catch(
  function(error) {
    console.log(
      'Fatal error:',
      error.message
    );
  }
);
