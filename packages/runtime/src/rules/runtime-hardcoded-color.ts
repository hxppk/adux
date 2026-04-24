import type { RuntimeRule } from "../types.js";
import type { RuntimeViolation } from "../types.js";

/**
 * Runtime-only: inspects computed inline styles on live DOM elements.
 * Complements core's static `design-token-only` (which only sees source text)
 * by catching colors assigned dynamically at runtime.
 */
const HARDCODED = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))$/;
const COLOR_PROPS = ["color", "backgroundColor", "borderColor"] as const;

export const runtimeHardcodedColor: RuntimeRule = {
  id: "runtime-hardcoded-color",
  description:
    "Inline color should come from theme tokens, not hex/rgba literals.",
  severity: "warn",
  check(ctx) {
    const out: RuntimeViolation[] = [];
    for (const el of ctx.elements) {
      const style = (el as HTMLElement).style;
      if (!style) continue;
      for (const prop of COLOR_PROPS) {
        const val = style[prop];
        if (val && HARDCODED.test(val)) {
          out.push({
            ruleId: "runtime-hardcoded-color",
            message: `Inline ${prop}: ${val} — use theme tokens instead.`,
            severity: "warn",
            element: el,
            source: ctx.source,
          });
        }
      }
    }
    return out;
  },
};
