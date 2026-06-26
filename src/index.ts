#!/usr/bin/env node
/**
 * SendAPI MCP server — stdio transport.
 *
 * Exposes SendAPI's multichannel messaging (WhatsApp, SMS, OTP, email) as MCP
 * tools so AI agents (Claude, ChatGPT/Codex, Cursor, Windsurf, Cline) can send
 * messages and check status through one REST API.
 *
 * Auth: set SENDAPI_API_KEY in the environment.
 * Base URL override: SENDAPI_BASE_URL (defaults to https://sendapi.co/v1).
 *
 * For the hosted multi-tenant transport, see http.ts.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SendAPIClient } from "./client.js";
import { createSendAPIServer } from "./server.js";

const apiKey = process.env.SENDAPI_API_KEY;
if (!apiKey) {
  console.error(
    "SendAPI MCP: SENDAPI_API_KEY is not set. Create a key in your SendAPI dashboard " +
      "(https://sendapi.co) and add it to the server's environment.",
  );
  process.exit(1);
}

const client = new SendAPIClient({ apiKey, baseUrl: process.env.SENDAPI_BASE_URL });
const server = createSendAPIServer(client);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SendAPI MCP server running on stdio.");
}

main().catch((err) => {
  console.error("SendAPI MCP server failed to start:", err);
  process.exit(1);
});
