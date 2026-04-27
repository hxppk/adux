import { designTokenOnly } from "./design-token-only.js";
import { noDeprecatedApi } from "./no-deprecated-api.js";
import { noOtherDesignSystems } from "./no-other-design-systems.js";
import { requireAntdComponent } from "./require-antd-component.js";
import type { Rule } from "./types.js";
import { useAntdFeedback } from "./use-antd-feedback.js";
import { useAntdIcons } from "./use-antd-icons.js";
import { useAntdLayout } from "./use-antd-layout.js";
import { useFormItemRules } from "./use-form-item-rules.js";

export const BUILT_IN_RULES: readonly Rule[] = [
  requireAntdComponent,
  noOtherDesignSystems,
  designTokenOnly,
  useAntdFeedback,
  useAntdLayout,
  useAntdIcons,
  useFormItemRules,
  noDeprecatedApi,
];

export const BUILT_IN_RULE_IDS = BUILT_IN_RULES.map((rule) => rule.meta.id);

export const ANTD_ONLY_RULE_IDS = [
  "require-antd-component",
  "no-other-design-systems",
  "use-antd-feedback",
  "use-antd-layout",
  "use-antd-icons",
  "use-form-item-rules",
  "no-deprecated-api",
] as const;
