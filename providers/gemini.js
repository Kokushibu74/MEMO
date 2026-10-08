export async function ask(prompt, config = {}) {
  const apiKey = String(config.apiKey || "").trim();

  if (!apiKey) {
    throw new Error("Gemini API key missing");
  }

  const model = String(
    config.model || "gemini-3.8-flash"
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
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(model)}:generateContent`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: String(prompt || "")
              }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 1000
        }
      }),
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        data?.error?.message ||
        `Gemini HTTP ${response.status}`;

      throw new Error(message);
    }

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part?.text || "")
        .join("")
        .trim();

    if (!text) {
      const reason =
        data?.promptFeedback?.blockReason ||
        data?.candidates?.[0]?.finishReason ||
        "empty response";

      throw new Error(`Gemini ${reason}`);
    }

    return text;

  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        `Gemini timeout after ${timeout}ms`
      );
    }

    throw error;

  } finally {
    clearTimeout(timer);
  }
}
