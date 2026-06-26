/**
 * Shared SendAPI MCP server factory.
 *
 * Builds an McpServer with the full tool catalog, bound to a given SendAPIClient.
 * Both transports reuse this:
 *   - stdio (index.ts)      → one client from SENDAPI_API_KEY
 *   - streamable HTTP (http.ts) → one client per connection, keyed by the caller's API key
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SendAPIClient, SendAPIError } from "./client.js";

/** Run a SendAPI call and shape it into an MCP tool result. */
async function run(fn: () => Promise<unknown>) {
  try {
    const data = await fn();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    };
  } catch (err) {
    const e = err as SendAPIError;
    const detail = e.code ? `${e.code}: ${e.message}` : e.message;
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: `SendAPI request failed (${e.status || "no status"}). ${detail}`,
        },
      ],
    };
  }
}

export function createSendAPIServer(client: SendAPIClient): McpServer {
  const server = new McpServer({ name: "sendapi", version: "1.0.0" });

  // ── Messaging ──────────────────────────────────────────────────────────────

  server.registerTool(
    "send_whatsapp",
    {
      title: "Send WhatsApp message",
      description:
        "Send a WhatsApp message from a connected session to one recipient. " +
        "Requires a session_id of an already-paired WhatsApp number (see list_whatsapp_sessions).",
      inputSchema: {
        session_id: z.number().int().describe("ID of the connected WhatsApp session to send from."),
        to: z.string().describe("Recipient phone number in international format, e.g. +15551234567."),
        content: z.string().describe("Message body. For non-text types this may be a URL or structured payload."),
        type: z
          .enum(["text", "image", "video", "document", "location", "contact"])
          .optional()
          .describe("Message type. Defaults to 'text'."),
      },
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    ({ session_id, to, content, type }) =>
      run(() => client.post("/whatsapp/send", { session_id, to, content, type })),
  );

  server.registerTool(
    "send_bulk_whatsapp",
    {
      title: "Send bulk WhatsApp messages",
      description:
        "Send the same WhatsApp message to many recipients (max 500) from a connected session. " +
        "High-impact: this contacts many people. Confirm the recipient list before calling.",
      inputSchema: {
        session_id: z.number().int().describe("ID of the connected WhatsApp session to send from."),
        recipients: z.array(z.string()).min(1).max(500).describe("Phone numbers in international format."),
        content: z.string().describe("Message body sent to every recipient."),
        type: z
          .enum(["text", "image", "video", "document", "location", "contact"])
          .optional()
          .describe("Message type. Defaults to 'text'."),
      },
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    ({ session_id, recipients, content, type }) =>
      run(() => client.post("/whatsapp/send-bulk", { session_id, recipients, content, type })),
  );

  server.registerTool(
    "send_sms",
    {
      title: "Send SMS",
      description: "Send a single SMS message to a phone number.",
      inputSchema: {
        to: z.string().describe("Recipient phone number in international format, e.g. +15551234567."),
        content: z.string().max(1600).describe("SMS text (up to 1600 characters)."),
        sender_id: z.string().max(11).optional().describe("Approved alphanumeric sender ID (optional)."),
      },
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    ({ to, content, sender_id }) => run(() => client.post("/sms/send", { to, content, sender_id })),
  );

  server.registerTool(
    "send_bulk_sms",
    {
      title: "Send bulk SMS",
      description:
        "Send the same SMS to many recipients (max 500). High-impact: confirm the list before calling.",
      inputSchema: {
        recipients: z.array(z.string()).min(1).max(500).describe("Phone numbers in international format."),
        content: z.string().max(1600).describe("SMS text sent to every recipient."),
        sender_id: z.string().max(11).optional().describe("Approved alphanumeric sender ID (optional)."),
      },
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    ({ recipients, content, sender_id }) =>
      run(() => client.post("/sms/send-bulk", { recipients, content, sender_id })),
  );

  server.registerTool(
    "send_email",
    {
      title: "Send email",
      description:
        "Send a single transactional email. Provide html or text (or a template_id with variables).",
      inputSchema: {
        to: z.string().email().describe("Recipient email address."),
        subject: z.string().max(500).describe("Email subject line."),
        html: z.string().optional().describe("HTML body. Optional if text or template_id is provided."),
        text: z.string().optional().describe("Plain-text body. Optional if html or template_id is provided."),
        from: z.string().optional().describe("Verified sender address, e.g. 'Name <you@yourdomain.com>'."),
        from_name: z.string().optional().describe("Display name for the sender (optional)."),
        template_id: z.union([z.string(), z.number()]).optional().describe("ID of a saved email template."),
        variables: z.record(z.any()).optional().describe("Key-value variables to render into the template."),
      },
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    (args) => run(() => client.post("/email/send", args)),
  );

  server.registerTool(
    "send_bulk_email",
    {
      title: "Send bulk email",
      description:
        "Send the same email to many recipients (max 500). High-impact: confirm the list before calling.",
      inputSchema: {
        recipients: z.array(z.string().email()).min(1).max(500).describe("Recipient email addresses."),
        subject: z.string().max(500).describe("Email subject line."),
        html: z.string().optional().describe("HTML body. Optional if text or template_id is provided."),
        text: z.string().optional().describe("Plain-text body. Optional if html or template_id is provided."),
        from: z.string().optional().describe("Verified sender address."),
        from_name: z.string().optional().describe("Display name for the sender (optional)."),
        template_id: z.union([z.string(), z.number()]).optional().describe("ID of a saved email template."),
      },
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    (args) => run(() => client.post("/email/send-bulk", args)),
  );

  // ── Verification / OTP ───────────────────────────────────────────────────────

  server.registerTool(
    "send_otp",
    {
      title: "Send OTP code",
      description: "Send a one-time password (OTP) to a recipient over SMS, WhatsApp, or email.",
      inputSchema: {
        to: z.string().describe("Recipient phone number or email, depending on channel."),
        channel: z
          .enum(["sms", "whatsapp", "email", "auto"])
          .optional()
          .describe("Delivery channel. Defaults to 'sms'. 'auto' picks based on the recipient."),
        length: z.number().int().min(4).max(8).optional().describe("Code length (4-8). Defaults to 6."),
        ttl: z.number().int().optional().describe("Code lifetime in seconds. Defaults to 300."),
      },
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    ({ to, channel, length, ttl }) =>
      run(() => client.post("/verify/send", { to, channel, length, ttl })),
  );

  server.registerTool(
    "check_otp",
    {
      title: "Verify OTP code",
      description: "Check a one-time password (OTP) the recipient entered against the code that was sent.",
      inputSchema: {
        to: z.string().describe("Recipient the OTP was sent to (phone or email)."),
        code: z.string().max(8).describe("The code the user entered."),
      },
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    ({ to, code }) => run(() => client.post("/verify/check", { to, code })),
  );

  server.registerTool(
    "validate_phone",
    {
      title: "Validate phone number",
      description: "Validate and look up details (format, country, carrier) for a phone number.",
      inputSchema: {
        number: z.string().describe("Phone number to validate, ideally in international format."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    ({ number }) => run(() => client.get("/phone/validate", { number })),
  );

  // ── Status & usage (read-only) ───────────────────────────────────────────────

  server.registerTool(
    "get_email_status",
    {
      title: "Get email status",
      description: "Get delivery status and details for a previously sent email by its ID.",
      inputSchema: { id: z.union([z.string(), z.number()]).describe("Email message ID.") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    ({ id }) => run(() => client.get(`/email/status/${encodeURIComponent(String(id))}`)),
  );

  server.registerTool(
    "get_sms_status",
    {
      title: "Get SMS status",
      description: "Get delivery status and details for a previously sent SMS by its ID.",
      inputSchema: { id: z.union([z.string(), z.number()]).describe("SMS message ID.") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    ({ id }) => run(() => client.get(`/sms/status/${encodeURIComponent(String(id))}`)),
  );

  server.registerTool(
    "get_whatsapp_message",
    {
      title: "Get WhatsApp message",
      description: "Get status and details for a WhatsApp message by its ID.",
      inputSchema: { id: z.union([z.string(), z.number()]).describe("WhatsApp message ID.") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    ({ id }) => run(() => client.get(`/whatsapp/messages/${encodeURIComponent(String(id))}`)),
  );

  server.registerTool(
    "get_usage",
    {
      title: "Get account usage",
      description:
        "Get current account usage and remaining quota across channels. Useful to check limits before sending in bulk.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    () => run(() => client.get("/account/usage")),
  );

  // ── Setup helpers (read-only) ────────────────────────────────────────────────

  server.registerTool(
    "list_whatsapp_sessions",
    {
      title: "List WhatsApp sessions",
      description: "List connected WhatsApp sessions and their status. Use a session's id with send_whatsapp.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    () => run(() => client.get("/whatsapp/sessions")),
  );

  server.registerTool(
    "get_whatsapp_session_qr",
    {
      title: "Get WhatsApp pairing QR",
      description: "Get the QR code payload to pair a WhatsApp session by scanning it in the WhatsApp app.",
      inputSchema: { id: z.union([z.string(), z.number()]).describe("WhatsApp session ID.") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    ({ id }) => run(() => client.get(`/whatsapp/sessions/${encodeURIComponent(String(id))}/qr`)),
  );

  server.registerTool(
    "list_sender_ids",
    {
      title: "List SMS sender IDs",
      description: "List configured SMS sender IDs and their approval status.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    () => run(() => client.get("/sms/sender-ids")),
  );

  server.registerTool(
    "list_email_domains",
    {
      title: "List email domains",
      description: "List sending domains and their verification status.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    () => run(() => client.get("/email/domains")),
  );

  server.registerTool(
    "list_email_templates",
    {
      title: "List email templates",
      description: "List saved email templates that can be used with send_email via template_id.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    () => run(() => client.get("/email/templates")),
  );

  return server;
}
