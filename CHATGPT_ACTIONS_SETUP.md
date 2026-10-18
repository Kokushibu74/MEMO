# Connect ChatGPT to MEMO WhatsApp Gateway

## OpenAPI schema
Use this URL in a Custom GPT Action schema import, or copy the YAML from `chatgpt-actions.openapi.yaml`:

https://raw.githubusercontent.com/Kokushibu74/MEMO/main/chatgpt-actions.openapi.yaml

## Authentication
In GPT Builder → Configure → Actions → Authentication:
- Type: API Key
- Auth type: Custom
- Custom header name: `X-MEMO-Token`
- API key value: the existing `MEMO_GATEWAY_TOKEN` value from the Render service environment. Never publish it or put it in the APK/front-end.

## Test
Test `checkMemoGatewayHealth` first, then configure the API key and test `getMemoWhatsAppStatus`.

## Important limitation
This schema exposes the gateway's existing WhatsApp status, pairing, send, acknowledge, and logout endpoints. It does NOT implement remote AI ON/OFF inside the Android APK. That requires additional server endpoints plus APK-side polling/command handling; do not assume the AI toggle works until that separate integration is implemented and tested.

## Safety
Only use pairing, sending, or logout actions when the user explicitly requests them. A successful send API response means WhatsApp accepted the message, not that the recipient received/read it.

## Remote control queue (new)
The OpenAPI schema now exposes `POST /control` with `AI_ON`, `AI_OFF`, `PAUSE_CHAT`, `RESUME_CHAT`, and `SET_MODE`. The gateway queues these commands and the APK integration must poll `GET /commands/next?deviceId=memo-apk`, apply the requested state locally, then call `POST /commands/ack` with `commandId` and `success`.

**Important:** the command queue is currently in memory and may be lost on server restart or free-instance sleep. Adding these server endpoints does not by itself change the APK. Until APK-side polling/handling is added and tested, responses mean only “queued”, not “executed”. Personal ChatGPT Free accounts cannot create new custom GPTs/actions; the schema can be used only where API Actions are available (for example, an eligible existing GPT/workspace).
