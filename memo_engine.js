const OLLAMA = 'http://127.0.0.1:11434/api/chat';
const MODEL = 'qwen3:1.7b';

const OWNER = {
  name: 'Shihab',
  phone: '+8801620107233',
  facebook: 'https://www.facebook.com/shihabul.islam.74/'
};


function clean(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function normalize(text) {
  return clean(text)
    .toLowerCase()
    .replace(/[?!.,،。]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectLanguage(text) {
  const s = String(text || '');

  const bn = (s.match(/[\u0980-\u09FF]/g) || []).length;
  const en = (s.match(/[a-zA-Z]/g) || []).length;

  if (bn > en * 1.5) return 'bangla';
  if (en > bn * 1.5) return 'english';
  return 'banglish';
}

function detectTone(text) {
  const s = normalize(text);

  if (/\b(bhai|vai|bro|dost|re|tui|tor|kire)\b/.test(s)) {
    return 'casual_friend';
  }

  if (/\b(please|kindly|sir|madam|apni|apnar)\b/.test(s)) {
    return 'polite';
  }

  return 'normal';
}

/* =========================
   BRAIN: NORMALIZATION
========================= */

function normalizeIntentText(text) {
  let s = normalize(text);

  // Common Banglish variations
  s = s
    .replace(/\bki\s+kro\b/g, 'ki koro')
    .replace(/\bki\s+kros\b/g, 'ki koros')
    .replace(/\bki\s+kor\b/g, 'ki koro')
    .replace(/\bki\s+krcho\b/g, 'ki korcho')
    .replace(/\baso\b/g, 'acho')
    .replace(/\baso\b/g, 'acho')
    .replace(/\bacho\b/g, 'acho')
    .replace(/\baccho\b/g, 'acho')
    .replace(/\bachen\b/g, 'achen')
    .replace(/\bachhen\b/g, 'achen');

  return s;
}

/* =========================
   BRAIN: INTENT
========================= */

function detectIntent(text) {
  const raw = clean(text);
  const s = normalizeIntentText(raw);

  if (!s) {
    return { type: 'empty', confidence: 1 };
  }

  // Owner / Boss identity and contact
  // Supports Bangla, Banglish and common wording variations.

  const ownerWord =
    /\b(shihab|owner|malik|boss)\b|শিহাব|মালিক|বস/.test(s);

  const myWord =
    /\b(amar|amr|my|tmr boss|tomar boss|your boss)\b|আমার|তোমার বস|আপনার বস/.test(s);

  const phoneWord =
    /\b(number|phone|mobile|contact|cell|number ta|phone ta)\b|নাম্বার|নম্বর|ফোন|মোবাইল|যোগাযোগ/.test(s);

  const facebookWord =
    /\b(facebook|facebook id|fb|fb id|fb profile|facebook profile)\b|ফেসবুক|ফেসবুক আইডি|ফেসবুক প্রোফাইল/.test(s);

  const idWord =
    /\b(id|id ta|id dao|id dew|id den)\b|আইডি/.test(s);

  // "my/amar" or "boss/Shihab/owner" + phone/contact
  if (
    (ownerWord || myWord) &&
    phoneWord
  ) {
    return {
      type: 'owner_contact',
      confidence: 0.99
    };
  }

  // "my/amar" or "boss/Shihab/owner" + Facebook/FB
  if (
    (ownerWord || myWord) &&
    (facebookWord || idWord)
  ) {
    return {
      type: 'owner_facebook',
      confidence: 0.99
    };
  }

  // Direct Facebook/ID request containing Shihab/boss
  if (
    ownerWord &&
    (facebookWord || idWord)
  ) {
    return {
      type: 'owner_facebook',
      confidence: 0.99
    };
  }

  // Presence / "are you there?"
  if (
    /^(acho|achen|where are you|are you there)$/.test(s) ||
    /\b(koi acho|kothay acho|ekhon koi|ekhon kothay)\b/.test(s)
  ) {
    return {
      type: 'presence',
      confidence: 0.98
    };
  }

  // Activity
  if (
    /^(ki koro|ki koros|ki korcho|what are you doing)$/.test(s)
  ) {
    return {
      type: 'activity',
      confidence: 0.98
    };
  }

  // Greeting
  if (/^(hi|hello|helo|hey|hii|heyy)$/.test(s)) {
    return {
      type: 'greeting',
      confidence: 0.99
    };
  }

  // Attention
  if (/^(bhai|vai|bro|dost)$/.test(s)) {
    return {
      type: 'attention',
      confidence: 0.99
    };
  }

  // Wellbeing
  if (
    /^(kemon acho|kmn acho|kemon achen|how are you)$/.test(s)
  ) {
    return {
      type: 'wellbeing',
      confidence: 0.97
    };
  }

  // Thanks
  if (/^(thanks|thank you|thx|tnx|dhonnobad)$/.test(s)) {
    return {
      type: 'thanks',
      confidence: 0.99
    };
  }

  // Acknowledgement
  if (/^(ok|okay|acha|accha|hmm|hmmm|thik ache|thik)$/.test(s)) {
    return {
      type: 'ack',
      confidence: 0.99
    };
  }

  // Casual clarification
  if (
    /^(emni|emnite|emni ask korlam|emni jiggesh korlam|just ask korlam)$/.test(s)
  ) {
    return {
      type: 'casual_clarification',
      confidence: 0.99
    };
  }

  // Office
  if (
    /\b(office|ofice)\b/.test(s) &&
    /\b(asben|ashben|asbo|ashbo|aschi|ashchi|jaben|jacchen)\b/.test(s)
  ) {
    return {
      type: 'office',
      confidence: 0.96
    };
  }

  // Creative / prompt
  if (
    /\b(photo|picture|image|pic)\b/.test(s) &&
    /\b(prompt|promt)\b/.test(s)
  ) {
    return {
      type: 'creative',
      confidence: 0.96
    };
  }

  if (
    /prompt banay|prompt banao|prompt dao|prompt den|prompt chai/.test(s)
  ) {
    return {
      type: 'creative',
      confidence: 0.94
    };
  }

  return {
    type: 'general',
    confidence: 0.50
  };
}

/* =========================
   BRAIN: CONTEXT
========================= */

function buildContext(batch, history) {
  const current = batch.map(clean).filter(Boolean);

  // Keep enough recent context for conversation understanding,
  // but keep the prompt small for fast Qwen inference.
  const previous = Array.isArray(history)
    ? history.slice(-20)
    : [];

  return {
    currentMessages: current,
    previousMessages: previous,
    messageCount: current.length,
    combinedText: current.join('\n')
  };
}

/* =========================
   BRAIN: REASONING
========================= */

function reason(context) {
  const intents = context.currentMessages.map(detectIntent);

  // Strongest intent wins
  const priority = [
    'owner_contact',
    'owner_facebook',
    'creative',
    'office',
    'wellbeing',
    'activity',
    'presence',
    'general',
    'casual_clarification',
    'ack',
    'thanks',
    'greeting',
    'attention'
  ];

  let selected = intents[intents.length - 1];

  for (const type of priority) {
    const found = intents.find(x => x.type === type);
    if (found) {
      selected = found;
      break;
    }
  }

  return {
    intent: selected.type,
    confidence: selected.confidence,
    language: detectLanguage(context.combinedText),
    tone: detectTone(context.combinedText),
    needsModel: ![
      'owner_contact',
      'owner_facebook',
      'presence',
      'activity',
      'greeting',
      'attention',
      'wellbeing',
      'thanks',
      'ack',
      'casual_clarification'
    ].includes(selected.type)
  };
}

/* =========================
   BRAIN: DIRECT REPLY
========================= */

function directReply(reasoning) {
  if (reasoning.intent === 'owner_contact') {
    return `শিহাবের সাথে যোগাযোগ করতে এই নম্বরে কল করতে পারো: ${OWNER.phone}`;
  }

  if (reasoning.intent === 'owner_facebook') {
    return `শিহাবের Facebook ID: ${OWNER.facebook}`;
  }

  if (reasoning.intent === 'prompt_request') {
    return null;
  }

  const lang = reasoning.language;
  const casual = reasoning.tone === 'casual_friend';

  switch (reasoning.intent) {

    case 'presence':
      if (lang === 'bangla') return 'হ্যাঁ, আছি 😊';
      if (lang === 'english') return 'Yes, I’m here 😊';
      return casual ? 'Haan bhai, achi 😊' : 'Haan, achi 😊';

    case 'activity':
      if (lang === 'bangla') return 'তোমার সাথে কথা বলছি 😄';
      if (lang === 'english') return 'I’m talking with you 😄';
      return casual ? 'Tomar sathe kotha bolchi 😄' : 'Tomar sathe kotha bolchi।';

    case 'greeting':
      return 'Boss is busy now, I am here, Memo Assistant. 😊';

    case 'attention':
      if (lang === 'bangla') return 'হ্যাঁ, বলো 😊';
      if (lang === 'english') return 'Yes, tell me 😊';
      return 'Haan bhai, bolo 😊';

    case 'wellbeing':
      if (lang === 'bangla') return 'ভালো আছি 😊 তুমি কেমন আছো?';
      if (lang === 'english') return 'I’m good 😊 How are you?';
      return 'Valo achi 😊 Tumi kemon acho?';

    case 'thanks':
      if (lang === 'bangla') return 'স্বাগতম 😊';
      return 'Anytime 😊';

    case 'ack':
      if (lang === 'bangla') return 'আচ্ছা 👍';
      return 'Acha 👍';

    case 'casual_clarification':
      if (lang === 'bangla') return 'আচ্ছা 😄 বুঝলাম।';
      return 'Acha bhai 😄 bujhlam.';

    default:
      return null;
  }
}

/* =========================
   QWEN
========================= */


// ─────────────────────────────────────────────
// MEMO_GENZ_LIBRARY
// ─────────────────────────────────────────────
let MEMO_GENZ_LIBRARY = [];

try {
  const fs = require('fs');
  const path = require('path');
  const p = path.join(__dirname, 'genz_library.json');

  if (fs.existsSync(p)) {
    MEMO_GENZ_LIBRARY = JSON.parse(fs.readFileSync(p, 'utf8'));
  }
} catch (_) {
  MEMO_GENZ_LIBRARY = [];
}

function getGenZExamples(messages) {
  const list = Array.isArray(messages) ? messages : [messages];
  const normalized = list
    .map(x => String(x || '').trim().toLowerCase())
    .filter(Boolean);

  if (!normalized.length || !MEMO_GENZ_LIBRARY.length) return '';

  const hits = [];

  for (const item of MEMO_GENZ_LIBRARY) {
    const target = String(item.message || '').trim().toLowerCase();
    if (!target) continue;

    for (const msg of normalized) {
      if (
        msg === target ||
        msg.replace(/[!?.,]+$/g, '') === target.replace(/[!?.,]+$/g, '')
      ) {
        hits.push(item);
        break;
      }
    }

    if (hits.length >= 5) break;
  }

  if (!hits.length) return '';

  return hits.map(item => {
    const replies = Array.isArray(item.replies)
      ? item.replies.join(' | ')
      : String(item.replies || '');

    return `Message: ${item.message}
Style: ${item.type}
Possible natural replies: ${replies}`;
  }).join('\n');
}

async function callQwen(context, reasoning, retry = false, brainInstructions = '') {

  const system = `
You are Memo, a personal WhatsApp assistant.

Selected Brain Instructions:
${brainInstructions || 'Use the General Brain behavior.'}

Your job:
1. Understand what the user actually means.
2. Use the conversation context.
3. Answer the user's request directly.
4. NEVER copy or slightly rewrite the user's message.
5. NEVER say things like "Asos ki korben?" when the user means "Are you there?"
6. Do not invent facts.
7. Match the user's language: Bangla, Banglish or English.
8. Match the user's tone: casual, polite or normal.
9. If several messages are present, answer the relevant points together.
10. Use Recent conversation to understand references like "ওটা", "এটা", "আগেরটা", "তারপর", etc.
11. Current messages are the newest user intent and should take priority over older context.
12. Never repeat questions the user already answered in Recent conversation.
13. Be concise and natural.
14. Do not mention being an AI, model, prompt, intent or system.

Detected intent:
${reasoning.intent}

Language:
${reasoning.language}

Gen-Z understanding examples:
${getGenZExamples(context.currentMessages) || 'No exact Gen-Z pattern matched. Use context and normal reasoning.'}

Tone:
${reasoning.tone}

Current messages:
${context.currentMessages.join('\n')}

Recent conversation:
${context.previousMessages.join('\n')}

Return ONLY the final answer.
`;

  const response = await fetch(OLLAMA, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: system
        }
      ],
      stream: false,
      think: false,
      options: {
        temperature: retry ? 0.25 : 0.40,
        top_p: 0.90,
        num_predict: 180
      }
    })
  });

  if (!response.ok) {
    throw new Error('Ollama HTTP ' + response.status);
  }

  const data = await response.json();

  let answer = '';

  if (data.message && data.message.content) {
    answer = data.message.content;
  } else if (data.response) {
    answer = data.response;
  }

  return clean(answer);
}

