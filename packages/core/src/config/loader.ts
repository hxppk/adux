import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { RuleOverride, RuleRegistry } from "../rules/registry.js";
import type { RuleSeverity } from "../rules/types.js";

const CONFIG_FILES = [
  "adux.config.js",
  "adux.config.mjs",
  "adux.config.cjs",
  ".aduxrc.json",
] as const;

export type AduxRuleConfig =
  | RuleSeverity
  | RuleOverride
  | [RuleSeverity, Record<string, unknown>?];

export type AduxTargetMode = "repo" | "git" | "url" | "browser";
export type AduxRuntimeVia = "vite-plugin" | "playwright-inject" | "extension";
export type AduxReportView = "designer" | "frontend" | "developer";

export interface AduxConfigMeta {
  schemaVersion?: number;
  projectName?: string;
}

export interface AduxDesignSystemConfig {
  name?: string;
  version?: string;
  adapter?: string;
  skill?: string;
  preset?: string;
}

export interface AduxDevServerConfig {
  command?: string;
  url?: string;
}

export interface AduxTargetConfig {
  mode?: AduxTargetMode;
  root?: string;
  include?: string[];
  exclude?: string[];
  gitUrl?: string;
  url?: string;
  devServer?: AduxDevServerConfig;
  routes?: string[];
}

export interface AduxRuntimeConfig {
  enabled?: boolean;
  via?: AduxRuntimeVia;
  openEditor?: boolean;
}

export interface AduxReportsConfig {
  outDir?: string;
  views?: AduxReportView[];
  screenshots?: boolean;
}

export interface AduxConfig {
  meta?: AduxConfigMeta;
  designSystem?: AduxDesignSystemConfig;
  target?: AduxTargetConfig;
  runtime?: AduxRuntimeConfig;
  reports?: AduxReportsConfig;
  rules?: Record<string, AduxRuleConfig>;
}

export interface LoadedAduxConfig {
  path: string;
  config: AduxConfig;
}

export interface LoadAduxConfigOptions {
  cwd?: string;
}

