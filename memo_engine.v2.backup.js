const OLLAMA = 'http://127.0.0.1:11434/api/chat';
const MODEL = 'qwen3:1.7b';

function clean(text) {
  let s = String(text || '').trim();

  s = s
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*/gi, '')
    .replace(/<\/think>/gi, '')
    .replace(/\/no_think/gi, '')
    .replace(/^MEMO\s*ASSISTANT\s*:?\s*/i, '')
    .replace(/^[-_=─]+\s*/g, '')
    .trim();

  return s;
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();
}

function detectLanguage(text) {
  if (/[\u0980-\u09FF]/u.test(text)) {
    if (/[a-zA-Z]/.test(text)) return 'mixed Bangla/Banglish';
    return 'Bangla';
  }

  if (/[a-zA-Z]/.test(text)) return 'Banglish/English';

  return 'unknown';
}

function detectTone(text) {
  const low = text.toLowerCase();

  if (
    /\b(bhai|vai|bro|dost|lol|fr|bruh|joss|koi|kemon|kmn|ki koros)\b/i.test(low)
  ) {
    return 'friendly casual Bangladesh';
  }

  if (
    /please|could you|would you|sir|madam|office|interview|application|regarding/i.test(low) ||
    /দয়া করে|অফিস|ইন্টারভিউ|আবেদন|জানাবেন|করবেন/.test(text)
  ) {
    return 'professional/respectful';
  }

  return 'natural casual';
}

function quickIntent(text) {
  const original = String(text || '').trim();
  const low = original.toLowerCase().trim();

  if (!low) return null;

  // Greetings
  if (/^(hi|hello|hey|helo|hii|heyy)[!. ]*$/i.test(low)) {
    return {
      type: 'greeting',
      answer: 'Hey! Bolo 😊'
    };
  }

  // Attention
  if (/^(bhai+|vai+|bro+|dost)[!. ]*$/i.test(low)) {
    return {
      type: 'attention',
      answer: 'Haan bhai, bolo 😊'
    };
  }

  // Location
  if (
    /\b(ekhon|akhon|now)\b/.test(low) &&
    /\b(koi|kothay|where)\b/.test(low)
  ) {
    return {
      type: 'location',
      answer: 'Ei to, ekhanei achi 😊'
    };
  }

  if (
    /\b(koi|kothay|where)\b/.test(low) &&
    /\b(aso|acho|ach|accho|achhen|achen)\b/.test(low)
  ) {
    return {
      type: 'location',
      answer: 'Ei to, ekhanei achi 😊'
    };
  }

  // What are you doing?
  if (
    /\bki\s*k(?:or|ro)s?\b|\bki\s*kro\b|\bki\s*korcho\b|\bki\s*koro\b/i.test(low) ||
    /what are you doing/i.test(low)
  ) {
    return {
      type: 'activity',
      answer: 'Tomar sathe kotha bolchi 😄'
    };
  }

  // How are you?
  if (
    /\b(kmn|kemon)\b/.test(low) &&
    /\b(acho|achis|achen|are|you)\b/.test(low)
  ) {
    return {
      type: 'wellbeing',
      answer: 'Valo achi 😊 Tumi kemon acho?'
    };
  }

  // Office / attendance
  if (
    /\b(office|ofice)\b/i.test(low) &&
    /\b(asben|ashben|asbo|ashbo|aschi|ashchi|jaben|jacchen)\b/i.test(low)
  ) {
    return {
      type: 'office',
      answer: 'Ji, office e asbo. Exact time ta janacchi 😊'
    };
  }

  if (
    /অফিস/.test(original) &&
    /(আসবেন|আসবে|আসছেন|যাবেন|যাচ্ছেন)/.test(original)
  ) {
    return {
      type: 'office',
      answer: 'জি, অফিসে আসব। Exact timeটা জানাচ্ছি 😊'
    };
  }

  // Thanks
  if (/^(thanks|thank you|thx|tnx|ধন্যবাদ)[!. ]*$/i.test(low)) {
    return {
      type: 'thanks',
      answer: 'Anytime 😊'
    };
  }

  // Acknowledgement
  if (/^(ok|okay|acha|accha|hmm|hmmm|thik|ঠিক আছে|আচ্ছা)[!. ]*$/i.test(low)) {
    return {
      type: 'ack',
      answer: 'Acha 👍'
    };
  }

  // Casual clarification
  if (
    /^(emni|emnite|emni ask korlam|emni jiggesh korlam|just ask korlam)[!. ?]*$/i.test(low)
  ) {
    return {
      type: 'casual_clarification',
      answer: 'Acha bhai 😄 emni jiggesh korcho, bujhlam.'
    };
  }

  // Creative / image prompt
  if (
    /\b(photo|picture|image)\b/.test(low) &&
    /\b(prompt|promt)\b/.test(low)
  ) {
    return {
      type: 'creative_request'
    };
  }

  if (
    /photo prompt|image prompt|picture prompt|prompt banay|prompt বানায়|prompt বানিয়ে|প্রম্পট বান/i.test(original)
  ) {
    return {
      type: 'creative_request'
    };
  }

  return null;
}
function buildConversation(batch, history) {
  const previous = (history || [])
    .slice(-8)
    .map(function(item) {
      return {
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: String(item.text || '')
      };
    });

  const current = batch
    .map(function(text, i) {
      return 'MESSAGE ' + (i + 1) + ':\n' + text;
    })
    .join('\n\n');

  return {
    previous,
    current
  };
}

