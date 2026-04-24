import fs from "node:fs/promises";
import path from "node:path";
import fastGlob from "fast-glob";
import {
  createDefaultRegistry,
  formatJson,
  formatMarkdown,
  formatText,
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

export interface ReviewResult {
  exitCode: number;
  output: string;
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

async function resolveTargets(target: string): Promise<string[]> {
  const abs = path.resolve(target);
  const stat = await fs.stat(abs).catch(() => null);
  if (stat?.isFile()) return [abs];
  if (stat?.isDirectory()) {
    return fastGlob([SOURCE_EXT_GLOB], {
      cwd: abs,
      absolute: true,
      ignore: IGNORE,
    });
  }
  // Treat the input as a glob pattern (allow wildcards relative to cwd).
  return fastGlob([target], {
    absolute: true,
    ignore: IGNORE,
  });
}

export async function review(
  target: string,
  options: ReviewOptions,
): Promise<ReviewResult> {
  const files = await resolveTargets(target);
  if (files.length === 0) {
    return { exitCode: 0, output: `${target}: no source files matched.` };
  }

  const migrationSet = await loadMigrations().catch(() => null);
  const migrations = migrationSet?.entries ?? [];
  const registry = createDefaultRegistry({ migrations });

  const perFile: ReportInput[] = [];
  for (const f of files) {
    const source = await fs.readFile(f, "utf8");
    const parsed = parseSource(source, { filename: f });
    const violations = runRules(parsed, registry);
    perFile.push({ filename: f, violations });
  }

  const { totalErrors, totalWarns } = summarize(perFile);
  const withIssues = perFile.filter((p) => p.violations.length > 0);

  const output = formatAggregate({
    format: options.format,
    files: files.length,
    perFile,
    withIssues,
    totalErrors,
    totalWarns,
  });

  return { exitCode: totalErrors > 0 ? 1 : 0, output };
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

// Re-export for potential library callers
export type { Violation };
