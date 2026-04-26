import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { report } from "../src/commands/report.js";

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

async function makeProject(sourceFiles: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "adux-report-"));
  tempDirs.push(dir);
  await fs.writeFile(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "fixture", dependencies: { antd: "^5.0.0" } }),
    "utf8",
  );
  await fs.writeFile(path.join(dir, "adux.config.cjs"), ANTD_CONFIG, "utf8");
  await fs.mkdir(path.join(dir, "src"), { recursive: true });
  for (const [rel, body] of Object.entries(sourceFiles)) {
    const full = path.join(dir, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body, "utf8");
  }
  return dir;
}

describe("adux report", () => {
  it("produces issues.json with schemaVersion, breakdown summary, and stable issue ids", async () => {
    const dir = await makeProject({
      "src/App.tsx":
        "export default function App() { return <button>Save</button>; }\n",
    });
    const outDir = path.join(dir, "out");

    const result = await report(dir, { outDir });

    expect(result.exitCode).toBe(1); // error severity present

    const raw = await fs.readFile(path.join(outDir, "issues.json"), "utf8");
    const json = JSON.parse(raw);

    expect(json.schemaVersion).toBe(1);
    expect(json.designSystem?.name).toBe("antd");
    expect(json.configPath).toBe(path.join(dir, "adux.config.cjs"));

    expect(json.summary.filesScanned).toBeGreaterThanOrEqual(1);
    expect(json.summary.totalErrors).toBeGreaterThanOrEqual(1);

    // CountBreakdown shape, not bare number
    expect(json.summary.byRule["require-antd-component"]).toMatchObject({
      total: expect.any(Number),
      error: expect.any(Number),
      warn: expect.any(Number),
    });
    expect(json.summary.byFile).toBeDefined();
    expect(json.summary.byCategory.component).toMatchObject({ total: expect.any(Number) });

    expect(Array.isArray(json.issues)).toBe(true);
    const issue = json.issues[0];
    expect(issue.origin).toBe("static");
    expect(issue.id).toBe(
      `static:${issue.file}:${issue.line}:${issue.column}:${issue.ruleId}`,
    );
    expect(issue.rule).toMatchObject({
      id: issue.ruleId,
      category: "component",
      description: expect.any(String),
      impact: expect.any(String),
      fix: expect.any(String),
    });
    expect(issue.location).toMatchObject({
      file: issue.file,
      line: issue.line,
      column: issue.column,
    });
  });

  it("renders designer HTML with truncation banner when issues > 100", async () => {
    const buttons = Array.from({ length: 101 }, () => "<button>x</button>").join(
      "",
    );
    const dir = await makeProject({
      "src/App.tsx": `export default function App() { return <>${buttons}</>; }\n`,
    });
    const outDir = path.join(dir, "out");

    await report(dir, { outDir });

    const html = await fs.readFile(path.join(outDir, "index.html"), "utf8");
    expect(html).toContain("ADUX 设计师 / 产品报告");
    expect(html).toMatch(/仅显示前 100 条 \/ 共 10\d 条问题/);
    expect(html).toContain("frontend.md");
  });

  it("does NOT render truncation banner when issues <= 100", async () => {
    const dir = await makeProject({
      "src/App.tsx":
        "export default function App() { return <button>Save</button>; }\n",
    });
    const outDir = path.join(dir, "out");

    await report(dir, { outDir });

    const html = await fs.readFile(path.join(outDir, "index.html"), "utf8");
    expect(html).not.toContain("仅显示前");
  });

  it("renders frontend.md with IDE-jump location format and suggested fix", async () => {
    const dir = await makeProject({
      "src/App.tsx":
        "export default function App() { return <button>Save</button>; }\n",
    });
    const outDir = path.join(dir, "out");

    await report(dir, { outDir });

    const md = await fs.readFile(path.join(outDir, "frontend.md"), "utf8");
    expect(md).toContain("# ADUX 前端修复清单");
    // Path:line:col format with no spaces around colons (so IDE jump can parse).
    expect(md).toMatch(/`src\/App\.tsx:\d+:\d+`/);
    expect(md).toContain("修复建议：");
  });

  it("renders developer.md with Rule / File / Category breakdown sections", async () => {
    const dir = await makeProject({
      "src/App.tsx":
        "export default function App() { return <button>Save</button>; }\n",
    });
    const outDir = path.join(dir, "out");

    await report(dir, { outDir });

    const md = await fs.readFile(path.join(outDir, "developer.md"), "utf8");
    expect(md).toContain("# ADUX 开发者报告");
    expect(md).toContain("## 摘要");
    expect(md).toContain("## 规则统计");
    expect(md).toContain("## 文件统计");
    expect(md).toContain("## 分类统计");
    expect(md).toMatch(/`require-antd-component`: \d+/);
  });

  it("respects reports.views config to skip a renderer", async () => {
    const dir = await makeProject({
      "src/App.tsx":
        "export default function App() { return <button>Save</button>; }\n",
    });
    // Override config: only emit frontend view
    await fs.writeFile(
      path.join(dir, "adux.config.cjs"),
      ANTD_CONFIG.replace(
        '["designer", "frontend", "developer"]',
        '["frontend"]',
      ),
      "utf8",
    );
    const outDir = path.join(dir, "out");

    await report(dir, { outDir });

    await expect(fs.stat(path.join(outDir, "issues.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(outDir, "frontend.md"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(outDir, "index.html"))).rejects.toThrow();
    await expect(fs.stat(path.join(outDir, "developer.md"))).rejects.toThrow();
  });
});
