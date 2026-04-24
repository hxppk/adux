import type { ReportInput } from "./types.js";

export function formatMarkdown(input: ReportInput): string {
  const { filename, violations } = input;
  if (violations.length === 0) {
    return `### ✅ ${filename}\n\nNo violations.`;
  }
  const rows = violations.map((v) => {
    const { line, column } = v.range.start;
    const msg = v.message.replace(/\|/g, "\\|");
    return `| ${line}:${column} | \`${v.ruleId}\` | ${v.severity} | ${msg} |`;
  });
  return [
    `### 🚨 ${filename}`,
    "",
    `${violations.length} violation(s):`,
    "",
    "| 位置 | 规则 | 级别 | 描述 |",
    "|------|------|------|------|",
    ...rows,
  ].join("\n");
}
