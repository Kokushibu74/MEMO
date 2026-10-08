export async function ask(prompt, config = {}) {
  const apiKey = String(config.apiKey || "").trim();

  if (!apiKey) {
    throw new Error("Groq API key missing");
  }

  const model = String(
    config.model || "llama-3.3-70b-versatile"
  ).trim();

  const timeout = Math.max(
    10000,
    Number(config.timeout || 20000)
  );

  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    timeout
  );

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: String(prompt || "")
            }
          ],
          max_tokens: 1000
        }),
        signal: controller.signal
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        data?.error?.message ||
        `Groq HTTP ${response.status}`;

      throw new Error(message);
    }

    const text =
      data?.choices?.[0]?.message?.content
        ?.trim();

    if (!text) {
      throw new Error("Groq empty response");
    }

    return text;

  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Groq timeout after ${timeout}ms`);
    }

    throw error;

  } finally {
    clearTimeout(timer);
  }
}
