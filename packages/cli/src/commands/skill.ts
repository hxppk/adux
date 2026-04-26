import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { findAduxConfig, type AduxConfig, type AduxSkillConfig } from "@adux/core";

export interface SkillInitOptions {
  force?: boolean;
}

export interface SkillImportOptions {
  out?: string;
}

export interface SkillCommandResult {
  path: string;
  output: string;
  written: boolean;
  configPath?: string;
  configUpdated?: boolean;
  skill?: AduxSkillConfig;
}

const DEFAULT_GUIDELINES_FILE = "design-guidelines.md";
const DEFAULT_SKILL_FILE = "adux.skill.cjs";

export async function skillInit(
  targetFile = DEFAULT_GUIDELINES_FILE,
  options: SkillInitOptions = {},
): Promise<SkillCommandResult> {
  const file = path.resolve(targetFile);
  const exists = await fs.stat(file).catch(() => null);
  if (exists && !options.force) {
    return {
      path: file,
      written: false,
      output: [
        `ADUX skill template already exists: ${file}`,
        "Use --force to overwrite it.",
      ].join("\n"),
    };
  }

  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, DESIGN_GUIDELINES_TEMPLATE, "utf8");

  return {
    path: file,
    written: true,
    output: [
      `Created ${file}`,
      "",
      "Next steps:",
      `  adux skill import ${path.relative(process.cwd(), file) || path.basename(file)}`,
      "  adux audit . --yes",
    ].join("\n"),
  };
}

export async function skillImport(
  markdownFile: string,
  options: SkillImportOptions = {},
): Promise<SkillCommandResult> {
  const sourcePath = path.resolve(markdownFile);
  const outPath = path.resolve(options.out ?? DEFAULT_SKILL_FILE);
  const markdown = await fs.readFile(sourcePath, "utf8");
  const skill = parseSkillMarkdown(markdown);

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, renderSkillConfig(skill), "utf8");

  const configUpdate = await addSkillToNearestConfig(outPath);

  return {
    path: outPath,
    written: true,
    skill,
    configPath: configUpdate?.configPath,
    configUpdated: configUpdate?.updated,
    output: [
      `Created ${outPath}`,
      configUpdate
        ? configUpdate.updated
          ? `Updated ${configUpdate.configPath}: added ${configUpdate.skillPath}`
          : `${configUpdate.configPath} already includes ${configUpdate.skillPath}`
        : "No ADUX config found. Run adux init first, then add this file to skills.",
      "",
      "Next steps:",
      "  adux audit . --yes",
    ].join("\n"),
  };
}

function parseSkillMarkdown(source: string): AduxSkillConfig {
  const skill: AduxSkillConfig = {
    version: 1,
    rules: {},
  };
  let currentRule: string | null = null;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("<!--")) continue;

    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      currentRule = heading[1]!.trim().replace(/^`|`$/g, "");
      skill.rules ??= {};
      skill.rules[currentRule] ??= {};
      continue;
    }

    const entry = line.match(/^(?:[-*]\s*)?([A-Za-z][\w-]*)\s*:\s*(.+)$/);
    if (!entry) continue;

    const [, key, value] = entry;
    if (!key || value == null) continue;
    const parsedValue = parseFieldValue(value.trim());

    if (currentRule) {
      const rule = (skill.rules ??= {})[currentRule] ?? {};
      if (key === "severity" && isSeverity(parsedValue)) {
        rule.severity = parsedValue;
      } else if (key === "category" && typeof parsedValue === "string") {
        rule.category = parsedValue;
      } else if (key === "description" && typeof parsedValue === "string") {
        rule.description = parsedValue;
      } else if (key === "impact" && typeof parsedValue === "string") {
        rule.impact = parsedValue;
      } else if (key === "fix" && typeof parsedValue === "string") {
        rule.fix = parsedValue;
      } else if (key === "docsUrl" && typeof parsedValue === "string") {
        rule.docsUrl = parsedValue;
      } else if (key === "options" && isRecord(parsedValue)) {
        rule.options = parsedValue;
      }
      skill.rules[currentRule] = rule;
      continue;
    }

    if (key === "name" && typeof parsedValue === "string") {
      skill.name = parsedValue;
    } else if (key === "designSystem" && typeof parsedValue === "string") {
      skill.designSystem = parsedValue;
    } else if (
      key === "version" &&
      (typeof parsedValue === "string" || typeof parsedValue === "number")
    ) {
      skill.version = parsedValue;
    }
  }

  if (!skill.name) skill.name = "team-design-skill";
  if (!skill.designSystem) skill.designSystem = "antd";
  if (!skill.rules || Object.keys(skill.rules).length === 0) {
    throw new Error("No skill rules found. Add at least one `## rule-id` section.");
  }
  return skill;
}

