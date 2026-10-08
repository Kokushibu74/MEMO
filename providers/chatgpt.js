export async function ask(prompt, config) {
  if (!config?.apiKey) throw new Error("ChatGPT API key missing");

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    config.timeout || 4000
  );

  try {
    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 300
        }),
        signal: controller.signal
      }
    );

    if (!response.ok) {
      throw new Error(`ChatGPT HTTP ${response.status}`);
    }

    const data = await response.json();

    const text =
      data?.choices?.[0]?.message?.content?.trim();

    if (!text) {
      throw new Error("ChatGPT returned empty response");
    }

    return text;
  } finally {
    clearTimeout(timer);
  }
}
