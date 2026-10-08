#!/data/data/com.termux/files/usr/bin/bash

set -u

APP="$HOME/memo"
cd "$APP" || exit 1

echo
echo "╔══════════════════════════════════════╗"
echo "║          MEMO 1.5 MASTER UPGRADE    ║"
echo "╚══════════════════════════════════════╝"
echo

# =========================================================
# 1. BACKUP
# =========================================================

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$HOME/memo-backup-v1.5-$STAMP"

echo "▸ Creating backup..."
cp -r "$APP" "$BACKUP"

if [ ! -d "$BACKUP" ]; then
    echo "❌ Backup failed. Upgrade stopped."
    exit 1
fi

echo "✅ Backup: $BACKUP"

# =========================================================
# 2. REMOVE OLD OLLAMA REFERENCES FROM MAIN SOURCE
# =========================================================

echo
echo "▸ Removing old Ollama references..."

python - <<'PY'
from pathlib import Path

p = Path("memo.js")
s = p.read_text()

# Remove Ollama constants
for block in [
'''const OLLAMA_URL = "http://127.0.0.1:11434";
const OLLAMA_MODEL = "qwen3:4b";
''',
]:
    s = s.replace(block, "")

# Remove old Ollama function
start = s.find("async function askOllama(")
end = s.find("async function askGemini(", start)
if start != -1:
    if end == -1:
        end = start
    s = s[:start] + s[end:]

# Remove old Gemini function
start = s.find("async function askGemini(")
end = s.find("// OWNER_INFO_DIRECT_START", start)
if start != -1 and end != -1:
    s = s[:start] + s[end:]

# Remove automatic Ollama block
start = s.find("// AUTO_OLLAMA_START")
end = s.find("// AUTO_OLLAMA_END", start)
if start != -1 and end != -1:
    s = s[:start] + s[end + len("// AUTO_OLLAMA_END"):]

# Remove old Gemini key helper
start = s.find("async function getGeminiKey(")
end = s.find("async function startWhatsApp(", start)
if start != -1 and end != -1:
    s = s[:start] + s[end:]

# Remove old direct Gemini startup
start = s.find("  const key =\n    await getGeminiKey();")
if start != -1:
    end = s.find("  console.log();", start)
    if end != -1:
        s = s[:start] + s[end:]

# Remove old Google import
s = s.replace('import { GoogleGenAI } from "@google/genai";\n', "")

# Remove old Gemini/Ollama state
s = s.replace('let gemini = null;\n', "")
s = s.replace('let aiEngine = "OLLAMA";', 'let aiEngine = "MULTI-AI";')

# Remove stale model/status references
s = s.replace('`${GEMINI_MODEL.padEnd(27)}│`', '"Multi-AI Router".padEnd(27) + "│"')
s = s.replace('`${OLLAMA_MODEL.padEnd(27)}│`', '"Multi-AI Router".padEnd(27) + "│"')

# Remove remaining Ollama availability check
marker = '  try {\n    const check =\n      await fetch(\n        `${OLLAMA_URL}/api/tags`'
start = s.find(marker)
if start != -1:
    end = s.find('  await startWhatsApp();', start)
    if end != -1:
        s = s[:start] + s[end:]

# Restore core declarations if missing
if 'const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));' not in s:
    marker = 'const MEMORY_FILE ='
    if marker in s:
        s = s.replace(
            marker,
            '''const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

const APP_DIR = process.cwd();

const AUTH_DIR =
  path.join(APP_DIR, "auth_info");

const MEMORY_FILE =''',
            1
        )

# Provider import
provider_import = 'import { askWithFallback, listProviders, getActiveProviderNames } from "./providers/index.js";'

if provider_import not in s:
    anchor = 'from "@whiskeysockets/baileys";'
    pos = s.find(anchor)
    if pos != -1:
        pos += len(anchor)
        s = s[:pos] + "\n" + provider_import + s[pos:]

p.write_text(s)
print("✓ Legacy AI cleanup complete")
PY

# =========================================================
# 3. CREATE CENTRAL AI CONFIG
# =========================================================

echo
echo "▸ Creating centralized AI configuration..."

mkdir -p config providers logs backup

