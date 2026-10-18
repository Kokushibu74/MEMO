# MEMO Control Center (free monitor)

This is a lightweight, mobile-friendly monitor served from the existing MEMO gateway at `/control-center/`.

## Safety
- Read-only: calls only `GET /health` and authenticated `GET /status`.
- Does not pair, logout, send messages, change Render settings, or deploy.
- Gateway token is held only in page memory and is not saved to local storage.
- Does not display phone numbers or message contents.
- ChatGPT conversation sync/automatic task execution is **not** enabled by this monitor. That requires a separately authorized integration; do not put API keys into frontend code.

## Files
- `index.html`: standalone control panel.