function buildSystem(intent, language, tone) {
  return [
    'You are Memo, a natural WhatsApp personal assistant.',
    '',
    'CORE RULE:',
    'Understand what the person actually wants before replying.',
    'Answer the request, do not merely acknowledge it.',
    '',
    'CURRENT TASK:',
    'Read every current message.',
    'If there are multiple messages, treat them as one continuous conversation.',
    'Answer every question or request that needs an answer.',
    'Later messages may be follow-ups to earlier messages.',
    '',
    'LANGUAGE:',
    'Understand Bangla, Banglish, Roman Bangla, English, slang, abbreviations and typos.',
    'Reply naturally in the language/style of the conversation.',
    'Do not translate unless translation is requested.',
    '',
    'TONE:',
    tone,
    'Do not force bhai/bro/slang into professional conversations.',
    '',
    'INTENT:',
    intent || 'general conversation',
    '',
    'IMPORTANT:',
    'Never copy the user message as the answer.',
    'Never answer with only "Bujhlam", "Acha", "Okay" or similar when a real answer is requested.',
    'Never invent personal facts.',
    'Never pretend an unknown action happened.',
    'Never mention being an AI unless directly asked.',
    'Never reveal reasoning.',
    'Never output <think> tags.',
    'Use 0-2 natural emojis when appropriate.',
    '',
    'CREATIVE REQUESTS:',
    'If the user asks for a photo/image prompt, actually provide a ready-to-use prompt.',
    'Do not merely say that you understand.',
    'If the requested subject is clear from recent context, use it.',
    'If essential details are genuinely missing, ask one short useful clarification.',
    '',
    'OUTPUT:',
    'Return ONLY the final WhatsApp reply.'
  ].join('\n');
}

async function callOllama(messages, temperature, tokens) {
  const response = await fetch(OLLAMA, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: false,
      think: false,
      keep_alive: '10m',
      options: {
        temperature: temperature || 0.45,
        top_p: 0.9,
        num_predict: tokens || 160
      }
    })
  });

  if (!response.ok) {
    throw new Error('Ollama HTTP ' + response.status);
  }

  const data = await response.json();

  return clean(
    data &&
    data.message &&
    data.message.content
      ? data.message.content
      : ''
  );
}

function isBadReply(answer, batch) {
  const a = normalize(answer);

  if (!a || a.length < 2) return true;

  if (
    /let me think|let me see|i need to|i should|as an ai|<think>|bujhlam$/i.test(answer)
  ) {
    return true;
  }

  for (const msg of batch) {
    const m = normalize(msg);

    if (m.length >= 12 && a === m) {
      return true;
    }

    if (m.length >= 18 && a.includes(m)) {
      return true;
    }
  }

  return false;
}

async function reply(batch, history) {
  const messages = Array.isArray(batch)
    ? batch.map(x => String(x || '').trim()).filter(Boolean)
    : [];

  if (!messages.length) {
    return '';
  }

  /*
   * Simple conversational intents are handled without the small model.
   */
  if (messages.length === 1) {
    const intent = quickIntent(messages[0]);

    if (
      intent &&
      intent.answer
    ) {
      return intent.answer;
    }
  }

  const combined = messages.join('\n');
  const language = detectLanguage(combined);
  const tone = detectTone(combined);

  let intent = 'general conversation';

  const detectedList = messages
    .map(function(msg) {
      return quickIntent(msg);
    })
    .filter(Boolean);

  const detected =
    detectedList.find(function(item) {
      return item.type === 'creative_request';
    }) ||
    detectedList[detectedList.length - 1] ||
    null;

  if (detected) {
    intent = detected.type;
  }

  const conversation = buildConversation(messages, history);

  const system = buildSystem(
    intent,
    language,
    tone
  );

  const chat = [
    {
      role: 'system',
      content: system
    },
    ...conversation.previous,
    {
      role: 'user',
      content:
        'CURRENT WHATSAPP CONVERSATION:\n\n' +
        conversation.current +
        '\n\nNow answer all current requests naturally.'
    }
  ];

  let answer = await callOllama(
    chat,
    0.45,
    180
  );

  /*
   * One controlled retry instead of falling back to "Bujhlam".
   */
  if (isBadReply(answer, messages)) {
    answer = await callOllama(
      [
        {
          role: 'system',
          content:
            system +
            '\n\nThe previous draft was invalid. ' +
            'Do NOT acknowledge only. Actually answer the user request.'
        },
        {
          role: 'user',
          content:
            conversation.current +
            '\n\nGive the actual useful reply now.'
        }
      ],
      0.3,
      180
    );
  }

  if (isBadReply(answer, messages)) {
    /*
     * Do not send a fake acknowledgement.
     * Give the user a useful clarification instead.
     */
    if (detected && detected.type === 'creative_request') {
      return 'A cinematic, highly detailed portrait photograph, realistic lighting, natural skin texture, sharp focus, dramatic composition, professional photography, 4K quality.';
    }

    return 'একটু বিস্তারিত বলো, তাহলে ঠিকভাবে উত্তর দিতে পারব।';
  }

  return answer;
}

module.exports = {
  reply,
  quickIntent,
  detectLanguage,
  detectTone
};
