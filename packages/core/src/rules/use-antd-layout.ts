import type { Rule, RuleContext, RuleVisitor } from "./types.js";

const FLEX_CLASS_TOKEN = /\bflex\b/;

export const useAntdLayout: Rule = {
  meta: {
    id: "use-antd-layout",
    description:
      "Prefer antd Flex / Row / Col / Space over raw <div> + display:flex or className='flex'.",
    category: "layout",
    defaultSeverity: "warn",
  },
  create(ctx): RuleVisitor {
    return {
      JSXOpeningElement(path) {
        const name = path.node.name;
        if (name.type !== "JSXIdentifier" || name.name !== "div") return;

        for (const attr of path.node.attributes) {
          if (attr.type !== "JSXAttribute") continue;
          if (attr.name.type !== "JSXIdentifier") continue;
          const attrName = attr.name.name;

          if (
            attrName === "style" &&
            attr.value?.type === "JSXExpressionContainer"
          ) {
            const expr = attr.value.expression;
            if (expr.type === "ObjectExpression") {
              for (const prop of expr.properties) {
                if (prop.type !== "ObjectProperty") continue;
                const key =
                  prop.key.type === "Identifier"
                    ? prop.key.name
                    : prop.key.type === "StringLiteral"
                      ? prop.key.value
                      : null;
                if (
                  key === "display" &&
                  prop.value.type === "StringLiteral" &&
                  prop.value.value === "flex"
                ) {
                  reportFlex(ctx, path.node.loc);
                  return;
                }
              }
            }
          }

          if (
            attrName === "className" &&
            attr.value?.type === "StringLiteral" &&
            FLEX_CLASS_TOKEN.test(attr.value.value)
          ) {
            reportFlex(ctx, path.node.loc);
            return;
          }
        }
      },
    };
  },
};

function reportFlex(ctx: RuleContext, loc: any): void {
  if (!loc) return;
  ctx.report({
    message:
      "<div> with flex layout — prefer antd Flex / Row / Col / Space.",
    range: {
      start: { line: loc.start.line, column: loc.start.column },
      end: { line: loc.end.line, column: loc.end.column },
    },
  });
}
