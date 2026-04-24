import { describe, expect, it, vi, beforeEach } from "vitest";
import { McpError } from "../src/mcp/types.js";
import { createMcpClient } from "../src/mcp/client.js";

// ── Mock SDK ───────────────────────────────────────────────────
// vi.mock is hoisted above imports.  All referenced values must
// either be hoisted too or captured as let bindings (closures
// evaluate at call-time).

const hoisted = vi.hoisted(() => ({
  clientCallTool: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  clientListTools: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  clientClose: vi.fn<() => Promise<void>>(),
}));

// Deferred resolve/reject hooks — assigned in beforeEach, activated
// inside the mock class methods at call time.
let transportStartResolve: (v: void) => void;
let transportStartReject: (e: Error) => void;
let clientConnectResolve: (v: void) => void;
let clientConnectReject: (e: Error) => void;

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => {
  return {
    Client: class MockClient {
      connect() {
        return new Promise<void>((resolve, reject) => {
          clientConnectResolve = resolve;
          clientConnectReject = reject;
        });
      }
      callTool = hoisted.clientCallTool;
      listTools = hoisted.clientListTools;
      close = hoisted.clientClose;
      getServerVersion() {
        return { name: "antd", version: "5.4.0" };
      }
    },
  };
});

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => {
  return {
    StdioClientTransport: class MockStdioClientTransport {
      constructor(_opts: unknown) {
        /* noop */
      }
      start() {
        return new Promise<void>((resolve, reject) => {
          transportStartResolve = resolve;
          transportStartReject = reject;
        });
      }
      close() {
        return Promise.resolve();
      }
    },
  };
});

// ── helpers ────────────────────────────────────────────────────

function newClient(opts?: Parameters<typeof createMcpClient>[0]) {
  return createMcpClient(opts);
}

async function connectClient(
  c: ReturnType<typeof newClient>,
  _opts?: { version?: string },
) {
  const p = c.connect();
  // transport.start() resolves → .then(() => client.connect()) runs
  // as a microtask.  Flush microtasks so client.connect() is called
  // and the deferred resolver is captured before we resolve it.
  transportStartResolve();
  await new Promise((r) => setTimeout(r, 0));
  clientConnectResolve();
  hoisted.clientListTools.mockResolvedValueOnce({ tools: [] });
  await p;
}

// ── tests ──────────────────────────────────────────────────────

