# 🤖 MEMO — Multi-AI WhatsApp Assistant

> **A powerful multi-AI WhatsApp assistant for Android + Termux with automatic AI fallback, conversation memory, Bangla/Banglish support, and local configuration.**

[![Platform](https://img.shields.io/badge/Platform-Android-green?style=for-the-badge)](https://github.com/Kokushibu74/MEMO)
[![Termux](https://img.shields.io/badge/Termux-Supported-blue?style=for-the-badge)](https://termux.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Required-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-AI%20Assistant-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://www.whatsapp.com/)

---

## ✨ What is MEMO?

**MEMO** is a personal WhatsApp AI assistant designed to run directly on **Android using Termux**.

It connects WhatsApp with multiple AI providers and can automatically switch between them when one provider is unavailable, rate-limited, timed out, or reaches its quota.

MEMO is designed with a focus on:

- 🧠 Intelligent AI conversations
- 🔄 Automatic provider fallback
- 💾 Conversation memory
- 💬 Bangla, Banglish & English
- ✍️ Typo and follow-up understanding
- 📱 WhatsApp automation
- ⚙️ Local configuration
- 🎨 Multiple UI themes

---

## 🚀 Core Features

| Feature | Status |
|---|---|
| 🤖 Google Gemini | ✅ |
| 🧠 OpenAI / ChatGPT | ✅ |
| 🧩 Claude | ✅ |
| ⚡ Grok | ✅ |
| 🔎 DeepSeek | ✅ |
| 🚀 Groq | ✅ |
| 🔄 Automatic AI Fallback | ✅ |
| 💾 Conversation Memory | ✅ |
| 💬 Bangla / Banglish / English | ✅ |
| 🧠 Follow-up Understanding | ✅ |
| ✍️ Typo Understanding | ✅ |
| 📱 WhatsApp AI Reply | ✅ |
| 🎨 Multiple Themes | ✅ |
| 🔐 Local API Configuration | ✅ |

---

## 🧠 Intelligent AI Fallback

MEMO can use multiple AI providers in a priority-based fallback system.

```text
Gemini
   ↓
ChatGPT
   ↓
Claude
   ↓
Grok
   ↓
DeepSeek
   ↓
Groq
   ↓
Fallback Response
```

If the current provider fails because of:

- API error
- Rate limit
- Quota
- Timeout
- Temporary service failure

MEMO can automatically try the next configured provider.

---

## 📱 Platform

MEMO is primarily designed for:

- Android
- Termux
- Node.js
- WhatsApp
- AI APIs

No dedicated server is required for the basic setup.

---

## 📦 Installation

### 1. Clone the repository

```bash
git clone https://github.com/Kokushibu74/MEMO.git
cd MEMO
```

### 2. Install dependencies

```npm install```

### 3. Configure your AI providers

Start MEMO and configure your API providers locally.

```bash
node memo.js
```

> API credentials should remain on your device and should **never** be committed to GitHub.

---

## ⚙️ MEMO Menu

The project includes a menu-driven interface for managing MEMO.

```text
╔════════════════════════════╗
║          M E M O           ║
║    WhatsApp AI Assistant   ║
╚════════════════════════════╝

1. Start MEMO
2. Add / Remove AI Brain
3. Recent Chat History
4. Change Theme
5. Reset MEMO
6. About MEMO
```

---

## 🔑 AI Provider Configuration

MEMO supports multiple AI providers.

Configure only the providers you want to use.

```text
Gemini      → AI Provider
ChatGPT     → AI Provider
Claude      → AI Provider
Grok        → AI Provider
DeepSeek    → AI Provider
Groq        → AI Provider
Ollama      → Local fallback / optional
```

### 🔐 Security

**Never upload or commit:**

- API keys
- WhatsApp session files
- Personal credentials
- Private configuration
- Local secrets

Keep sensitive configuration files local and protected with `.gitignore`.

---

## 💬 Language Support

MEMO is optimized for natural conversations in:

- 🇧🇩 Bangla
- 💬 Banglish
- 🇬🇧 English

It also supports conversational context such as follow-up questions and common typing mistakes.

---

## 🧠 Conversation Memory

MEMO can maintain conversational context so that follow-up messages feel more natural.

Example:

```text
You: Amar naam Shihab.

MEMO: Nice to meet you, Shihab!

You: Amar naam ki?

MEMO: Tomar naam Shihab.
```

---

## 🏗️ Project Structure

```text
MEMO/
├── config/
├── providers/
├── whisper.cpp/
├── memo.js
├── memo_engine.js
├── memo_router.js
├── memo_ui.js
├── memo_menu.js
├── memo_login.js
├── whatsapp.js
├── voice_brain.js
├── memo_watchdog.sh
├── start-memo.sh
├── package.json
├── package-lock.json
├── requirements.txt
└── README.md
```

---

## 🛠️ Tech Stack

- **Node.js**
- **Termux**
- **WhatsApp**
- **Baileys**
- **Google Gemini**
- **OpenAI**
- **Claude**
- **Grok**
- **DeepSeek**
- **Groq**
- **Ollama**
- **Local JSON configuration**
- **Conversation memory**

---

## 🔄 Architecture

```text
              ┌──────────────┐
              │   WhatsApp   │
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │     MEMO     │
              │    Router    │
              └──────┬───────┘
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
       Gemini     ChatGPT     Claude
          │          │          │
          └──────────┼──────────┘
                     ▼
              Fallback System
                     │
                     ▼
              Memory / Reply
                     │
                     ▼
                 WhatsApp
```

---

## 🎯 Project Goals

MEMO is being developed as a personal AI automation system with the goal of creating a flexible assistant that can:

- Understand natural conversations
- Respond automatically on WhatsApp
- Remember conversation context
- Use multiple AI models
- Recover automatically when an AI provider fails
- Run locally on Android
- Support Bangla and Banglish naturally

---

## 👨‍💻 Creator

**Shihab**

Built with ❤️ for personal AI automation, WhatsApp integration, and multi-model experimentation.

---

## 📌 Project Status

**Active Development 🚧**

MEMO is continuously evolving with new AI providers, better conversation handling, improved fallback logic, UI improvements, and automation features.

---

## ⭐ Support the Project

If you find MEMO useful:

⭐ **Star the repository**

🍴 **Fork it**

🐛 **Report issues**

💡 **Suggest improvements**

---

## 💖 Support MEMO

If you find MEMO useful and want to support its development, you can donate USDT.

### 🪙 Donate with USDT

**Network:** TRON (TRC20)

**Wallet Address:**



> ⚠️ **Important:** Send **USDT only via the TRON (TRC20) network.**

Thank you for supporting MEMO ❤️

---

## 💖 Support MEMO

If you find MEMO useful and want to support its development, you can support the project with a USDT donation.

### 🪙 Donate with USDT

**Network:** TRON (TRC20)

**Wallet Address:**



> ⚠️ **Important:** Send USDT only via the **TRON (TRC20)** network.

Thank you for supporting MEMO ❤️

---

## 📄 License

This project is intended primarily for **personal and educational use**.

---

<div align=center>

### 🤖 MEMO
**Your WhatsApp. Your AI. Your Assistant.**

Made with ❤️ by **Shihab**

</div>
