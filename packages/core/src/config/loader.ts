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

export interface AduxConfig {
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
  const rules = isRecord(value.rules)
    ? (value.rules as Record<string, AduxRuleConfig>)
    : undefined;
  return { rules };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
