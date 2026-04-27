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

  it("preserves v0.0.2 onboarding config fields", async () => {
    const root = await makeTempDir();
    await fs.writeFile(
      path.join(root, "adux.config.cjs"),
      `module.exports = {
        meta: { schemaVersion: 1, projectName: "console" },
        designSystem: {
          name: "antd",
          version: "5",
          adapter: "@adux/adapter-antd",
          skill: "adux-antd",
          preset: "recommended",
        },
        target: {
          mode: "repo",
          root: ".",
          include: ["src/**/*.tsx"],
          exclude: ["src/legacy/**"],
          devServer: { command: "pnpm dev", url: "http://127.0.0.1:5173" },
          routes: ["/"],
        },
        runtime: { enabled: true, via: "vite-plugin", openEditor: true },
        reports: {
          outDir: "adux-report",
          views: ["designer", "frontend", "developer"],
          screenshots: false,
        },
        rules: { "require-antd-component": "error" },
      };`,
      "utf8",
    );

    const loaded = await loadAduxConfig({ cwd: root });

    expect(loaded?.config.meta?.projectName).toBe("console");
    expect(loaded?.config.designSystem?.name).toBe("antd");
    expect(loaded?.config.target?.include).toEqual(["src/**/*.tsx"]);
    expect(loaded?.config.target?.devServer?.command).toBe("pnpm dev");
    expect(loaded?.config.runtime?.via).toBe("vite-plugin");
    expect(loaded?.config.reports?.views).toEqual([
      "designer",
      "frontend",
      "developer",
    ]);
    expect(loaded?.config.rules?.["require-antd-component"]).toBe("error");
  });

  it("merges skills array into config.skillRules and tracks skillSources", async () => {
    const root = await makeTempDir();
    await fs.writeFile(
      path.join(root, "team.skill.cjs"),
      `module.exports = {
        name: "team-skill",
        rules: {
          "require-antd-component": {
            severity: "warn",
            description: "Team override description.",
            impact: "Team-specific impact note.",
            fix: "Team-specific fix advice.",
          },
        },
      };`,
      "utf8",
    );
    await fs.writeFile(
      path.join(root, "adux.config.cjs"),
      `module.exports = { skills: ["./team.skill.cjs"] };`,
      "utf8",
    );

    const loaded = await loadAduxConfig({ cwd: root });

    expect(loaded?.config.skills).toEqual(["./team.skill.cjs"]);
    expect(loaded?.config.skillRules?.["require-antd-component"]).toMatchObject({
      severity: "warn",
      description: "Team override description.",
      fix: "Team-specific fix advice.",
    });
    expect(loaded?.config.skillSources).toEqual([
      path.join(root, "team.skill.cjs"),
    ]);
  });

  it("multiple skills: later entry overrides earlier for the same ruleId", async () => {
    const root = await makeTempDir();
    await fs.writeFile(
      path.join(root, "base.skill.cjs"),
      `module.exports = {
        rules: {
          "require-antd-component": { severity: "warn", fix: "base fix" },
        },
      };`,
      "utf8",
    );
    await fs.writeFile(
      path.join(root, "override.skill.cjs"),
      `module.exports = {
        rules: {
          "require-antd-component": { severity: "error", fix: "override fix" },
        },
      };`,
      "utf8",
    );
    await fs.writeFile(
      path.join(root, "adux.config.cjs"),
      `module.exports = { skills: ["./base.skill.cjs", "./override.skill.cjs"] };`,
      "utf8",
    );

    const loaded = await loadAduxConfig({ cwd: root });

    expect(loaded?.config.skillRules?.["require-antd-component"]).toMatchObject({
      severity: "error",
      fix: "override fix",
    });
  });

  it("config.rules wins over skill severity at lint time", () => {
    const violations = lint(
      `export default function App() { return <button>Save</button>; }`,
      {
        skillRules: {
          "require-antd-component": { severity: "warn" },
        },
        rules: {
          "require-antd-component": "error",
        },
      },
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]!.severity).toBe("error");
  });

  it("skill rule severity takes effect when config.rules does not override it", () => {
    const violations = lint(
      `export default function App() { return <button>Save</button>; }`,
      {
        skillRules: {
          "require-antd-component": { severity: "warn" },
        },
      },
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]!.severity).toBe("warn");
  });

  it("turns off antd-only rules for non-antd design systems", () => {
    const violations = lint(
      `export default function App() { return <button style={{ color: "#ff0000" }}>Save</button>; }`,
      {
        designSystem: { name: "custom" },
      },
    );

    expect(violations.map((violation) => violation.ruleId)).toEqual([
      "design-token-only",
    ]);
  });

  it("tracks skill entries and unknown rule ids", async () => {
    const root = await makeTempDir();
    await fs.writeFile(
      path.join(root, "team.skill.cjs"),
      `module.exports = {
        name: "team-skill",
        rules: {
          "unknown-rule": { severity: "warn" },
          "design-token-only": { fix: "team fix" },
        },
      };`,
      "utf8",
    );
    await fs.writeFile(
      path.join(root, "adux.config.cjs"),
      `module.exports = { skills: ["./team.skill.cjs"] };`,
      "utf8",
    );

    const loaded = await loadAduxConfig({ cwd: root });

    expect(loaded?.config.skillEntries?.[0]).toMatchObject({
      path: path.join(root, "team.skill.cjs"),
      name: "team-skill",
      unknownRuleIds: ["unknown-rule"],
    });
  });
});
