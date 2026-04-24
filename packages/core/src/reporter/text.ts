import type { ReportInput } from "./types.js";

export function formatText(input: ReportInput): string {
  const { filename, violations } = input;
  if (violations.length === 0) {
    return `${filename}: no violations`;
  }
  const errorCount = violations.filter((v) => v.severity === "error").length;
  const warnCount = violations.length - errorCount;
  const lines = violations.map((v) => {
    const { line, column } = v.range.start;
    const tag = v.severity === "error" ? "ERROR" : "WARN ";
    return `${filename}:${line}:${column}  ${tag}  ${v.message}  [${v.ruleId}]`;
  });
  lines.push("");
  lines.push(
    `${violations.length} issue(s): ${errorCount} error, ${warnCount} warn`,
  );
  return lines.join("\n");
}
