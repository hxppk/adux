import type { Rule, RuleContext, RuleVisitor } from "./types.js";

const COLOR_PROPS = new Set([
  "color",
  "backgroundColor",
  "borderColor",
  "outlineColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
]);

const SPACING_PROPS = new Set([
  "margin",
  "padding",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "gap",
  "rowGap",
  "columnGap",
]);

const RADIUS_PROPS = new Set([
  "borderRadius",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomLeftRadius",
  "borderBottomRightRadius",
]);

const HARDCODED_COLOR =
  /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))$/;
const PIXEL_LITERAL = /^\d+(?:\.\d+)?(px|rem|em)$/;

export const designTokenOnly: Rule = {
  meta: {
    id: "design-token-only",
    description:
      "Inline-style colors/spacing/borderRadius must come from theme tokens, not hardcoded values.",
    category: "design-token",
    defaultSeverity: "error",
  },
  create(ctx): RuleVisitor {
    return {
      JSXAttribute(path) {
        const node = path.node;
        if (node.name.type !== "JSXIdentifier" || node.name.name !== "style") {
          return;
        }
        const value = node.value;
        if (!value || value.type !== "JSXExpressionContainer") return;
        const expr = value.expression;
        if (expr.type !== "ObjectExpression") return;

        for (const prop of expr.properties) {
          if (prop.type !== "ObjectProperty") continue;
          const keyName = extractKeyName(prop.key);
          if (!keyName) continue;
          const val = prop.value;

          if (COLOR_PROPS.has(keyName) && val.type === "StringLiteral") {
            if (HARDCODED_COLOR.test(val.value)) {
              report(
                ctx,
                prop.loc,
                `${keyName}: "${val.value}" is hardcoded — use theme.useToken() or ConfigProvider tokens.`,
              );
            }
            continue;
          }

          if (SPACING_PROPS.has(keyName) || RADIUS_PROPS.has(keyName)) {
            if (val.type === "NumericLiteral") {
              report(
                ctx,
                prop.loc,
                `${keyName}: ${val.value} is hardcoded — use marginXS/paddingSM/... tokens on the 8px grid.`,
              );
            } else if (
              val.type === "StringLiteral" &&
              PIXEL_LITERAL.test(val.value)
            ) {
              report(
                ctx,
                prop.loc,
                `${keyName}: "${val.value}" is hardcoded — use marginXS/paddingSM/... tokens on the 8px grid.`,
              );
            }
          }
        }
      },
    };
  },
};

function extractKeyName(key: any): string | null {
  if (key.type === "Identifier") return key.name as string;
  if (key.type === "StringLiteral") return key.value as string;
  return null;
}

function report(ctx: RuleContext, loc: any, message: string): void {
  if (!loc) return;
  ctx.report({
    message,
    range: {
      start: { line: loc.start.line, column: loc.start.column },
      end: { line: loc.end.line, column: loc.end.column },
    },
  });
}
