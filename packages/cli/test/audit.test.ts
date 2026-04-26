import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { audit } from "../src/commands/audit.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

const ANTD_CONFIG = `module.exports = {
  meta: { schemaVersion: 1, projectName: "fixture" },
  designSystem: { name: "antd", version: "5", adapter: "@adux/adapter-antd" },
  target: { mode: "repo", root: ".", include: ["src/**/*.{ts,tsx}"], exclude: [] },
  runtime: { enabled: false },
  reports: { outDir: "adux-report", views: ["designer", "frontend", "developer"] },
  rules: { "require-antd-component": "error" },
};
`;

async function makeProject({
  withConfig = false,
  withSource = true,
}: {
  withConfig?: boolean;
  withSource?: boolean;
} = {}): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "adux-audit-"));
  tempDirs.push(dir);
  await fs.writeFile(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "fixture", dependencies: { antd: "^5.0.0" } }),
    "utf8",
  );
  if (withConfig) {
    await fs.writeFile(path.join(dir, "adux.config.cjs"), ANTD_CONFIG, "utf8");
  }
  if (withSource) {
    await fs.mkdir(path.join(dir, "src"), { recursive: true });
    await fs.writeFile(
      path.join(dir, "src", "App.tsx"),
      "export default function App() { return <button>Save</button>; }\n",
      "utf8",
    );
  }
  return dir;
}

describe("adux audit", () => {
  it("no config + --yes: creates config, generates report, exitCode reflects errors", async () => {
    const dir = await makeProject({ withConfig: false });

    const result = await audit(dir, { yes: true });

    expect(result.initialized).toBe(true);
    expect(result.configPath).toBe(path.join(dir, "adux.config.cjs"));
    // require-antd-component fires on raw <button>, so exit 1.
    expect(result.exitCode).toBe(1);

    // config persisted
    await expect(
      fs.stat(path.join(dir, "adux.config.cjs")),
    ).resolves.toBeTruthy();

    // report artifacts produced
    const outDir = result.outDir!;
    await expect(fs.stat(path.join(outDir, "issues.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(outDir, "index.html"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(outDir, "frontend.md"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(outDir, "developer.md"))).resolves.toBeTruthy();
  });

  it("existing config: skips init, uses existing config, generates report", async () => {
    const dir = await makeProject({ withConfig: true });
    const configMtimeBefore = (await fs.stat(path.join(dir, "adux.config.cjs"))).mtimeMs;

    const result = await audit(dir, { yes: true });

    expect(result.initialized).toBe(false);
    expect(result.configPath).toBe(path.join(dir, "adux.config.cjs"));

    // config file untouched
    const configMtimeAfter = (await fs.stat(path.join(dir, "adux.config.cjs"))).mtimeMs;
    expect(configMtimeAfter).toBe(configMtimeBefore);

    // report still generated
    await expect(fs.stat(path.join(result.outDir!, "issues.json"))).resolves.toBeTruthy();
  });

  it("--out-dir overrides config.reports.outDir", async () => {
    const dir = await makeProject({ withConfig: true });
    const customOut = path.join(dir, "custom-report");

    const result = await audit(dir, { yes: true, outDir: customOut });

    expect(result.outDir).toBe(customOut);
    await expect(fs.stat(path.join(customOut, "issues.json"))).resolves.toBeTruthy();
    // default adux-report should NOT be created
    await expect(fs.stat(path.join(dir, "adux-report"))).rejects.toThrow();
  });

  it("terminal guide includes role-aware pointers and next-time hint", async () => {
    const dir = await makeProject({ withConfig: false });

    const result = await audit(dir, { yes: true });

    expect(result.output).toContain("ADUX audit 完成");
    expect(result.output).toContain(`项目：${dir}`);
    expect(result.output).toContain(`配置：已创建 ${path.join(dir, "adux.config.cjs")}`);
    expect(result.output).toContain("下一步看这里：");
    expect(result.output).toMatch(/设计师 \/ 产品：打开 .*index\.html/);
    expect(result.output).toMatch(/前端：查看 .*frontend\.md/);
    expect(result.output).toMatch(/开发者：查看 .*developer\.md/);
    expect(result.output).toMatch(/机器可读数据：查看 .*issues\.json/);
    expect(result.output).toMatch(/下次审查：adux audit /);
    expect(result.output).toContain(
      "分步命令仍可使用：adux init / adux review / adux report",
    );
  });

  it("existing config: guide says 使用已有 instead of 已创建", async () => {
    const dir = await makeProject({ withConfig: true });

    const result = await audit(dir, { yes: true });

    expect(result.output).toContain(`配置：使用已有 ${path.join(dir, "adux.config.cjs")}`);
    expect(result.output).not.toContain("配置：已创建");
  });

  it("clean project (no violations): exitCode=0", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "adux-audit-clean-"));
    tempDirs.push(dir);
    await fs.writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "clean", dependencies: { antd: "^5.0.0" } }),
      "utf8",
    );
    await fs.mkdir(path.join(dir, "src"), { recursive: true });
    // No raw HTML, no hard-coded styles -> no violations
    await fs.writeFile(
      path.join(dir, "src", "App.tsx"),
      "export default function App() { return null; }\n",
      "utf8",
    );

    const result = await audit(dir, { yes: true });

    expect(result.exitCode).toBe(0);
    expect(result.initialized).toBe(true);
  });
});
