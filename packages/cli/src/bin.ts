import { cac } from "cac";
import { audit } from "./commands/audit.js";
import { init } from "./commands/init.js";
import { report } from "./commands/report.js";
import { review } from "./commands/review.js";
import { skillImport, skillInit } from "./commands/skill.js";

const cli = cac("adux");

const VALID_FORMATS = ["text", "json", "markdown"] as const;

cli
  .command("audit [dir]", "Run guided ADUX init + report workflow")
  .option("-y, --yes", "Accept detected defaults when creating config")
  .option("--out-dir <dir>", "Output directory for report artifacts")
  .action(
    async (
      targetDir: string | undefined,
      opts: { yes?: boolean; outDir?: string },
    ) => {
      const { exitCode, output } = await audit(targetDir, {
        yes: opts.yes,
        outDir: opts.outDir,
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
  .action(async (targetPath: string | undefined, opts: { format: string }) => {
    const format = (VALID_FORMATS as readonly string[]).includes(opts.format)
      ? (opts.format as (typeof VALID_FORMATS)[number])
      : "text";
    const { exitCode, output } = await review(targetPath, { format });
    process.stdout.write(output + "\n");
    process.exit(exitCode);
  });

cli
  .command("report [path]", "Create role-aware ADUX report artifacts")
  .option("--out-dir <dir>", "Output directory for report artifacts")
  .action(
    async (targetPath: string | undefined, opts: { outDir?: string }) => {
      const { exitCode, output } = await report(targetPath, {
        outDir: opts.outDir,
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
  .action(
    async (
      action: string,
      file: string | undefined,
      opts: { force?: boolean; out?: string },
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
      process.stderr.write(`Unknown skill action: ${action}\n`);
      process.stderr.write("Use: adux skill init [file] or adux skill import <file>\n");
      process.exit(1);
    },
  );

cli.help();
cli.version("0.0.1");
cli.parse();
