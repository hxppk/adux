import { cac } from "cac";
import { review } from "./commands/review.js";

const cli = cac("adux");

const VALID_FORMATS = ["text", "json", "markdown"] as const;

cli
  .command("review <path>", "Review code against ADUX rules")
  .option("--format <format>", "Output format: text | json | markdown", {
    default: "text",
  })
  .action(async (targetPath: string, opts: { format: string }) => {
    const format = (VALID_FORMATS as readonly string[]).includes(opts.format)
      ? (opts.format as (typeof VALID_FORMATS)[number])
      : "text";
    const { exitCode, output } = await review(targetPath, { format });
    process.stdout.write(output + "\n");
    process.exit(exitCode);
  });

cli.help();
cli.version("0.0.1");
cli.parse();
