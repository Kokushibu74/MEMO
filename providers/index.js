import fs from "fs";
import path from "path";

import * as gemini from "./gemini.js";
import * as chatgpt from "./chatgpt.js";
import * as claude from "./claude.js";
import * as grok from "./grok.js";
import * as deepseek from "./deepseek.js";
import * as groq from "./groq.js";

const CONFIG_FILE = path.join(process.cwd(), "config", "ai.json");

const adapters = {
  groq,
  gemini,
  chatgpt,
  claude,
  grok,
  deepseek
};

const quotaCooldowns = new Map();

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return { providers: {} };
  }
}

function saveConfig(config) {
  fs.writeFileSync(
    CONFIG_FILE,
    JSON.stringify(config, null, 2)
  );
}

function isConfigured(p) {
  return (
    p &&
    p.enabled === true &&
    typeof p.apiKey === "string" &&
    p.apiKey.trim().length > 0
  );
}

function isQuotaError(error) {
  const msg = String(error?.message || error || "").toLowerCase();

  return (
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("rate_limit") ||
    msg.includes("resource exhausted") ||
    msg.includes("too many requests") ||
    msg.includes("429") ||
    msg.includes("limit:")
  );
}

function providerList(config) {
  return Object.entries(config.providers || {})
    .filter(([name, p]) => adapters[name] && isConfigured(p))
    .sort(
      (a, b) =>
        Number(a[1].priority || 999) -
        Number(b[1].priority || 999)
    );
}

export async function askWithFallback(prompt, options = {}) {
  const config = loadConfig();
  const providers = providerList(config);

  if (!providers.length) {
    throw new Error(
      "No configured AI provider. Add at least one AI API."
    );
  }

  const errors = [];

  for (const [name, provider] of providers) {
    const adapter = adapters[name];

    // Skip provider while its quota cooldown is active.
    const cooldownUntil = quotaCooldowns.get(name) || 0;

    if (cooldownUntil > Date.now()) {
      const remaining = Math.ceil(
        (cooldownUntil - Date.now()) / 60000
      );

      console.log(
        `⏭️ ${provider.name || name}: quota cooldown active (${remaining}m)`
      );

      errors.push(
        `${provider.name || name}: quota cooldown`
      );

      continue;
    }

    // Clear expired cooldown.
    if (cooldownUntil) {
      quotaCooldowns.delete(name);
    }

    // LIVE ENGINE: show the provider currently being attempted
    globalThis.MEMO_ENGINE = String(
      provider.name || name || "FALLBACK"
    ).toUpperCase();

    console.log(
      `🧠 Trying ${provider.name || name}...`
    );

    try {
      const result = await adapter.ask(prompt, {
        ...provider,
        ...options
      });

      if (!result || !String(result).trim()) {
        throw new Error("Empty AI response");
      }

      // Successful provider.
      provider.failureCount = 0;
      provider.lastSuccess = new Date().toISOString();

      saveConfig(config);

      // LIVE ENGINE: lock UI to the provider that actually replied
      globalThis.MEMO_ENGINE = String(
        provider.name || name || "FALLBACK"
      ).toUpperCase();

      console.log(
        `✅ ${provider.name || name}: response received`
      );

      return String(result).trim();

    } catch (error) {
      const message = String(
        error?.message || error || "Unknown error"
      );

      errors.push(
        `${provider.name || name}: ${message}`
      );

      provider.failureCount =
        Number(provider.failureCount || 0) + 1;

      // Quota/rate-limit errors get a long cooldown.
      // This prevents MEMO from repeatedly hitting exhausted Gemini quota.
      if (isQuotaError(error)) {
        const cooldownMs = 10 * 60 * 60 * 1000;

        quotaCooldowns.set(
          name,
          Date.now() + cooldownMs
        );

        console.log(
          `⚠️ ${provider.name || name}: quota/rate limit reached`
        );

        console.log(
          `⏭️ ${provider.name || name}: switching to next configured AI`
        );
      } else {
        console.log(
          `⚠️ ${provider.name || name}: failed`
        );

        console.log(
          `⏭️ Switching to next configured AI`
        );
      }

      try {
        saveConfig(config);
      } catch {}

      // IMPORTANT:
      // Never stop here. Always continue to the next configured provider.
      continue;
    }
  }

  throw new Error(
    "All configured AI providers failed:\n" +
    errors.join("\n")
  );
}

export function getProviderConfig(name) {
  const config = loadConfig();
  return config.providers?.[name] || null;
}

export function setProvider(name, data = {}) {
  const config = loadConfig();

  if (!config.providers) {
    config.providers = {};
  }

  config.providers[name] = {
    ...(config.providers[name] || {}),
    ...data
  };

  saveConfig(config);
  return config.providers[name];
}

export function removeProviderKey(name) {
  const config = loadConfig();

  if (config.providers?.[name]) {
    config.providers[name].apiKey = "";
    config.providers[name].enabled = false;
    config.providers[name].failureCount = 0;
    config.providers[name].lastSuccess = null;
  }

  saveConfig(config);
}

export function listProviders() {
  const config = loadConfig();

  return Object.entries(config.providers || {})
    .sort(
      (a, b) =>
        Number(a[1].priority || 999) -
        Number(b[1].priority || 999)
    )
    .map(([id, provider]) => ({
      id,
      name: provider.name || id,
      enabled: provider.enabled === true,
      configured:
        typeof provider.apiKey === "string" &&
        provider.apiKey.trim().length > 0,
      priority: Number(provider.priority || 999),
      model: provider.model || ""
    }));
}

export function clearQuotaCooldown(name) {
  quotaCooldowns.delete(name);
}

export function getActiveProviders() {
  const config = loadConfig();

  return providerList(config).map(
    ([name, provider]) => ({
      id: name,
      name: provider.name || name,
      priority: Number(provider.priority || 999),
      model: provider.model || ""
    })
  );
}

export function getActiveProviderNames() {
  return getActiveProviders().map(p => p.name);
}




