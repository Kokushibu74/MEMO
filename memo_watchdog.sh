#!/data/data/com.termux/files/usr/bin/bash

MEMO_DIR="$HOME/memo"
LOG="$MEMO_DIR/memo_watchdog.log"

mkdir -p "$MEMO_DIR"

echo "========================================" >> "$LOG"
echo "MEMO WATCHDOG STARTED: $(date)" >> "$LOG"
echo "========================================" >> "$LOG"

while true
do
    echo "" >> "$LOG"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Memo..." >> "$LOG"

    cd "$MEMO_DIR" || exit 1

    # Ollama থাকলে ব্যবহার করবে, না থাকলে চালু করবে
    if ! curl -s --max-time 3 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Ollama..." >> "$LOG"
        nohup ollama serve >> "$MEMO_DIR/ollama.log" 2>&1 &
        sleep 5
    fi

    # Memo চালাও
    node whatsapp.js >> "$LOG" 2>&1

    EXIT_CODE=$?

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Memo stopped. Exit code: $EXIT_CODE" >> "$LOG"

    # crash/restart-এর মধ্যে একটু বিরতি
    sleep 3

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restarting Memo..." >> "$LOG"
done
