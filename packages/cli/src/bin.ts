import { readFileSync } from "node:fs";
import { cac } from "cac";
import { audit } from "./commands/audit.js";
import { init } from "./commands/init.js";
import { report } from "./commands/report.js";
import { review } from "./commands/review.js";
import { skillImport, skillInit, skillList } from "./commands/skill.js";

const cli = cac("adux");

const VALID_FORMATS = ["text", "json", "markdown"] as const;

function packageVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version?: unknown };
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

cli
  .command("audit [dir]", "Run guided ADUX init + report workflow")
  .option("-y, --yes", "Accept detected defaults when creating config")
  .option("--out-dir <dir>", "Output directory for report artifacts")
  .option("--skill <file>", "Temporarily use a review skill file instead of config.skills")
  .action(
    async (
      targetDir: string | undefined,
      opts: {
        yes?: boolean;
        outDir?: string;
        skill?: string | string[];
      },
    ) => {
      const { exitCode, output } = await audit(targetDir, {
        yes: opts.yes,
        outDir: opts.outDir,
        skillPaths: optionList(opts.skill),
      });
      process.stdout.write(output + "\n");
      process.exit(exitCode);
    },
  );

cli
  .command("init [dir]", "Detect project settings and create adux.config.cjs")
  .option("-y, --yes", "Accept detected defaults")
  .option("--force", "Overwrite an existing adux.config.cjs")
  .option("--dry-run", "Print the generated config without writing files")
  .action(
    async (
      targetDir: string | undefined,
      opts: { yes?: boolean; force?: boolean; dryRun?: boolean },
    ) => {
      const result = await init(targetDir, opts);
      process.stdout.write(result.output + "\n");
    },
  );

cli
  .command("review [path]", "Review code against ADUX rules")
  .option("--format <format>", "Output format: text | json | markdown", {
    default: "text",
  })
  .option("--skill <file>", "Temporarily use a review skill file instead of config.skills")
  .action(async (
    targetPath: string | undefined,
    opts: {
      format: string;
      skill?: string | string[];
    },
  ) => {
    const format = (VALID_FORMATS as readonly string[]).includes(opts.format)
      ? (opts.format as (typeof VALID_FORMATS)[number])
      : "text";
    const { exitCode, output } = await review(targetPath, {
      format,
      skillPaths: optionList(opts.skill),
    });
    process.stdout.write(output + "\n");
    process.exit(exitCode);
  });

cli
  .command("report [path]", "Create role-aware ADUX report artifacts")
  .option("--out-dir <dir>", "Output directory for report artifacts")
  .option("--skill <file>", "Temporarily use a review skill file instead of config.skills")
  .action(
    async (
      targetPath: string | undefined,
      opts: {
        outDir?: string;
        skill?: string | string[];
      },
    ) => {
      const { exitCode, output } = await report(targetPath, {
        outDir: opts.outDir,
        skillPaths: optionList(opts.skill),
      });
      process.stdout.write(output + "\n");
      process.exit(exitCode);
    },
  );

cli
  .command("skill <action> [file]", "Manage designer-provided ADUX skill config")
  .option("--force", "Overwrite an existing skill template")
  .option("--out <file>", "Output skill config file", {
    default: "adux.skill.cjs",
  })
  .option("--json", "Print machine-readable output for adux skill list")
  .action(
    async (
      action: string,
      file: string | undefined,
      opts: { force?: boolean; out?: string; json?: boolean },
    ) => {
      if (action === "init") {
        const result = await skillInit(file, { force: opts.force });
        process.stdout.write(result.output + "\n");
        return;
      }
      if (action === "import") {
        if (!file) {
          process.stderr.write("Missing Markdown file: adux skill import <file>\n");
          process.exit(1);
        }
        const result = await skillImport(file, { out: opts.out });
        process.stdout.write(result.output + "\n");
        return;
      }
      if (action === "list") {
        const result = await skillList({ json: opts.json });
        process.stdout.write(result.output + "\n");
        process.exit(result.exitCode);
      }
      process.stderr.write(`Unknown skill action: ${action}\n`);
      process.stderr.write(
        "Use: adux skill init [file], adux skill import <file>, or adux skill list\n",
      );
      process.exit(1);
    },
  );

cli.help();
cli.version(packageVersion());
cli.parse();

function optionList(value: string | string[] | undefined): string[] | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value : [value];
}