describe("mcp-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transportStartResolve = () => {};
    transportStartReject = () => {};
    clientConnectResolve = () => {};
    clientConnectReject = () => {};
  });

  // ── 1. connect() sets isReady=true and antdVersion ──────────

  describe("connect()", () => {
    it("sets isReady=true and antdVersion non-empty after connect()", async () => {
      const c = newClient({ connectTimeoutMs: 5000 });
      expect(c.isReady).toBe(false);
      expect(c.antdVersion).toBe("");

      await connectClient(c);

      expect(c.isReady).toBe(true);
      expect(c.antdVersion).toBe("5.4.0");
    });

    it("is idempotent (calling connect twice is safe)", async () => {
      const c = newClient({ connectTimeoutMs: 5000 });
      await connectClient(c);

      // second connect should return immediately
      await c.connect();
      expect(c.isReady).toBe(true);
    });
  });

  // ── 2. callTool returns usable result ───────────────────────

  describe("callTool()", () => {
    it("returns parsed object for antd_info Table", async () => {
      const c = newClient({ connectTimeoutMs: 5000 });
      await connectClient(c);

      const expected = { component: "Table", props: [{ name: "columns" }] };
      hoisted.clientCallTool.mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify(expected) }],
      });

      const result = await c.callTool("antd_info", { component: "Table" });
      expect(result).toEqual(expected);
      expect(hoisted.clientCallTool).toHaveBeenCalledWith({
        name: "antd_info",
        arguments: { component: "Table" },
      });
    });
  });

  // ── 3. cache hit ────────────────────────────────────────────

  describe("cache", () => {
    it("returns cached result on second call with same input", async () => {
      const c = newClient({ cacheSize: 500, connectTimeoutMs: 5000 });
      await connectClient(c);

      const payload = { component: "Button" };
      hoisted.clientCallTool.mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify(payload) }],
      });

      // First call — hits the SDK
      await c.callTool("antd_info", { component: "Button" });
      expect(hoisted.clientCallTool).toHaveBeenCalledTimes(1);

      // Second call — must be cache hit, no additional SDK call
      const result2 = await c.callTool("antd_info", { component: "Button" });
      expect(result2).toEqual(payload);
      expect(hoisted.clientCallTool).toHaveBeenCalledTimes(1); // still 1
    });

    it("skips cache when cacheSize=0", async () => {
      const c = newClient({ cacheSize: 0, connectTimeoutMs: 5000 });
      await connectClient(c);

      hoisted.clientCallTool.mockResolvedValue({
        content: [{ type: "text", text: '"ok"' }],
      });

      await c.callTool("antd_info", { component: "Table" });
      await c.callTool("antd_info", { component: "Table" });

      expect(hoisted.clientCallTool).toHaveBeenCalledTimes(2);
    });
  });

  // ── 4. timeout ──────────────────────────────────────────────

  describe("timeout", () => {
    it("rejects with TIMEOUT McpError when tool call exceeds callTimeoutMs", async () => {
      const c = newClient({
        callTimeoutMs: 100,
        connectTimeoutMs: 5000,
      });
      await connectClient(c);

      // Make the SDK callTool hang forever
      hoisted.clientCallTool.mockImplementation(
        () =>
          new Promise(() => {
            /* never resolves */
          }),
      );

      try {
        await c.callTool("antd_info", { component: "Slow" });
        expect.fail("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(McpError);
        expect((e as McpError).code).toBe("TIMEOUT");
      }
    });
  });

  // ── 5. disconnect() idempotent ──────────────────────────────

  describe("disconnect()", () => {
    it("is idempotent (calling disconnect twice does not throw)", async () => {
      const c = newClient({ connectTimeoutMs: 5000 });
      await connectClient(c);

      await c.disconnect();
      expect(c.isReady).toBe(false);

      // second call must not throw
      await c.disconnect();
      expect(c.isReady).toBe(false);
    });

    it("sets isReady=false after disconnect", async () => {
      const c = newClient({ connectTimeoutMs: 5000 });
      await connectClient(c);
      expect(c.isReady).toBe(true);

      await c.disconnect();
      expect(c.isReady).toBe(false);
      expect(c.antdVersion).toBe("");
    });
  });

  // ── 6. ENOENT ────────────────────────────────────────────────

  describe("ENOENT", () => {
    it("rejects with ENOENT McpError when command does not exist", async () => {
      const c = newClient({
        command: "/no/such/binary",
        connectTimeoutMs: 5000,
      });

      const p = c.connect();
      // Simulate ENOENT from spawn
      const enoent: NodeJS.ErrnoException = new Error(
        "spawn /no/such/binary ENOENT",
      );
      enoent.code = "ENOENT";
      transportStartReject(enoent);

      try {
        await p;
        expect.fail("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(McpError);
        expect((e as McpError).code).toBe("ENOENT");
        expect((e as McpError).message).toContain("ENOENT");
      }

      expect(c.isReady).toBe(false);
    });
  });

  // ── 7. DISCONNECTED / TOOL_ERROR ─────────────────────────────

  describe("errors", () => {
    it("throws DISCONNECTED when callTool invoked before connect", async () => {
      const c = newClient();
      await expect(
        c.callTool("antd_info", { component: "Table" }),
      ).rejects.toThrow(McpError);

      try {
        await c.callTool("antd_info", { component: "Table" });
        expect.fail("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(McpError);
        expect((e as McpError).code).toBe("DISCONNECTED");
      }
    });

    it("throws DISCONNECTED when listTools invoked before connect", async () => {
      const c = newClient();
      await expect(c.listTools()).rejects.toThrow(McpError);
      try {
        await c.listTools();
        expect.fail("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(McpError);
        expect((e as McpError).code).toBe("DISCONNECTED");
      }
    });

    it("throws TOOL_ERROR when server returns isError", async () => {
      const c = newClient({ connectTimeoutMs: 5000 });
      await connectClient(c);

      hoisted.clientCallTool.mockResolvedValueOnce({
        content: [{ type: "text", text: "something went wrong" }],
        isError: true,
      });

      try {
        await c.callTool("antd_info", { component: "Bogus" });
        expect.fail("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(McpError);
        expect((e as McpError).code).toBe("TOOL_ERROR");
      }
    });
  });

  // ── 8. listTools returns tool definitions ────────────────────

  describe("listTools()", () => {
    it("returns tool list after connect", async () => {
      const c = newClient({ connectTimeoutMs: 5000 });
      await connectClient(c);

      hoisted.clientListTools.mockResolvedValueOnce({
        tools: [
          { name: "antd_info", description: "Get component info" },
          { name: "antd_list", description: "List all components" },
        ],
      });

      const tools = await c.listTools();
      expect(tools).toHaveLength(2);
      expect(tools[0]!.name).toBe("antd_info");
      expect(tools[1]!.name).toBe("antd_list");
    });
  });
});
