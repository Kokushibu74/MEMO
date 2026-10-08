export async function ask(prompt, config) {
  if (!config?.apiKey) throw new Error("Grok API key missing");

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    config.timeout || 4000
  );

  try {
    const response = await fetch(
      "https://api.x.ai/v1/chat/completions",
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
      throw new Error(`Grok HTTP ${response.status}`);
    }

    const data = await response.json();

    const text =
      data?.choices?.[0]?.message?.content?.trim();

    if (!text) {
      throw new Error("Grok returned empty response");
    }

    return text;
  } finally {
    clearTimeout(timer);
  }
}
