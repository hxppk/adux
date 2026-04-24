import type { RuntimeRule } from "../types.js";

export class RuntimeRuleRegistry {
  private readonly rules = new Map<string, RuntimeRule>();

  register(rule: RuntimeRule): this {
    this.rules.set(rule.id, rule);
    return this;
  }

  all(): RuntimeRule[] {
    return [...this.rules.values()];
  }

  remove(id: string): boolean {
    return this.rules.delete(id);
  }
}
