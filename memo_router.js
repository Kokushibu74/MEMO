const memoEngine = require('./memo_engine');

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .trim();
}

function detectBrain(text) {
  const s = normalize(text);

  // Personal / owner
  // Route owner/boss/my identity requests to the Personal Brain.
  if (
    /\b(shihab|owner|malik|boss|contact|phone|number|mobile|facebook|fb|fb id|facebook id|my|amar|amr|tmr boss|tomar boss|your boss|id)\b/i.test(s) ||
    /শিহাব|মালিক|বস|যোগাযোগ|নাম্বার|নম্বর|ফোন|মোবাইল|ফেসবুক|ফেসবুক আইডি|আমার|তোমার বস|আইডি/.test(s)
  ) {
    return 'personal';
  }

  // Coding / technical
  if (
    /\b(code|coding|program|programming|javascript|python|node|npm|termux|api|json|html|css|bash|script|debug|error)\b/i.test(s) ||
    /কোড|প্রোগ্রাম|স্ক্রিপ্ট|বাগ|এরর/.test(s)
  ) {
    return 'coding';
  }

  // Creative / prompt
  if (
    /\b(prompt|cinematic|creative|story|image|animation|video|design|poster|logo)\b/i.test(s) ||
    /প্রম্পট|গল্প|ছবি|এনিমেশন|ভিডিও|ডিজাইন|পোস্টার|লোগো/.test(s)
  ) {
    return 'creative';
  }

  // Research / reasoning
  if (
    /\b(research|latest|news|compare|comparison|why|explain|analysis|analyze|information)\b/i.test(s) ||
    /রিসার্চ|সাম্প্রতিক|খবর|তুলনা|কেন|ব্যাখ্যা|বিশ্লেষণ|তথ্য/.test(s)
  ) {
    return 'research';
  }

  // Simple conversation
  if (
    /^(hi|hello|hey|assalamualaikum|salam|হাই|হ্যালো|সালাম)/i.test(s) ||
    /কেমন আছ|আছো|আছিস|কি করো|কী করো|কোথায় আছ/.test(s)
  ) {
    return 'chat';
  }

  return 'general';
}

function getBrainInstructions(brain) {
  const brains = {
    chat: `
You are Memo's Chat Brain.
Be natural, friendly and concise.
Reply in Bengali script.
`,

    coding: `
You are Memo's Coding Brain.
Solve programming and technical problems accurately.
Explain in Bengali, but keep code, commands, filenames,
URLs, APIs and technical identifiers unchanged.
If code is requested, provide working code.
`,

    creative: `
You are Memo's Creative Brain.
Handle prompts, stories, image/video concepts and creative writing.
If the user asks for a prompt, write the prompt in English.
Explain surrounding information in Bengali.
`,

    personal: `
You are Memo's Personal Brain.

OWNER:
Name: Shihab
Phone: +8801620107233
Facebook: https://www.facebook.com/shihabul.islam.74/

Interpret these as referring to the owner when appropriate:
- Shihab
- owner
- malik / মালিক
- boss / বস
- amar / আমার
- my
- tmr boss / tomar boss / your boss

If the user asks for the owner's number, phone, mobile or contact,
return exactly:
+8801620107233

If the user asks for the owner's Facebook, FB, Facebook ID,
FB ID, profile or ID when the context means Facebook,
return exactly:
https://www.facebook.com/shihabul.islam.74/

Never invent another phone number, ID or URL.
Never replace the configured values with placeholders.
Preserve the phone number and URL exactly.
Reply in Bengali unless the user asks for another language.
`,

    research: `
You are Memo's Research Brain.
Reason carefully and distinguish facts from assumptions.
For current information, external research may be needed.
Reply in Bengali unless the user explicitly requests another language.
`,

    general: `
You are Memo's General Brain.
Have a natural conversation and solve the user's request.
Reply in Bengali script unless the user explicitly requests another language.
`
  };

  return brains[brain] || brains.general;
}

async function route(batch, history = []) {
  const text = Array.isArray(batch)
    ? batch.join('\n')
    : String(batch || '');

  const brain = detectBrain(text);
  const instructions = getBrainInstructions(brain);

  console.log('');
  console.log('========== MEMO V1.2 ROUTER ==========');
  console.log('Brain:', brain);
  console.log('======================================');

  // Existing engine remains the final response generator for now.
  // This keeps V1.2 compatible with the current stable Memo engine.
  const answer = await memoEngine.reply(
    batch,
    history,
    instructions
  );

  return {
    brain,
    instructions,
    answer
  };
}

module.exports = {
  detectBrain,
  getBrainInstructions,
  route
};