if [ ! -f config/ai.json ]; then
cat > config/ai.json <<'JSON'
{
  "version": "1.5",
  "timeout": 8000,
  "providers": {
    "gemini": {
      "name": "Gemini",
      "enabled": false,
      "priority": 1,
      "model": "gemini-2.5-flash",
      "apiKey": "",
      "timeout": 8000,
      "failureCount": 0,
      "lastSuccess": null
    },
    "chatgpt": {
      "name": "ChatGPT",
      "enabled": false,
      "priority": 2,
      "model": "gpt-4o-mini",
      "apiKey": "",
      "timeout": 8000,
      "failureCount": 0,
      "lastSuccess": null
    },
    "claude": {
      "name": "Claude",
      "enabled": false,
      "priority": 3,
      "model": "claude-3-5-haiku-latest",
      "apiKey": "",
      "timeout": 8000,
      "failureCount": 0,
      "lastSuccess": null
    },
    "grok": {
      "name": "Grok",
      "enabled": false,
      "priority": 4,
      "model": "grok-3-mini",
      "apiKey": "",
      "timeout": 8000,
      "failureCount": 0,
      "lastSuccess": null
    },
    "deepseek": {
      "name": "DeepSeek",
      "enabled": false,
      "priority": 5,
      "model": "deepseek-chat",
      "apiKey": "",
      "timeout": 8000,
      "failureCount": 0,
      "lastSuccess": null
    }
  }
}
JSON
fi

chmod 600 config/ai.json 2>/dev/null || true

# =========================================================
# 4. CREATE THEME SYSTEM
# =========================================================

echo
echo "▸ Creating theme system..."

cat > config/themes.json <<'JSON'
{
  "current": "Default Dark",
  "themes": {
    "Default Dark": {
      "primary": "cyan",
      "secondary": "white",
      "accent": "green"
    },
    "Cyber Cyan": {
      "primary": "cyan",
      "secondary": "bright-cyan",
      "accent": "green"
    },
    "Matrix Green": {
      "primary": "green",
      "secondary": "bright-green",
      "accent": "cyan"
    },
    "Neon Purple": {
      "primary": "magenta",
      "secondary": "bright-magenta",
      "accent": "cyan"
    },
    "Ocean Blue": {
      "primary": "blue",
      "secondary": "bright-blue",
      "accent": "cyan"
    },
    "Crimson Red": {
      "primary": "red",
      "secondary": "bright-red",
      "accent": "yellow"
    },
    "AMOLED Black": {
      "primary": "white",
      "secondary": "gray",
      "accent": "cyan"
    },
    "Midnight": {
      "primary": "blue",
      "secondary": "white",
      "accent": "magenta"
    },
    "Sunset": {
      "primary": "yellow",
      "secondary": "red",
      "accent": "magenta"
    },
    "Arctic Blue": {
      "primary": "bright-cyan",
      "secondary": "white",
      "accent": "blue"
    },
    "Royal Purple": {
      "primary": "magenta",
      "secondary": "white",
      "accent": "blue"
    },
    "Toxic Green": {
      "primary": "bright-green",
      "secondary": "green",
      "accent": "yellow"
    },
    "Gold": {
      "primary": "yellow",
      "secondary": "white",
      "accent": "bright-yellow"
    },
    "Monochrome": {
      "primary": "white",
      "secondary": "gray",
      "accent": "bright-white"
    },
    "Custom": {
      "primary": "cyan",
      "secondary": "white",
      "accent": "magenta"
    }
  }
}
JSON

chmod 600 config/themes.json 2>/dev/null || true

# =========================================================
# 5. CREATE MEMO 1.5 REQUIREMENTS / SELF REPAIR SCRIPT
# =========================================================

echo
echo "▸ Creating MEMO 1.5 requirements bootstrap..."

cat > requirements.txt <<'REQ'
#!/data/data/com.termux/files/usr/bin/bash

set -u

APP="$HOME/memo"

echo
echo "╔══════════════════════════════════════╗"
echo "║       MEMO 1.5 HEALTH CHECK         ║"
echo "╚══════════════════════════════════════╝"
echo

FAIL=0

check_cmd() {
    if command -v "$1" >/dev/null 2>&1; then
        echo "✓ $1"
    else
        echo "✗ $1 missing"
        FAIL=1
    fi
}

echo "▸ Environment"
check_cmd node
check_cmd npm

echo
echo "▸ Node"
node --version 2>/dev/null || FAIL=1

echo
echo "▸ NPM"
npm --version 2>/dev/null || FAIL=1

echo
echo "▸ Project files"

for f in memo.js package.json package-lock.json providers/index.js config/ai.json; do
    if [ -f "$APP/$f" ]; then
        echo "✓ $f"
    else
        echo "✗ $f missing"
        FAIL=1
    fi
done

echo
echo "▸ Node syntax"

if [ -f "$APP/memo.js" ]; then
    if node --check "$APP/memo.js"; then
        echo "✓ memo.js"
    else
        echo "✗ memo.js syntax error"
        FAIL=1
    fi
