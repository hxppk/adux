import type { Rule, RuleSeverity } from "./types.js";

export interface RuleOverride {
  severity?: RuleSeverity;
  options?: Record<string, unknown>;
}

export class RuleRegistry {
  private readonly rules = new Map<string, Rule>();
  private readonly overrides = new Map<string, RuleOverride>();

  register(rule: Rule): this {
    if (this.rules.has(rule.meta.id)) {
      throw new Error(`Rule "${rule.meta.id}" already registered`);
    }
    this.rules.set(rule.meta.id, rule);
    return this;
  }

  override(id: string, override: RuleOverride): this {
    this.overrides.set(id, override);
    return this;
  }

  get(id: string): Rule | undefined {
    return this.rules.get(id);
  }

  all(): Rule[] {
    return [...this.rules.values()];
  }

  enabled(): Rule[] {
    return this.all().filter(
      (r) => this.effectiveSeverity(r.meta.id) !== "off",
    );
  }

  effectiveSeverity(id: string): RuleSeverity {
    const rule = this.rules.get(id);
    if (!rule) return "off";
    return this.overrides.get(id)?.severity ?? rule.meta.defaultSeverity;
  }

  effectiveOptions(id: string): Record<string, unknown> | undefined {
    return this.overrides.get(id)?.options;
  }
}
