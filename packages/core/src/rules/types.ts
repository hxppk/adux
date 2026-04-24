import type { ParseResult, SourceRange } from "../ast/types.js";

export type RuleSeverity = "error" | "warn" | "off";
export type ReportSeverity = Exclude<RuleSeverity, "off">;

export interface RuleMeta {
  id: string;
  description: string;
  /** Feature area, e.g. "component" | "design-token" | "feedback" | "layout". */
  category: string;
  /** Docs URL or anchor (filled later). */
  docsUrl?: string;
  /** Default severity when no overrides apply. */
  defaultSeverity: RuleSeverity;
}

export interface ViolationFix {
  description: string;
  /** Replacement source text; when present, a mechanical fix is available. */
  replacement?: string;
}

export interface Violation {
  ruleId: string;
  message: string;
  severity: ReportSeverity;
  range: SourceRange;
  fix?: ViolationFix;
}

export interface ReportedViolation {
  message: string;
  range: SourceRange;
  severity?: ReportSeverity;
  fix?: ViolationFix;
}

export interface RuleContext {
  file: ParseResult;
  severity: ReportSeverity;
  options?: Record<string, unknown>;
  report(v: ReportedViolation): void;
}

export type RuleVisitor = Record<string, (path: any, ctx: RuleContext) => void>;

export interface Rule {
  meta: RuleMeta;
  create(ctx: RuleContext): RuleVisitor;
}
