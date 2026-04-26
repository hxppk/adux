import fs from "node:fs/promises";
import path from "node:path";
import fastGlob from "fast-glob";
import {
  type AduxConfig,
  createDefaultRegistry,
  formatJson,
  formatMarkdown,
  formatText,
  loadAduxConfig,
  loadMigrations,
  parseSource,
  runRules,
  type ReportFormat,
  type ReportInput,
  type Violation,
} from "@adux/core";

export interface ReviewOptions {
  format: ReportFormat;
}

export interface ReviewSummary {
  filesScanned: number;
  filesWithIssues: number;
  totalErrors: number;
  totalWarns: number;
}

export interface ReviewData {
  files: string[];
  perFile: ReportInput[];
  withIssues: ReportInput[];
  summary: ReviewSummary;
  config?: AduxConfig;
  configPath?: string;
  target: string;
}

export interface ReviewResult {
  exitCode: number;
  output: string;
  data: ReviewData;
}

const SOURCE_EXT_GLOB = "**/*.{tsx,ts,jsx,js,mjs,cjs}";
const IGNORE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/.turbo/**",
  "**/coverage/**",
];

async function resolveTargets(
  target: string,
  include: string[],
  ignore: string[],
  useConfigInclude: boolean,
): Promise<string[]> {
  const abs = path.resolve(target);
  const stat = await fs.stat(abs).catch(() => null);
  if (stat?.isFile()) return [abs];
  if (stat?.isDirectory()) {
    return fastGlob(useConfigInclude ? include : [SOURCE_EXT_GLOB], {
      cwd: abs,
      absolute: true,
      ignore,
    });
  }
  // Treat the input as a glob pattern (allow wildcards relative to cwd).
  return fastGlob([target], {
    absolute: true,
    ignore,
  });
}

export async function review(
  target: string | undefined,
  options: ReviewOptions,
): Promise<ReviewResult> {
  const data = await collectReview(target);

  if (data.files.length === 0) {
    return {
      exitCode: 0,
      output: `${data.target}: no source files matched.`,
      data,
    };
  }

  const output = formatAggregate({
    format: options.format,
    files: data.summary.filesScanned,
    perFile: data.perFile,
    withIssues: data.withIssues,
    totalErrors: data.summary.totalErrors,
    totalWarns: data.summary.totalWarns,
  });

  return {
    exitCode: data.summary.totalErrors > 0 ? 1 : 0,
    output,
    data,
  };
}

export async function collectReview(
  target?: string,
): Promise<ReviewData> {
  const configCwd = await configSearchCwd(target);
  const loadedConfig = await loadAduxConfig({ cwd: configCwd });
  const config = loadedConfig?.config;
  const configDir = loadedConfig ? path.dirname(loadedConfig.path) : process.cwd();
  const hasExplicitTarget = Boolean(target);
  const reviewTarget = target
    ? path.resolve(target)
    : path.resolve(configDir, config?.target?.root ?? ".");
  const include = config?.target?.include ?? [SOURCE_EXT_GLOB];
  const ignore = [...IGNORE, ...(config?.target?.exclude ?? [])];
  const files = await resolveTargets(
    reviewTarget,
    include,
    ignore,
    !hasExplicitTarget,
  );

  const migrationSet = await loadMigrations().catch(() => null);
  const migrations = migrationSet?.entries ?? [];
  const registry = createDefaultRegistry({
    migrations,
    config,
  });

  const perFile: ReportInput[] = [];
  for (const f of files) {
    const source = await fs.readFile(f, "utf8");
    const parsed = parseSource(source, { filename: f });
    const violations = runRules(parsed, registry);
    perFile.push({ filename: f, violations });
  }

  const { totalErrors, totalWarns } = summarize(perFile);
  const withIssues = perFile.filter((p) => p.violations.length > 0);

  return {
    files,
    perFile,
    withIssues,
    summary: {
      filesScanned: files.length,
      filesWithIssues: withIssues.length,
      totalErrors,
      totalWarns,
    },
    config,
    configPath: loadedConfig?.path,
    target: reviewTarget,
  };
}

interface AggregateArgs {
  format: ReportFormat;
  files: number;
  perFile: ReportInput[];
  withIssues: ReportInput[];
  totalErrors: number;
  totalWarns: number;
}

function formatAggregate(args: AggregateArgs): string {
  if (args.format === "json") {
    return JSON.stringify(
      {
        files: args.perFile,
        summary: {
          filesScanned: args.files,
          filesWithIssues: args.withIssues.length,
          totalErrors: args.totalErrors,
          totalWarns: args.totalWarns,
        },
      },
      null,
      2,
    );
  }

  if (args.withIssues.length === 0) {
    return `✅ Scanned ${args.files} file(s) — no violations.`;
  }

  const chunks = args.withIssues.map((input) =>
    args.format === "markdown" ? formatMarkdown(input) : formatText(input),
  );

  const summary =
    args.format === "markdown"
      ? `\n---\n\n**ADUX summary** — scanned ${args.files} file(s), ${args.withIssues.length} with issues. Total: **${args.totalErrors} error**, **${args.totalWarns} warn**.`
      : `\n=== ADUX summary ===\nScanned ${args.files} file(s), ${args.withIssues.length} with issues.\nTotal: ${args.totalErrors} error, ${args.totalWarns} warn`;

  return chunks.join("\n\n") + summary;
}

function summarize(perFile: ReportInput[]): {
  totalErrors: number;
  totalWarns: number;
} {
  let totalErrors = 0;
  let totalWarns = 0;
  for (const f of perFile) {
    for (const v of f.violations) {
      if (v.severity === "error") totalErrors++;
      else totalWarns++;
    }
  }
  return { totalErrors, totalWarns };
}

async function configSearchCwd(target?: string): Promise<string> {
  if (!target) return process.cwd();
  const abs = path.resolve(target);
  const stat = await fs.stat(abs).catch(() => null);
  if (stat?.isFile()) return path.dirname(abs);
  if (stat?.isDirectory()) return abs;
  return process.cwd();
}

// Re-export for potential library callers
export type { Violation };
