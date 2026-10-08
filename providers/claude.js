export async function ask(prompt, config) {
  if (!config?.apiKey) throw new Error("Claude API key missing");

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    config.timeout || 4000
  );

  try {
    const response = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 300,
          temperature: 0.7,
          messages: [
            { role: "user", content: prompt }
          ]
        }),
        signal: controller.signal
      }
    );

    if (!response.ok) {
      throw new Error(`Claude HTTP ${response.status}`);
    }

    const data = await response.json();

    const text =
      data?.content
        ?.filter(x => x.type === "text")
        ?.map(x => x.text || "")
        ?.join("")
        ?.trim();

    if (!text) {
      throw new Error("Claude returned empty response");
    }

    return text;
  } finally {
    clearTimeout(timer);
  }
}
