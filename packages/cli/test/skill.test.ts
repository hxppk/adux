import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { skillInit, skillImport } from "../src/commands/skill.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

async function makeTempDir(prefix = "adux-skill-"): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  // macOS: os.tmpdir() returns /var/... but realpath is /private/var/...; process.cwd()
  // canonicalizes, so canonicalize here for stable path equality.
  return fs.realpath(dir);
}

async function withCwd<T>(dir: string, fn: () => Promise<T>): Promise<T> {
  const prev = process.cwd();
  process.chdir(dir);
  try {
    return await fn();
  } finally {
    process.chdir(prev);
  }
}

const SAMPLE_SKILL_MD = `# Team Design Skill

- name: team-skill
- designSystem: antd
- version: 1

## require-antd-component

- severity: error
- category: component
- description: 团队规定不要使用原生 HTML 控件。
- impact: 失去 antd 沉淀的可访问性、尺寸和状态规范，体验不一致。
- fix: 把 button/input/select 替换为 Button/Input/Select。

## design-token-only

- severity: warn
- category: design-token
- description: 只允许使用设计 Token。
- impact: 硬编码颜色和间距会让暗色模式和换肤无法批量执行。
- fix: 使用 theme token 或团队 token helper。
`;

describe("adux skill init", () => {
  it("creates the design-guidelines.md template", async () => {
    const dir = await makeTempDir();

    const result = await withCwd(dir, () => skillInit("design-guidelines.md"));

    expect(result.written).toBe(true);
    expect(result.path).toBe(path.join(dir, "design-guidelines.md"));
    const content = await fs.readFile(result.path, "utf8");
    expect(content).toContain("# ADUX Design Skill");
    expect(content).toContain("## require-antd-component");
    expect(content).toContain("## design-token-only");
    expect(content).toContain("- designSystem: antd");
  });

  it("refuses to overwrite without --force", async () => {
    const dir = await makeTempDir();
    const file = path.join(dir, "design-guidelines.md");
    await fs.writeFile(file, "existing custom content", "utf8");

    const result = await withCwd(dir, () => skillInit("design-guidelines.md"));

    expect(result.written).toBe(false);
    expect(result.output).toMatch(/already exists/);
    const content = await fs.readFile(file, "utf8");
    expect(content).toBe("existing custom content");
  });

  it("--force overwrites the existing file", async () => {
    const dir = await makeTempDir();
    const file = path.join(dir, "design-guidelines.md");
    await fs.writeFile(file, "existing custom content", "utf8");

    const result = await withCwd(dir, () =>
      skillInit("design-guidelines.md", { force: true }),
    );

    expect(result.written).toBe(true);
    const content = await fs.readFile(file, "utf8");
    expect(content).toContain("# ADUX Design Skill");
    expect(content).not.toBe("existing custom content");
  });
});

describe("adux skill import", () => {
  it("parses Markdown into a valid adux.skill.cjs module", async () => {
    const dir = await makeTempDir();
    const mdPath = path.join(dir, "guidelines.md");
    await fs.writeFile(mdPath, SAMPLE_SKILL_MD, "utf8");

    const result = await withCwd(dir, () =>
      skillImport("guidelines.md", { out: "adux.skill.cjs" }),
    );

    expect(result.written).toBe(true);
    expect(result.path).toBe(path.join(dir, "adux.skill.cjs"));
    expect(result.skill?.name).toBe("team-skill");
    expect(result.skill?.designSystem).toBe("antd");
    expect(result.skill?.rules).toMatchObject({
      "require-antd-component": {
        severity: "error",
        category: "component",
        description: "团队规定不要使用原生 HTML 控件。",
      },
      "design-token-only": {
        severity: "warn",
        category: "design-token",
      },
    });

    // Verify the emitted .cjs is loadable and correctly shaped
    const mod = await import(pathToFileURL(result.path).href);
    const skill = mod.default ?? mod;
    expect(skill.rules["require-antd-component"].fix).toContain(
      "Button/Input/Select",
    );
  });

  it("auto-adds the skill path into the nearest adux.config.cjs", async () => {
    const dir = await makeTempDir();
    await fs.writeFile(
      path.join(dir, "adux.config.cjs"),
      `module.exports = { meta: { schemaVersion: 1 }, designSystem: { name: "antd" } };\n`,
      "utf8",
    );
    await fs.writeFile(path.join(dir, "guidelines.md"), SAMPLE_SKILL_MD, "utf8");

    const result = await withCwd(dir, () =>
      skillImport("guidelines.md", { out: "adux.skill.cjs" }),
    );

    expect(result.configUpdated).toBe(true);
    expect(result.configPath).toBe(path.join(dir, "adux.config.cjs"));

    const updated = await fs.readFile(path.join(dir, "adux.config.cjs"), "utf8");
    expect(updated).toContain('"skills": ["./adux.skill.cjs"]');
  });

  it("does not duplicate the skill path on a second import", async () => {
    const dir = await makeTempDir();
    await fs.writeFile(
      path.join(dir, "adux.config.cjs"),
      `module.exports = { meta: { schemaVersion: 1 }, skills: ["./adux.skill.cjs"] };\n`,
      "utf8",
    );
    await fs.writeFile(path.join(dir, "guidelines.md"), SAMPLE_SKILL_MD, "utf8");

    const result = await withCwd(dir, () =>
      skillImport("guidelines.md", { out: "adux.skill.cjs" }),
    );

    expect(result.configUpdated).toBe(false);
    expect(result.output).toMatch(/already includes/);

    const updated = await fs.readFile(path.join(dir, "adux.config.cjs"), "utf8");
    // skills array has the entry exactly once
    const matches = updated.match(/\.\/adux\.skill\.cjs/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("when no adux.config.cjs is present, hints user to run adux init", async () => {
    const dir = await makeTempDir();
    await fs.writeFile(path.join(dir, "guidelines.md"), SAMPLE_SKILL_MD, "utf8");

    const result = await withCwd(dir, () =>
      skillImport("guidelines.md", { out: "adux.skill.cjs" }),
    );

    expect(result.configPath).toBeUndefined();
    expect(result.output).toMatch(/No ADUX config found/);
    expect(result.output).toMatch(/adux init/);
    // skill file itself was still emitted
    await expect(fs.stat(result.path)).resolves.toBeTruthy();
  });

  it("throws when Markdown has no rule sections", async () => {
    const dir = await makeTempDir();
    await fs.writeFile(
      path.join(dir, "empty.md"),
      "# Just a heading\n\n- name: empty-skill\n",
      "utf8",
    );

    await expect(
      withCwd(dir, () => skillImport("empty.md", { out: "adux.skill.cjs" })),
    ).rejects.toThrow(/No skill rules found/);
  });
});
