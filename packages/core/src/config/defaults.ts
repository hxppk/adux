import type { MigrationEntry } from "../migrations/types.js";
import { RuleRegistry } from "../rules/registry.js";
import { applyAduxConfig, type AduxConfig } from "./loader.js";
import { ANTD_ONLY_RULE_IDS, BUILT_IN_RULES } from "../rules/builtin.js";

export interface DefaultRegistryOptions {
  /** Migration entries from `antd migrate` for no-deprecated-api. */
  migrations?: MigrationEntry[];
  /** Optional rule overrides loaded from adux.config.*. */
  config?: AduxConfig;
}

/**
 * Built-in "recommended" preset — all 8 of the designer's ADUX rules.
 * `no-deprecated-api` is a no-op without migrations data (best-effort degrade).
 */
export function createDefaultRegistry(
  opts: DefaultRegistryOptions = {},
): RuleRegistry {
  const reg = new RuleRegistry();
  for (const rule of BUILT_IN_RULES) reg.register(rule);

  if (
    opts.config?.designSystem?.name &&
    opts.config.designSystem.name !== "antd"
  ) {
    for (const id of ANTD_ONLY_RULE_IDS) {
      reg.override(id, { severity: "off" });
    }
  }

  if (opts.migrations && opts.migrations.length > 0) {
    reg.override("no-deprecated-api", {
      options: { migrations: opts.migrations },
    });
  }

  return applyAduxConfig(reg, opts.config);
}
