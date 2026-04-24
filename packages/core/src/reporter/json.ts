import type { ReportInput } from "./types.js";

export function formatJson(input: ReportInput, pretty = true): string {
  return JSON.stringify(input, null, pretty ? 2 : 0);
}
