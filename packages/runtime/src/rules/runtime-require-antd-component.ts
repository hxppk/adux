import type { RuntimeRule } from "../types.js";

const BARE_TAGS_TO_ANTD: Record<string, string> = {
  button: "Button",
  input: "Input",
  select: "Select",
  textarea: "Input.TextArea",
  form: "Form",
  table: "Table",
  dialog: "Modal",
};

/**
 * Runtime counterpart of core's `require-antd-component`.
 * Detects intrinsic HTML UI primitives in the live React fiber tree.
 */
export const runtimeRequireAntdComponent: RuntimeRule = {
  id: "runtime-require-antd-component",
  description:
    "Use Ant Design components instead of bare HTML UI primitives.",
  severity: "error",
  check(ctx) {
    if (typeof ctx.fiber !== "object" || ctx.fiber === null) return;
    const type = (ctx.fiber as { type?: unknown }).type;
    if (typeof type !== "string") return;

    const suggested = BARE_TAGS_TO_ANTD[type];
    if (!suggested) return;

    const element = ctx.elements[0] ?? null;
    return [
      {
        ruleId: "runtime-require-antd-component",
        message: `<${type}> should be replaced with antd ${suggested}.`,
        severity: "error",
        element,
        source: ctx.source,
      },
    ];
  },
};
