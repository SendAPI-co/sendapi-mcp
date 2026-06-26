/**
 * Thin HTTP client for the SendAPI REST API (/v1).
 * The MCP server is a stateless adapter: every tool call maps to one REST call,
 * authenticated with the user's SendAPI API key (Bearer token).
 */

const DEFAULT_BASE_URL = "https://sendapi.co/v1";

export class SendAPIError extends Error {
  status: number;
  code?: string;
  response?: unknown;

  constructor(message: string, status: number, code?: string, response?: unknown) {
    super(message);
    this.name = "SendAPIError";
    this.status = status;
    this.code = code;
    this.response = response;
  }
}

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
}

type Query = Record<string, string | number | boolean | undefined | null>;

export class SendAPIClient {
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(options: ClientOptions) {
    if (!options.apiKey) throw new Error("SendAPI: API key is required");
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  async get(path: string, query?: Query): Promise<unknown> {
    return this.request("GET", path + this.buildQuery(query));
  }

  async post(path: string, body?: unknown): Promise<unknown> {
    return this.request("POST", path, body);
  }

  private buildQuery(query?: Query): string {
    if (!query) return "";
    const parts = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    return parts.length ? `?${parts.join("&")}` : "";
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "sendapi-mcp/1.0.0",
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body && method !== "GET" ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      const data = text ? safeJson(text) : {};

      if (!response.ok) {
        const err = (data as any)?.error ?? {};
        throw new SendAPIError(
          err.message || `HTTP ${response.status}`,
          response.status,
          err.code || err.type,
          data,
        );
      }

      // SendAPI wraps successful payloads in { data: ... }
      return (data as any)?.data ?? data;
    } catch (err) {
      if (err instanceof SendAPIError) throw err;
      if ((err as Error).name === "AbortError") {
        throw new SendAPIError("Request timed out", 0, "timeout");
      }
      throw new SendAPIError((err as Error).message || "Network error", 0, "network_error");
    } finally {
      clearTimeout(timer);
    }
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