/* =========================
   QUALITY CONTROL
========================= */

function qualityCheck(answer, context) {

  if (!answer) return false;

  const a = normalize(answer);

  if (!a) return false;

  for (const msg of context.currentMessages) {
    const m = normalize(msg);

    if (!m) continue;

    // Exact echo
    if (a === m) return false;

    // Very suspicious echo
    if (m.length > 5 && a.includes(m)) return false;
  }

  const bad = [
    'as an ai',
    'i am an ai',
    'language model',
    'prompt:',
    'user message:',
    'i cannot understand your message'
  ];

  if (bad.some(x => a.includes(x))) {
    return false;
  }

  return true;
}

/* =========================
   MAIN MEMO BRAIN
========================= */

async function reply(batch, history, brainInstructions = '') {

  const messages = Array.isArray(batch)
    ? batch.map(clean).filter(Boolean)
    : [clean(batch)].filter(Boolean);

  if (!messages.length) {
    return 'Bolo 😊';
  }

  const context = buildContext(messages, history);
  const reasoning = reason(context);

  console.log('');
  console.log('🧠 MEMO BRAIN V3');
  console.log('Intent    :', reasoning.intent);
  console.log('Confidence:', reasoning.confidence);
  console.log('Language  :', reasoning.language);
  console.log('Tone      :', reasoning.tone);
  console.log('Qwen      :', reasoning.needsModel ? 'YES' : 'NO');

  // Brain handles simple conversation itself.
  if (!reasoning.needsModel) {
    const direct = directReply(reasoning);

    if (direct) {
      console.log('Brain     : DIRECT');
      return direct;
    }
  }

  // Complex requests go to Qwen.
  try {

    console.log('Brain     : QWEN');

    let answer = await callQwen(context, reasoning, false, brainInstructions);

    if (qualityCheck(answer, context)) {
      return answer;
    }

    console.log('Quality   : RETRY');

    answer = await callQwen(context, reasoning, true, brainInstructions);

    if (qualityCheck(answer, context)) {
      return answer;
    }

  } catch (error) {
    console.log('Qwen error:', error.message);
  }

  // Safe fallback
  if (reasoning.intent === 'creative') {
    return 'A cinematic, highly detailed realistic photograph, natural lighting, sharp focus, dramatic composition, professional photography, 4K quality.';
  }

  return reasoning.language === 'bangla'
    ? 'একটু বিস্তারিত বলো, তাহলে ঠিকভাবে উত্তর দিতে পারব।'
    : 'Ektu details bolo, tahole thik vabe answer dite parbo.';
}

module.exports = {
  reply,
  detectIntent,
  detectLanguage,
  detectTone,
  normalize
};
