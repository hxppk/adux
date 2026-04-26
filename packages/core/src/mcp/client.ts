import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { McpTool } from "./types.js";
import { McpError } from "./types.js";
import type {
  McpClient,
  McpClientOptions,
  McpErrorCode,
} from "./types.js";

// ── stable stringify (JSON with sorted object keys) ──────────────

function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(stableStringify).join(",")}]`;
  }
  const rec = obj as Record<string, unknown>;
  const keys = Object.keys(rec).sort();
  const pairs = keys.map(
    (k) => `${JSON.stringify(k)}:${stableStringify(rec[k])}`,
  );
  return `{${pairs.join(",")}}`;
}

// ── LRU cache backed by Map insertion-order ──────────────────────

class LruCache<V> {
  #map = new Map<string, V>();
  #max: number;

  constructor(max: number) {
    this.#max = max;
  }

  get(key: string): V | undefined {
    const v = this.#map.get(key);
    if (v === undefined) return undefined;
    // bump to MRU end
    this.#map.delete(key);
    this.#map.set(key, v);
    return v;
  }

  set(key: string, value: V): void {
    if (this.#map.has(key)) {
      this.#map.delete(key);
    } else if (this.#map.size >= this.#max) {
      // evict LRU (first key in insertion order)
      const lru = this.#map.keys().next().value as string | undefined;
      if (lru !== undefined) this.#map.delete(lru);
    }
    this.#map.set(key, value);
  }

  clear(): void {
    this.#map.clear();
  }
}

// ── helpers ──────────────────────────────────────────────────────

const DEFAULT_COMMAND = "antd";
const DEFAULT_ARGS = ["mcp"];
const DEFAULT_CACHE_SIZE = 500;
const DEFAULT_CONNECT_TIMEOUT = 5000;
const DEFAULT_CALL_TIMEOUT = 10000;
const CLIENT_VERSION = "0.0.4-alpha.0";

function errCode(error: unknown): McpErrorCode {
  if (error instanceof McpError) return error.code;
  // Node.js ENOENT
  const nodeErr = error as NodeJS.ErrnoException;
  if (nodeErr.code === "ENOENT") return "ENOENT";
  return "PROTOCOL";
}

function toMcpError(error: unknown, defaultCode?: McpErrorCode): McpError {
  if (error instanceof McpError) return error;
  const code = defaultCode ?? errCode(error);
  const message =
    error instanceof Error ? error.message : String(error);
  return new McpError({ code, message, cause: error });
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  if (ms <= 0) return promise;
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) =>
      setTimeout(
        () =>
          reject(new McpError({ code: "TIMEOUT", message: label })),
        ms,
      ).unref(),
    ),
  ]);
}

// Convert MCP tool result content → plain object (antd mcp returns JSON text)
function parseToolResult(raw: unknown): unknown {
  const r = raw as {
    content?: Array<{ type: string; text?: string }>;
    structuredContent?: unknown;
    isError?: boolean;
  };

  // Prefer structuredContent (SDK validates outputSchema when it exists)
  if (r.structuredContent !== undefined && r.structuredContent !== null) {
    return r.structuredContent;
  }

  // Fallback: parse text content as JSON
  if (Array.isArray(r.content) && r.content.length > 0) {
    const textParts: string[] = [];
    for (const part of r.content) {
      if (part.type === "text" && part.text) {
        textParts.push(part.text);
      }
    }
    const joined = textParts.join("");
    try {
      return JSON.parse(joined);
    } catch {
      return joined;
    }
  }

  return r;
}

// ── createMcpClient ──────────────────────────────────────────────

export function createMcpClient(opts: McpClientOptions = {}): McpClient {
  const {
    command = DEFAULT_COMMAND,
    args = DEFAULT_ARGS,
    cacheSize = DEFAULT_CACHE_SIZE,
    connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT,
    callTimeoutMs = DEFAULT_CALL_TIMEOUT,
  } = opts;

  // Shared mutable state
  let client: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let antdVer = "";
  let ready = false;
  let closing = false;

  const cache =
    cacheSize > 0 ? new LruCache<unknown>(cacheSize) : null;

  function assertReady(): void {
    if (!ready) {
      throw new McpError({
        code: "DISCONNECTED",
        message: "Client is not connected. Call connect() first.",
      });
    }
  }

  function cacheKey(tool: string, input: Record<string, unknown>): string {
    return `${antdVer}::${tool}::${stableStringify(input)}`;
  }

  const api: McpClient = {
    get antdVersion() {
      return antdVer;
    },
    get isReady() {
      return ready;
    },

    async connect(): Promise<void> {
      if (ready) return;

      transport = new StdioClientTransport({ command, args });
      client = new Client(
        { name: "@adux/core", version: CLIENT_VERSION },
        { capabilities: {} },
      );

      try {
        await withTimeout(
          transport.start().then(() => client!.connect(transport!)),
          connectTimeoutMs,
          `connect() timed out after ${connectTimeoutMs}ms`,
        );
      } catch (error: unknown) {
        // Clean up on failure
        try {
          await transport?.close();
        } catch { /* ignore */ }
        transport = null;
        client = null;
        throw toMcpError(error);
      }

      const sv = client.getServerVersion();
      antdVer = sv?.version ?? "";

      // Verify the server is alive by listing tools
      try {
        await withTimeout(
          client.listTools(),
          connectTimeoutMs,
          `listTools() timed out after ${connectTimeoutMs}ms`,
        );
      } catch (error: unknown) {
        if (antdVer) {
          // listTools is best-effort for connect; if we got a version
          // the handshake succeeded
        } else {
          throw toMcpError(error);
        }
      }

      ready = true;
    },

    async disconnect(): Promise<void> {
      if (closing) return;
      closing = true;

      try {
        await client?.close();
      } catch { /* ignore */ }

      try {
        await transport?.close();
      } catch { /* ignore */ }

      client = null;
      transport = null;
      ready = false;
      antdVer = "";
      cache?.clear();
      closing = false;
    },

    async listTools(): Promise<McpTool[]> {
      assertReady();
      try {
        const result = await withTimeout(
          client!.listTools(),
          callTimeoutMs,
          `listTools() timed out after ${callTimeoutMs}ms`,
        );
        return (result.tools ?? []) as McpTool[];
      } catch (error: unknown) {
        throw toMcpError(error);
      }
    },

    async callTool<T = unknown>(
      tool: string,
      input: Record<string, unknown>,
    ): Promise<T> {
      assertReady();

      if (cache) {
        const key = cacheKey(tool, input);
        const cached = cache.get(key);
        if (cached !== undefined) {
          return cached as T;
        }
      }

      let raw: unknown;
      try {
        raw = await withTimeout(
          client!.callTool({ name: tool, arguments: input }),
          callTimeoutMs,
          `callTool("${tool}") timed out after ${callTimeoutMs}ms`,
        );
      } catch (error: unknown) {
        // Check if the transport died
        if (
          error instanceof Error &&
          (error.message.includes("not connected") ||
            error.message.includes("Connection closed"))
        ) {
          ready = false;
          throw new McpError({
            code: "DISCONNECTED",
            message: error.message,
            cause: error,
          });
        }
        throw toMcpError(error);
      }

      // Check for tool-level error
      const rawObj = raw as { isError?: boolean };
      if (rawObj.isError) {
        throw new McpError({
          code: "TOOL_ERROR",
          message: `Tool "${tool}" returned error`,
          cause: raw,
        });
      }

      const parsed = parseToolResult(raw) as T;

      if (cache) {
        const key = cacheKey(tool, input);
        cache.set(key, parsed);
      }

      return parsed;
    },
  };

  return api;
}
