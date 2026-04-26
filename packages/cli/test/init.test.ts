import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { init } from "../src/commands/init.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

async function makeProject(pkg: Record<string, unknown>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "adux-init-"));
  tempDirs.push(dir);
  await fs.writeFile(path.join(dir, "package.json"), JSON.stringify(pkg), "utf8");
  return dir;
}

describe("adux init", () => {
  it("detects antd from dependencies and emits antd ruleset", async () => {
    const dir = await makeProject({
      name: "demo",
      dependencies: { antd: "^5.10.0" },
    });

    const result = await init(dir, { dryRun: true, yes: true });

    expect(result.written).toBe(false);
    expect(result.config.designSystem?.name).toBe("antd");
    expect(result.config.designSystem?.version).toBe("5");
    expect(result.config.designSystem?.adapter).toBe("@adux/adapter-antd");
    expect(result.config.designSystem?.skill).toBe("adux-antd");
    expect(result.config.rules).toMatchObject({
      "require-antd-component": "error",
    });
  });

  it("detects arco from dependencies", async () => {
    const dir = await makeProject({
      dependencies: { "@arco-design/web-react": "^2.50.0" },
    });

    const result = await init(dir, { dryRun: true, yes: true });

    expect(result.config.designSystem?.name).toBe("arco");
    expect(result.config.designSystem?.adapter).toBe("@adux/adapter-arco");
  });

  it("detects semi from dependencies", async () => {
    const dir = await makeProject({
      dependencies: { "@douyinfe/semi-ui": "^2.40.0" },
    });

    const result = await init(dir, { dryRun: true, yes: true });

    expect(result.config.designSystem?.name).toBe("semi");
    expect(result.config.designSystem?.adapter).toBe("@adux/adapter-semi");
  });

  it("falls back to custom design system and limits ruleset to neutral rules (F7)", async () => {
    const dir = await makeProject({ name: "no-ui-lib" });

    const result = await init(dir, { dryRun: true, yes: true });

    expect(result.config.designSystem?.name).toBe("custom");
    // Non-antd projects must NOT preselect antd-specific rules.
    expect(result.config.rules).not.toHaveProperty("require-antd-component");
    // design-token-only is design-system-agnostic and stays on as the default neutral rule.
    expect(result.config.rules).toHaveProperty("design-token-only");
  });

  it("dry-run does not write adux.config.cjs", async () => {
    const dir = await makeProject({ dependencies: { antd: "^5.0.0" } });
    const expectedConfig = path.join(dir, "adux.config.cjs");

    const result = await init(dir, { dryRun: true, yes: true });

    expect(result.written).toBe(false);
    await expect(fs.stat(expectedConfig)).rejects.toThrow();
    expect(result.output).toContain("ADUX detected:");
    expect(result.output).toContain("Dry run");
  });

  it("yes flag writes config without prompting", async () => {
    const dir = await makeProject({ dependencies: { antd: "^5.0.0" } });
    const expectedConfig = path.join(dir, "adux.config.cjs");

    const result = await init(dir, { yes: true });

    expect(result.written).toBe(true);
    expect(result.path).toBe(expectedConfig);
    const written = await fs.readFile(expectedConfig, "utf8");
    expect(written).toContain("module.exports =");
    expect(written).toContain('"name": "antd"');
  });

  it("declines to overwrite an existing adux.config.cjs without --force", async () => {
    const dir = await makeProject({ dependencies: { antd: "^5.0.0" } });
    const existing = path.join(dir, "adux.config.cjs");
    await fs.writeFile(existing, "module.exports = { rules: {} };", "utf8");

    const result = await init(dir, { yes: true });

    expect(result.written).toBe(false);
    expect(result.output).toMatch(/already exists/);
    const after = await fs.readFile(existing, "utf8");
    expect(after).toBe("module.exports = { rules: {} };");
  });

  it("configFromDetection produces v0.0.2 schema shape", async () => {
    const dir = await makeProject({ dependencies: { antd: "^5.0.0" } });

    const { config } = await init(dir, { dryRun: true, yes: true });

    expect(config.meta?.schemaVersion).toBe(1);
    expect(config.target?.mode).toBe("repo");
    expect(config.target?.root).toBe(".");
    expect(config.target?.exclude).toEqual(
      expect.arrayContaining(["**/node_modules/**", "**/dist/**"]),
    );
    expect(config.runtime?.openEditor).toBe(true);
    expect(config.reports?.views).toEqual(["designer", "frontend", "developer"]);
    expect(config.reports?.outDir).toBe("adux-report");
  });
});