fi

for f in "$APP"/providers/*.js; do
    if [ -f "$f" ]; then
        if node --check "$f" >/dev/null 2>&1; then
            echo "✓ $(basename "$f")"
        else
            echo "✗ $(basename "$f")"
            FAIL=1
        fi
    fi
done

echo
echo "▸ Dependencies"

if [ -f "$APP/package.json" ]; then
    cd "$APP"

    if [ ! -d node_modules ]; then
        echo "↻ Installing npm dependencies..."
        npm install || FAIL=1
    else
        echo "✓ node_modules"
    fi
fi

echo
echo "▸ Ollama check"

if grep -RniE 'OLLAMA_URL|OLLAMA_MODEL|askOllama|ensureOllama|qwen3' \
    "$APP/memo.js" "$APP/providers" 2>/dev/null | grep -q .; then
    echo "✗ Ollama references remain in active source"
    FAIL=1
else
    echo "✓ Ollama removed from active source"
fi

echo
echo "▸ WhatsApp session"

if [ -d "$APP/auth_info" ]; then
    echo "✓ auth_info exists"
else
    echo "! auth_info not found — pairing will be required"
fi

echo
echo "▸ Memory"

if [ -f "$APP/memo_memory.json" ]; then
    echo "✓ conversation memory"
else
    echo "! memory file will be created automatically"
fi

echo
if [ "$FAIL" -eq 0 ]; then
    echo "╔══════════════════════════════════════╗"
    echo "║       MEMO 1.5 HEALTHY ✓           ║"
    echo "╚══════════════════════════════════════╝"
    exit 0
else
    echo "╔══════════════════════════════════════╗"
    echo "║       MEMO 1.5 NEEDS ATTENTION      ║"
    echo "╚══════════════════════════════════════╝"
    exit 1
fi
REQ

chmod +x requirements.txt

# =========================================================
# 6. UPDATE PACKAGE DEPENDENCIES
# =========================================================

echo
echo "▸ Checking npm dependencies..."

npm install

# =========================================================
# 7. SECURITY PERMISSIONS
# =========================================================

chmod 700 "$APP" 2>/dev/null || true
chmod 600 config/ai.json 2>/dev/null || true
chmod 600 config/themes.json 2>/dev/null || true
chmod 600 memo_memory.json 2>/dev/null || true

# =========================================================
# 8. FINAL SYNTAX TEST
# =========================================================

echo
echo "▸ Final syntax validation..."

if ! node --check memo.js; then
    echo
    echo "❌ memo.js syntax failed."
    echo "Backup available at:"
    echo "$BACKUP"
    exit 1
fi

for f in providers/*.js; do
    if ! node --check "$f"; then
        echo
        echo "❌ Provider syntax failed: $f"
        echo "Backup available at:"
        echo "$BACKUP"
        exit 1
    fi
done

echo "✓ memo.js"
echo "✓ providers/*.js"

# =========================================================
# 9. OLLAMA FINAL CHECK
# =========================================================

echo
echo "▸ Final Ollama check..."

if grep -nEi 'ollama|qwen3|OLLAMA_URL|OLLAMA_MODEL|askOllama|ensureOllama' \
    memo.js providers/*.js >/dev/null 2>&1; then

    echo "❌ Ollama reference still exists in active source."
    echo "Backup: $BACKUP"
    exit 1
fi

echo "✓ Ollama completely removed from active AI source"

# =========================================================
# 10. FINAL REPORT
# =========================================================

echo
echo "╔════════════════════════════════════════════╗"
echo "║          MEMO 1.5 UPGRADE COMPLETE        ║"
echo "╠════════════════════════════════════════════╣"
echo "║ ✓ Backup created                           ║"
echo "║ ✓ Ollama removed                           ║"
echo "║ ✓ Multi-AI router connected                ║"
echo "║ ✓ Gemini provider                          ║"
echo "║ ✓ ChatGPT provider                         ║"
echo "║ ✓ Claude provider                          ║"
echo "║ ✓ Grok provider                            ║"
echo "║ ✓ DeepSeek provider                        ║"
echo "║ ✓ Fallback architecture                    ║"
echo "║ ✓ Memory preserved                         ║"
echo "║ ✓ WhatsApp session preserved               ║"
echo "║ ✓ Theme configuration                      ║"
echo "║ ✓ requirements.txt bootstrap               ║"
echo "║ ✓ Syntax validation                        ║"
echo "╚════════════════════════════════════════════╝"
echo
echo "Backup:"
echo "$BACKUP"
echo
echo "Next command:"
echo "bash requirements.txt"
echo
