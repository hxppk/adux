import type { Violation } from "../rules/types.js";

export interface ReportInput {
  filename: string;
  violations: Violation[];
}

export type ReportFormat = "text" | "json" | "markdown";