function parseFieldValue(value: string): unknown {
  const unquoted = value.replace(/^["']|["']$/g, "");
  if (/^\d+$/.test(unquoted)) return Number(unquoted);
  if (
    (unquoted.startsWith("{") && unquoted.endsWith("}")) ||
    (unquoted.startsWith("[") && unquoted.endsWith("]"))
  ) {
    try {
      return JSON.parse(unquoted);
    } catch {
      return unquoted;
    }
  }
  return unquoted;
}

async function addSkillToNearestConfig(
  skillPath: string,
): Promise<
  | {
      configPath: string;
      skillPath: string;
      updated: boolean;
    }
  | undefined
> {
  const configPath = await findAduxConfig(process.cwd());
  if (!configPath) return undefined;

  const config = await readConfig(configPath);
  const skillReference = relativeSkillPath(path.dirname(configPath), skillPath);
  const existingSkills = Array.isArray(config.skills)
    ? config.skills.filter((item): item is string => typeof item === "string")
    : [];

  if (existingSkills.includes(skillReference)) {
    return { configPath, skillPath: skillReference, updated: false };
  }

  const updatedConfig = {
    ...config,
    skills: [...existingSkills, skillReference],
  };
  delete updatedConfig.skillRules;
  delete updatedConfig.skillSources;
  await writeConfig(configPath, updatedConfig);
  return { configPath, skillPath: skillReference, updated: true };
}

async function readConfig(configPath: string): Promise<AduxConfig> {
  const raw = configPath.endsWith(".json")
    ? JSON.parse(await fs.readFile(configPath, "utf8"))
    : await importConfig(configPath);
  return isRecord(raw) ? (raw as AduxConfig) : {};
}

async function importConfig(configPath: string): Promise<unknown> {
  const url = pathToFileURL(configPath);
  url.search = `t=${Date.now()}-${Math.random()}`;
  const mod = await import(url.href);
  return mod.default ?? mod.config ?? mod;
}

async function writeConfig(configPath: string, config: AduxConfig): Promise<void> {
  if (configPath.endsWith(".json")) {
    await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    return;
  }
  await fs.writeFile(configPath, renderConfig(config), "utf8");
}

function renderSkillConfig(skill: AduxSkillConfig): string {
  return `/** @type {import("@adux/core").AduxSkillConfig} */
module.exports = ${formatObject(skill)};
`;
}

function renderConfig(config: AduxConfig): string {
  return `/** @type {import("@adux/core").AduxConfig} */
module.exports = ${formatObject(config)};
`;
}

function formatObject(value: unknown, indent = 0): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[${value.map((item) => formatObject(item, indent)).join(", ")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(
      ([, entryValue]) => entryValue !== undefined,
    );
    if (entries.length === 0) return "{}";
    const pad = " ".repeat(indent);
    const childPad = " ".repeat(indent + 2);
    const lines = entries.map(([key, entryValue]) => {
      const rendered = formatObject(entryValue, indent + 2);
      return `${childPad}${JSON.stringify(key)}: ${rendered},`;
    });
    return ["{", ...lines, `${pad}}`].join("\n");
  }
  return JSON.stringify(value);
}

function relativeSkillPath(configDir: string, skillPath: string): string {
  const relative = path.relative(configDir, skillPath).replaceAll(path.sep, "/");
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function isSeverity(value: unknown): value is "error" | "warn" | "off" {
  return value === "error" || value === "warn" || value === "off";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const DESIGN_GUIDELINES_TEMPLATE = `# ADUX Design Skill

- name: team-design-skill
- designSystem: antd
- version: 1

把团队设计规范写成下面的规则块。v0.0.3 会把这些字段合并进 ADUX 报告：
description / impact / fix 会覆盖内置文案，severity / options 会影响规则执行。

## require-antd-component

- severity: error
- category: component
- description: 不要使用原生 HTML 控件，统一使用 antd 组件。
- impact: 原生控件会绕过团队沉淀的状态、尺寸、可访问性和交互规范，导致页面体验不一致。
- fix: 将 button/input/select/textarea 等原生控件替换为 Button/Input/Select/Form 等 antd 组件。

## design-token-only

- severity: warn
- category: design-token
- description: 颜色、间距、圆角等视觉值必须来自设计 Token。
- impact: 硬编码视觉值会导致暗色模式、品牌换肤和批量调整成本升高。
- fix: 使用 theme token、CSS 变量或团队封装的 token helper，不要直接写 hex/rgb/px 常量。
`;
