import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseSource } from "../src/ast/parser.js";
import {
  createDefaultRegistry,
  loadAduxConfig,
  type AduxConfig,
} from "../src/config/index.js";
import { runRules } from "../src/lint.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) =>
      fs.rm(dir, { recursive: true, force: true }),
    ),
  );
});

function lint(source: string, config?: AduxConfig) {
  const file = parseSource(source, { filename: "test.tsx" });
  const registry = createDefaultRegistry({ config });
  return runRules(file, registry);
}

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "adux-config-"));
  tempDirs.push(dir);
  return dir;
}

describe("adux config", () => {
  it("can disable a built-in rule", () => {
    const violations = lint(
      `export default function App() { return <button>Save</button>; }`,
      {
        rules: {
          "require-antd-component": "off",
        },
      },
    );

    expect(violations).toHaveLength(0);
  });

  it("can override a built-in rule severity", () => {
    const violations = lint(
      `export default function App() { return <button>Save</button>; }`,
      {
        rules: {
          "require-antd-component": "warn",
        },
      },
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]!.severity).toBe("warn");
  });

  it("loads adux.config.mjs from a parent directory", async () => {
    const root = await makeTempDir();
    const child = path.join(root, "src", "pages");
    await fs.mkdir(child, { recursive: true });
    await fs.writeFile(
      path.join(root, "adux.config.mjs"),
      `export default { rules: { "require-antd-component": "off" } };`,
      "utf8",
    );

    const loaded = await loadAduxConfig({ cwd: child });

    expect(loaded?.path).toBe(path.join(root, "adux.config.mjs"));
    expect(loaded?.config.rules?.["require-antd-component"]).toBe("off");
  });

  it("loads .aduxrc.json", async () => {
    const root = await makeTempDir();
    await fs.writeFile(
      path.join(root, ".aduxrc.json"),
      JSON.stringify({
        rules: {
          "require-antd-component": ["warn"],
        },
      }),
      "utf8",
    );

    const loaded = await loadAduxConfig({ cwd: root });

    expect(loaded?.config.rules?.["require-antd-component"]).toEqual([
      "warn",
    ]);
  });
});
