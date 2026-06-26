#!/usr/bin/env node
/**
 * SendAPI MCP server — hosted streamable-HTTP transport (multi-tenant).
 *
 * Deploy this behind https://sendapi.co/mcp. Unlike the stdio build, there is no
 * server-side API key: each caller supplies their own SendAPI key per request via
 * `Authorization: Bearer sk_live_...` (or the `X-SendAPI-Key` header). That key is
 * used only for the lifetime of the request, so one deployment serves every user.
 *
 * Runs stateless: each POST builds a fresh server + transport, so there is no
 * cross-request session state to leak between tenants.
 *
 * Env: PORT (default 8080), SENDAPI_BASE_URL (default https://sendapi.co/v1).
 */
import express, { type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SendAPIClient } from "./client.js";
import { createSendAPIServer } from "./server.js";

const PORT = Number(process.env.PORT || 8080);
const BASE_URL = process.env.SENDAPI_BASE_URL;

const app = express();
app.use(express.json({ limit: "1mb" }));

// CORS — browser-based MCP connectors (e.g. ChatGPT) need this. We do not use
// session ids in stateless mode, but expose the header for spec-compliant clients.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-SendAPI-Key, Mcp-Session-Id, MCP-Protocol-Version",
  );
  res.header("Access-Control-Expose-Headers", "Mcp-Session-Id");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

function extractKey(req: Request): string | null {
  const auth = req.headers["authorization"];
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim() || null;
  }
  const custom = req.headers["x-sendapi-key"];
  if (typeof custom === "string" && custom.trim()) return custom.trim();
  return null;
}

function rpcError(res: Response, status: number, code: number, message: string) {
  res.status(status).json({ jsonrpc: "2.0", error: { code, message }, id: null });
}

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", transport: "streamable-http" });
});

app.post("/mcp", async (req: Request, res: Response) => {
  const apiKey = extractKey(req);
  if (!apiKey) {
    rpcError(
      res,
      401,
      -32001,
      "Missing SendAPI API key. Send 'Authorization: Bearer sk_live_...' (or the X-SendAPI-Key header).",
    );
    return;
  }

  const client = new SendAPIClient({ apiKey, baseUrl: BASE_URL });
  const server = createSendAPIServer(client);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP request error:", err);
    if (!res.headersSent) rpcError(res, 500, -32603, "Internal server error");
  }
});

// Stateless mode: no server-initiated streams or session teardown.
const methodNotAllowed = (_req: Request, res: Response) =>
  rpcError(res, 405, -32000, "Method not allowed. This endpoint accepts POST.");
app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

app.listen(PORT, () => {
  console.error(`SendAPI MCP HTTP server listening on :${PORT} (POST /mcp)`);
});