export async function findAduxConfig(
  cwd = process.cwd(),
): Promise<string | null> {
  let dir = path.resolve(cwd);

  while (true) {
    for (const name of CONFIG_FILES) {
      const candidate = path.join(dir, name);
      const stat = await fs.stat(candidate).catch(() => null);
      if (stat?.isFile()) return candidate;
    }

    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export async function loadAduxConfig(
  options: LoadAduxConfigOptions = {},
): Promise<LoadedAduxConfig | null> {
  const configPath = await findAduxConfig(options.cwd);
  if (!configPath) return null;

  const config = configPath.endsWith(".json")
    ? JSON.parse(await fs.readFile(configPath, "utf8"))
    : await importConfig(configPath);

  return {
    path: configPath,
    config: normalizeConfig(config),
  };
}

export function applyAduxConfig(
  registry: RuleRegistry,
  config: AduxConfig | null | undefined,
): RuleRegistry {
  if (!config?.rules) return registry;

  for (const [id, value] of Object.entries(config.rules)) {
    const override = normalizeRuleConfig(value);
    if (override) registry.override(id, override);
  }

  return registry;
}

async function importConfig(configPath: string): Promise<unknown> {
  const mod = await import(pathToFileURL(configPath).href);
  return mod.default ?? mod.config ?? mod;
}

function normalizeConfig(value: unknown): AduxConfig {
  if (!isRecord(value)) return {};

  const meta = isRecord(value.meta)
    ? normalizeMeta(value.meta)
    : undefined;
  const designSystem = isRecord(value.designSystem)
    ? normalizeDesignSystem(value.designSystem)
    : undefined;
  const target = isRecord(value.target)
    ? normalizeTarget(value.target)
    : undefined;
  const runtime = isRecord(value.runtime)
    ? normalizeRuntime(value.runtime)
    : undefined;
  const reports = isRecord(value.reports)
    ? normalizeReports(value.reports)
    : undefined;
  const rules = isRecord(value.rules)
    ? (value.rules as Record<string, AduxRuleConfig>)
    : undefined;

  return {
    meta,
    designSystem,
    target,
    runtime,
    reports,
    rules,
  };
}

function normalizeMeta(value: Record<string, unknown>): AduxConfigMeta {
  return {
    schemaVersion:
      typeof value.schemaVersion === "number"
        ? value.schemaVersion
        : undefined,
    projectName:
      typeof value.projectName === "string" ? value.projectName : undefined,
  };
}

function normalizeDesignSystem(
  value: Record<string, unknown>,
): AduxDesignSystemConfig {
  return {
    name: typeof value.name === "string" ? value.name : undefined,
    version: typeof value.version === "string" ? value.version : undefined,
    adapter: typeof value.adapter === "string" ? value.adapter : undefined,
    skill: typeof value.skill === "string" ? value.skill : undefined,
    preset: typeof value.preset === "string" ? value.preset : undefined,
  };
}

function normalizeTarget(value: Record<string, unknown>): AduxTargetConfig {
  return {
    mode: isTargetMode(value.mode) ? value.mode : undefined,
    root: typeof value.root === "string" ? value.root : undefined,
    include: stringArray(value.include),
    exclude: stringArray(value.exclude),
    gitUrl: typeof value.gitUrl === "string" ? value.gitUrl : undefined,
    url: typeof value.url === "string" ? value.url : undefined,
    devServer: isRecord(value.devServer)
      ? normalizeDevServer(value.devServer)
      : undefined,
    routes: stringArray(value.routes),
  };
}

function normalizeDevServer(
  value: Record<string, unknown>,
): AduxDevServerConfig {
  return {
    command: typeof value.command === "string" ? value.command : undefined,
    url: typeof value.url === "string" ? value.url : undefined,
  };
}

function normalizeRuntime(value: Record<string, unknown>): AduxRuntimeConfig {
  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : undefined,
    via: isRuntimeVia(value.via) ? value.via : undefined,
    openEditor:
      typeof value.openEditor === "boolean" ? value.openEditor : undefined,
  };
}

function normalizeReports(value: Record<string, unknown>): AduxReportsConfig {
  return {
    outDir: typeof value.outDir === "string" ? value.outDir : undefined,
    views: reportViews(value.views),
    screenshots:
      typeof value.screenshots === "boolean" ? value.screenshots : undefined,
  };
}

function normalizeRuleConfig(
  value: AduxRuleConfig,
): RuleOverride | null {
  if (isSeverity(value)) return { severity: value };

  if (Array.isArray(value)) {
    const [severity, options] = value;
    if (!isSeverity(severity)) return null;
    return {
      severity,
      options: isRecord(options) ? options : undefined,
    };
  }

  if (!isRecord(value)) return null;

  const severity = isSeverity(value.severity) ? value.severity : undefined;
  const options = isRecord(value.options) ? value.options : undefined;
  if (!severity && !options) return null;
  return { severity, options };
}

function isSeverity(value: unknown): value is RuleSeverity {
  return value === "error" || value === "warn" || value === "off";
}

function isTargetMode(value: unknown): value is AduxTargetMode {
  return (
    value === "repo" ||
    value === "git" ||
    value === "url" ||
    value === "browser"
  );
}

function isRuntimeVia(value: unknown): value is AduxRuntimeVia {
  return (
    value === "vite-plugin" ||
    value === "playwright-inject" ||
    value === "extension"
  );
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result = value.filter((item): item is string => typeof item === "string");
  return result.length > 0 ? result : undefined;
}

function reportViews(value: unknown): AduxReportView[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result = value.filter((item): item is AduxReportView => {
    return item === "designer" || item === "frontend" || item === "developer";
  });
  return result.length > 0 ? result : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
