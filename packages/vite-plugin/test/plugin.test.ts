import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock launch-editor at module level so vitest hoists it.
// The source code uses dynamic import("launch-editor") inside configureServer.
const launchMock = vi.fn();
vi.mock("launch-editor", () => ({ default: launchMock }));

import adux from "../src/index.js";

describe("adux vite plugin", () => {
  it("returns object with name='adux'", () => {
    const plugin = adux();
    expect(plugin.name).toBe("adux");
  });

  it("returns hooks as undefined when disabled=true", () => {
    const plugin = adux({ disabled: true });
    expect(plugin.name).toBe("adux");
    const keys = Object.keys(plugin).filter((k) => k !== "name");
    expect(keys).toHaveLength(0);
  });

  it("transformIndexHtml injects init(...) and the Vite-encoded virtual id", () => {
    const plugin = adux();
    const html = "<html><head></head><body></body></html>";
    const result = (plugin.transformIndexHtml as (html: string) => string)(html);
    expect(result).toContain("init(");
    expect(result).toContain("/@id/__x00__adux-runtime");
    expect(result).toContain("</head>");
    expect(result.indexOf("<script")).toBeLessThan(result.indexOf("</head>"));
  });

  it("resolveId returns non-null for /@id/adux-runtime", () => {
    const plugin = adux();
    const resolved = (plugin.resolveId as (id: string) => string | undefined)(
      "/@id/adux-runtime",
    );
    expect(resolved).toBeTruthy();
    expect(resolved).toBe("\0adux-runtime");
  });

  it("resolveId returns undefined for unknown ids", () => {
    const plugin = adux();
    const resolved = (plugin.resolveId as (id: string) => string | undefined)(
      "/some/other/module",
    );
    expect(resolved).toBeUndefined();
  });

  it("load returns re-export for resolved virtual module id", () => {
    const plugin = adux();
    const code = (plugin.load as (id: string) => string | undefined)(
      "\0adux-runtime",
    );
    expect(code).toBe('export { init } from "@adux/runtime";');
  });

  it("load returns undefined for unknown ids", () => {
    const plugin = adux();
    const code = (plugin.load as (id: string) => string | undefined)("\0other");
    expect(code).toBeUndefined();
  });
});

describe("configureServer open-editor endpoint", () => {
  beforeAll(() => {
    launchMock.mockClear();
  });

  it("calls launch-editor with file:line on POST", async () => {
    const plugin = adux();

    const middlewares: Array<{
      path: string;
      handler: (req: any, res: any, next: () => void) => void;
    }> = [];

    const mockServer = {
      middlewares: {
        use(pathOrHandler: string | (() => void), maybeHandler?: any) {
          if (typeof pathOrHandler === "string" && maybeHandler) {
            middlewares.push({ path: pathOrHandler, handler: maybeHandler });
          }
        },
      },
    };

    await plugin.configureServer!(mockServer as any);

    const editorMw = middlewares.find(
      (m) => m.path === "/__adux/open-editor",
    );
    expect(editorMw).toBeDefined();

    const bodyChunks = [
      JSON.stringify({ file: "/src/App.tsx", line: 42 }),
    ];

    const req = {
      method: "POST",
      on: vi.fn((event: string, cb: (...args: any[]) => void) => {
        if (event === "data") {
          for (const chunk of bodyChunks) cb(chunk);
        }
        if (event === "end") cb();
      }),
    };

    let ended = false;
    const res = {
      statusCode: 200,
      end: vi.fn(() => {
        ended = true;
      }),
    };
    const next = vi.fn();

    editorMw!.handler(req, res, next);

    // Wait for async handler to complete (dynamic import + body parsing)
    await vi.waitFor(
      () => {
        expect(launchMock).toHaveBeenCalledWith("/src/App.tsx:42:1");
      },
      { timeout: 2000 },
    );

    expect(res.statusCode).toBe(200);
  });

  it("skips non-POST requests to open-editor", async () => {
    const plugin = adux();
    const handlers: Array<{
      path: string;
      handler: (req: any, res: any, next: () => void) => void;
    }> = [];

    const mockServer = {
      middlewares: {
        use(pathOrHandler: string | (() => void), maybeHandler?: any) {
          if (typeof pathOrHandler === "string" && maybeHandler) {
            handlers.push({ path: pathOrHandler, handler: maybeHandler });
          }
        },
      },
    };

    await plugin.configureServer!(mockServer as any);
    const editorMw = handlers.find((m) => m.path === "/__adux/open-editor");

    const req = { method: "GET", on: vi.fn() };
    const res = { statusCode: 200, end: vi.fn() };
    const next = vi.fn();

    editorMw!.handler(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.on).not.toHaveBeenCalled();
  });
});
