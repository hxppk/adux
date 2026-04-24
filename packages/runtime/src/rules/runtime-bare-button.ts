import type { RuntimeRule } from "../types.js";

/**
 * Runtime counterpart of core's `require-antd-component` for <button>.
 * Detects a fiber whose type is the literal string "button" (intrinsic HTML
 * element) and surfaces it on the live DOM.
 */
export const runtimeBareButton: RuntimeRule = {
  id: "runtime-bare-button",
  description: "Use antd Button instead of bare <button>.",
  severity: "error",
  check(ctx) {
    if (typeof ctx.fiber !== "object" || ctx.fiber === null) return;
    const type = (ctx.fiber as { type?: unknown }).type;
    if (type !== "button") return;
    const element = ctx.elements[0] ?? null;
    return [
      {
        ruleId: "runtime-bare-button",
        message: "<button> should be replaced with antd Button.",
        severity: "error",
        element,
        source: ctx.source,
      },
    ];
  },
};
