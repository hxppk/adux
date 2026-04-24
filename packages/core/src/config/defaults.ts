import type { MigrationEntry } from "../migrations/types.js";
import { RuleRegistry } from "../rules/registry.js";
import { requireAntdComponent } from "../rules/require-antd-component.js";
import { noOtherDesignSystems } from "../rules/no-other-design-systems.js";
import { designTokenOnly } from "../rules/design-token-only.js";
import { useAntdFeedback } from "../rules/use-antd-feedback.js";
import { useAntdLayout } from "../rules/use-antd-layout.js";
import { useAntdIcons } from "../rules/use-antd-icons.js";
import { useFormItemRules } from "../rules/use-form-item-rules.js";
import { noDeprecatedApi } from "../rules/no-deprecated-api.js";

export interface DefaultRegistryOptions {
  /** Migration entries from `antd migrate` for no-deprecated-api. */
  migrations?: MigrationEntry[];
}

/**
 * Built-in "recommended" preset — all 8 of the designer's ADUX rules.
 * `no-deprecated-api` is a no-op without migrations data (best-effort degrade).
 */
export function createDefaultRegistry(
  opts: DefaultRegistryOptions = {},
): RuleRegistry {
  const reg = new RuleRegistry()
    .register(requireAntdComponent)
    .register(noOtherDesignSystems)
    .register(designTokenOnly)
    .register(useAntdFeedback)
    .register(useAntdLayout)
    .register(useAntdIcons)
    .register(useFormItemRules)
    .register(noDeprecatedApi);

  if (opts.migrations && opts.migrations.length > 0) {
    reg.override("no-deprecated-api", {
      options: { migrations: opts.migrations },
    });
  }

  return reg;
}
