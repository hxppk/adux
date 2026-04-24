/**
 * @adux/core — MCP client contract
 *
 * Implements a long-lived stdio connection to `antd mcp` with
 * in-memory LRU caching keyed by (antdVersion, tool, JSON-stable input).
 *
 * See antd-capability-probe.md §2 for the actual tool surface (7 tools).
 */

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: unknown;
}

export interface McpClientOptions {
  /** Command to launch the mcp server. Default: `antd` (resolved via PATH or node_modules). */
  command?: string;

  /** Args passed to the command. Default: `["mcp"]`. */
  args?: string[];

  /** Max LRU cache entries. Default: 500. Set to 0 to disable caching. */
  cacheSize?: number;

  /** Abort connect if initialize handshake takes longer than this (ms). Default: 5000. */
  connectTimeoutMs?: number;

  /** Abort a tool call if it takes longer than this (ms). Default: 10000. */
  callTimeoutMs?: number;
}

export interface McpClient {
  /** Start the antd mcp stdio process and complete the initialize handshake. */
  connect(): Promise<void>;

  /** Terminate the stdio process and release resources. Idempotent. */
  disconnect(): Promise<void>;

  /** List all available MCP tools (antd_list / antd_info / antd_token / etc.). */
  listTools(): Promise<McpTool[]>;

  /**
   * Call a tool with input. Cached by (antdVersion, tool, JSON-stable input).
   * Rejects with `McpError` on timeout, protocol error, or tool error.
   */
  callTool<T = unknown>(tool: string, input: Record<string, unknown>): Promise<T>;

  /** The antd version bound at initialize (from serverInfo.version). */
  readonly antdVersion: string;

  /** Whether the client is connected and ready to serve calls. */
  readonly isReady: boolean;
}

export type McpErrorCode =
  | "ENOENT" /** mcp binary not found */
  | "TIMEOUT"
  | "PROTOCOL" /** unexpected JSON-RPC response */
  | "TOOL_ERROR" /** mcp returned error result */
  | "DISCONNECTED";

export interface McpErrorPayload {
  code: McpErrorCode;
  message: string;
  cause?: unknown;
}

export class McpError extends Error {
  readonly code: McpErrorCode;
  override readonly cause?: unknown;

  constructor(payload: McpErrorPayload) {
    super(payload.message);
    this.name = "McpError";
    this.code = payload.code;
    this.cause = payload.cause;
  }
}
