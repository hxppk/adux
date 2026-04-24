import { walk } from "./ast/traverse.js";
import type { ParseResult } from "./ast/types.js";
import type { RuleRegistry } from "./rules/registry.js";
import type {
  ReportSeverity,
  RuleContext,
  Violation,
} from "./rules/types.js";

/** Run every enabled rule in the registry against a parsed file. */
export function runRules(
  file: ParseResult,
  registry: RuleRegistry,
): Violation[] {
  const violations: Violation[] = [];
  const rules = registry.enabled();

  // Merge per-node visitors into a single pass for efficiency.
  const merged: Record<string, Array<(path: any) => void>> = {};

  for (const rule of rules) {
    const severity = registry.effectiveSeverity(rule.meta.id);
    if (severity === "off") continue;

    const effective: ReportSeverity = severity;
    const ctx: RuleContext = {
      file,
      severity: effective,
      options: registry.effectiveOptions(rule.meta.id),
      report(v) {
        violations.push({
          ruleId: rule.meta.id,
          message: v.message,
          severity: v.severity ?? effective,
          range: v.range,
          fix: v.fix,
        });
      },
    };

    const visitor = rule.create(ctx);
    for (const [nodeType, fn] of Object.entries(visitor)) {
      (merged[nodeType] ??= []).push((path) => fn(path, ctx));
    }
  }

  const combined: Record<string, (path: any) => void> = {};
  for (const [nodeType, fns] of Object.entries(merged)) {
    combined[nodeType] = (path) => {
      for (const fn of fns) fn(path);
    };
  }

  walk(file, combined);
  return violations;
}
