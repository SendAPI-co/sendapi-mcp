# Connecting SendAPI to AI tools

There are two ways to connect:

1. **Local (stdio)** — every MCP client below uses the same three things: a command
   (`npx`), args (`-y @sendapi/mcp-server`), and a `SENDAPI_API_KEY` env var.
2. **Hosted (remote)** — no install. Point the client at `https://sendapi.co/mcp`
   and authenticate with `Authorization: Bearer sk_live_...`. See
   [Remote connectors](#remote-connectors).

Create your key at https://sendapi.co.

> App builders that generate code (Lovable, v0, Bolt) don't run MCP servers — they write
> code that calls the SendAPI REST API. See [App builders](#app-builders) below.

---

## Remote connectors

For clients that support connecting to a hosted MCP server by URL (no local install):

- **URL:** `https://sendapi.co/mcp`
- **Auth:** Bearer token — your SendAPI API key.

**Claude (Settings → Connectors → Add custom connector):** paste the URL. When prompted
for a token/header, use your API key as the Bearer token.

**ChatGPT (custom connector / Deep Research connectors):** add the same URL with Bearer
auth. (For custom GPT *Actions* you can alternatively import the OpenAPI spec — see Codex.)

**n8n (MCP Client Tool node):** set the SSE/HTTP endpoint to `https://sendapi.co/mcp`
and add an `Authorization: Bearer sk_live_...` header. This is the cleanest n8n path now
that a hosted endpoint exists (the HTTP Request recipe still works too).

---

## Claude (Desktop & Code)

**Claude Code — hosted (works today, no install):**

```bash
claude mcp add --transport http sendapi https://sendapi.co/mcp \
  --header "Authorization: Bearer sk_live_xxxxxxxxxxxx"
```

Verify with `claude mcp list` (or `/mcp` inside Claude Code), then just ask Claude to send
a message. Add `-s user` to make it available in every project.

**Claude Desktop** — edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sendapi": {
      "command": "npx",
      "args": ["-y", "@sendapi/mcp-server"],
      "env": { "SENDAPI_API_KEY": "sk_live_xxxxxxxxxxxx" }
    }
  }
}
```

**Claude Code** — one command:

```bash
claude mcp add sendapi -e SENDAPI_API_KEY=sk_live_xxxxxxxxxxxx -- npx -y @sendapi/mcp-server
```

Or commit a project `.mcp.json` with the same `mcpServers` block as above.

---

## Cursor

Create `.cursor/mcp.json` in the project (or `~/.cursor/mcp.json` for global):

```json
{
  "mcpServers": {
    "sendapi": {
      "command": "npx",
      "args": ["-y", "@sendapi/mcp-server"],
      "env": { "SENDAPI_API_KEY": "sk_live_xxxxxxxxxxxx" }
    }
  }
}
```

Then enable **sendapi** under Settings → MCP. The Composer agent can now call the tools.

---

## Codex (OpenAI)

**Codex CLI** — add to `~/.codex/config.toml`:

```toml
[mcp_servers.sendapi]
command = "npx"
args = ["-y", "@sendapi/mcp-server"]
env = { SENDAPI_API_KEY = "sk_live_xxxxxxxxxxxx" }
```

**ChatGPT (custom GPT / Actions)** — ChatGPT consumes an OpenAPI schema rather than a
stdio server. Import [`api/openapi.yaml`](../../api/openapi.yaml) as the Action schema and
set authentication to **API Key → Bearer**. Same for any "connect an API" flow.

---

## Windsurf

Edit `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "sendapi": {
      "command": "npx",
      "args": ["-y", "@sendapi/mcp-server"],
      "env": { "SENDAPI_API_KEY": "sk_live_xxxxxxxxxxxx" }
    }
  }
}
```

---

## Cline (VS Code)

Open Cline → MCP Servers → Configure, and add the same `mcpServers` entry to
`cline_mcp_settings.json`.

---

## Replit

Replit Agent can use MCP servers. In your Repl, add the same `mcpServers` block to the
Agent's MCP configuration and put `SENDAPI_API_KEY` in the Repl **Secrets** (then
reference it from `env`). If you're instead asking Replit Agent to *build an app*, treat
it like an app builder below and point it at the SDK.

---

## App builders

Lovable, v0, Bolt, and Replit's code generation write application code. Give them this
prompt and they'll wire up SendAPI through the REST API or the official Node SDK:

```
Use SendAPI (https://sendapi.co/docs) for messaging.
Auth: send header `Authorization: Bearer ${SENDAPI_API_KEY}` (store the key as a secret).
Base URL: https://sendapi.co/v1

To send an email, POST /email/send with JSON { to, subject, html }.
To send an SMS, POST /sms/send with { to, content }.
To send WhatsApp, POST /whatsapp/send with { session_id, to, content }.
To send an OTP, POST /verify/send with { to, channel } then POST /verify/check with { to, code }.
Responses are wrapped as { "data": ... }; errors as { "error": { "message", "code" } }.
Never hardcode the API key. Read it from an environment variable / secret.
```

Prefer code? Install the SDK and let the builder use it:

```bash
npm install @sendapi/node
```

```js
import SendAPI from '@sendapi/node'
const client = new SendAPI(process.env.SENDAPI_KEY)
await client.email.send({ to: 'user@example.com', subject: 'Hi', html: '<p>Hello</p>' })
```

For the full machine-readable contract, hand any tool [`api/openapi.yaml`](../../api/openapi.yaml).
