# @sendapi/mcp-server

Official [Model Context Protocol](https://modelcontextprotocol.io) server for [SendAPI](https://sendapi.co).

Give any MCP-compatible AI agent (Claude Code, Claude Desktop, ChatGPT/Codex, Cursor, Windsurf, Cline) the ability to **send WhatsApp messages, SMS, OTP codes, and email** through one REST API.

## Quick start

You need a SendAPI API key. Create one in your [dashboard](https://sendapi.co).

The server runs over stdio via `npx`, so there is nothing to install globally.

### Claude Desktop / Claude Code

Add to your MCP config (`claude_desktop_config.json`, or `.mcp.json` in a project):

```json
{
  "mcpServers": {
    "sendapi": {
      "command": "npx",
      "args": ["-y", "@sendapi/mcp-server"],
      "env": {
        "SENDAPI_API_KEY": "sk_live_xxxxxxxxxxxx"
      }
    }
  }
}
```

### Cursor / Windsurf / Cline

Same shape: a stdio server with `command: npx`, `args: ["-y", "@sendapi/mcp-server"]`, and `SENDAPI_API_KEY` in `env`.

## Two ways to run it

| Mode | Transport | Best for |
|---|---|---|
| **Local** (`npx`, above) | stdio | Coding agents on your machine (Claude Code, Cursor, Windsurf, Cline, Codex CLI). |
| **Hosted** (`sendapi.co/mcp`) | streamable HTTP | One-click connectors with no install (Claude/ChatGPT remote connectors, n8n MCP Client node). |

### Hosted (remote) server

No install. Point your client at the remote URL and authenticate with your API key:

- **URL:** `https://sendapi.co/mcp`
- **Auth:** `Authorization: Bearer sk_live_xxxxxxxxxxxx` (or the `X-SendAPI-Key` header)

The hosted server is multi-tenant and stateless: your key is used only for the lifetime
of each request and never stored server-side. Self-host it yourself with the included
[`Dockerfile`](./Dockerfile) (`docker build -t sendapi-mcp . && docker run -p 8080:8080 sendapi-mcp`),
then connect to `http://localhost:8080/mcp`.

## Configuration

| Env var | Required | Default | Used by | Notes |
|---|---|---|---|---|
| `SENDAPI_API_KEY` | stdio only | — | stdio | Your SendAPI API key (Bearer token). |
| `SENDAPI_BASE_URL` | no | `https://sendapi.co/v1` | both | Override for self-hosted or staging. |
| `PORT` | no | `8080` | hosted | Port the HTTP server listens on. |

## Tools

**Messaging**
- `send_whatsapp` — send a WhatsApp message from a connected session
- `send_bulk_whatsapp` — send to many recipients (max 500)
- `send_sms` / `send_bulk_sms`
- `send_email` / `send_bulk_email`

**Verification**
- `send_otp` — send a one-time code (SMS, WhatsApp, or email)
- `check_otp` — verify a code
- `validate_phone` — validate / look up a number

**Status & usage (read-only)**
- `get_email_status`, `get_sms_status`, `get_whatsapp_message`
- `get_usage` — remaining quota across channels

**Setup helpers (read-only)**
- `list_whatsapp_sessions`, `get_whatsapp_session_qr`
- `list_sender_ids`, `list_email_domains`, `list_email_templates`

Auth, billing, API-key, and team-admin endpoints are intentionally **not** exposed to agents.

## Safety

Every send still flows through SendAPI's normal limits and abuse protection. Bulk tools are annotated as high-impact so clients can prompt for confirmation. Errors surface SendAPI's `code`/`message` so the agent can self-correct (for example `sending_limited` or `content_blocked`).

## Development

```bash
npm install
npm run build      # compile TypeScript to dist/
SENDAPI_API_KEY=sk_test_xxx npm start
```

## License

MIT
