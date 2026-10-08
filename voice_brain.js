const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const WHISPER_BIN = path.join(
  __dirname,
  'whisper.cpp/build/bin/whisper-cli'
);

const WHISPER_MODEL = path.join(
  __dirname,
  'whisper.cpp/models/ggml-small.bin'
);

async function downloadVoice(audioMessage) {
  const chunks = [];

  const stream = await downloadContentFromMessage(
    audioMessage,
    'audio'
  );

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function runWhisper(audioFile) {
  return new Promise((resolve, reject) => {
    execFile(
      WHISPER_BIN,
      [
        '-m', WHISPER_MODEL,
        '-l', 'auto',
        '-nt',
        '-np',
        audioFile
      ],
      {
        cwd: __dirname,
        maxBuffer: 20 * 1024 * 1024
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              (stderr || error.message).trim()
            )
          );
          return;
        }

        const text = (stdout || '')
          .replace(/\r/g, ' ')
          .replace(/\n+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (!text) {
          reject(
            new Error('Whisper returned empty text')
          );
          return;
        }

        resolve(text);
      }
    );
  });
}

async function transcribe(audioMessage) {
  const filename =
    path.join(
      __dirname,
      `voice_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}.ogg`
    );

  try {
    console.log('VOICE: downloading...');

    const audio = await downloadVoice(audioMessage);

    fs.writeFileSync(filename, audio);

    console.log('VOICE: Whisper processing...');

    const text = await runWhisper(filename);

    console.log('VOICE: transcript:', text);

    return text;

  } finally {
    try {
      if (fs.existsSync(filename)) {
        fs.unlinkSync(filename);
      }
    } catch (_) {}
  }
}

module.exports = {
  transcribe
};
