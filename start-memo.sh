#!/data/data/com.termux/files/usr/bin/bash

cd ""

echo "======================================"
echo "           STARTING MEMO v1.3"
echo "======================================"

if command -v ollama >/dev/null 2>&1; then
    if ! curl -s http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
        echo "[!] Ollama is not running."
        echo "[i] Gemini can still work."
        echo "[i] Ollama fallback will work after ollama serve."
    fi
else
    echo "[!] Ollama command not found."
    echo "[i] Gemini mode can still work."
fi

node memo.js
