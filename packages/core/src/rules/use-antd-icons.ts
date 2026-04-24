import type { Rule, RuleVisitor } from "./types.js";

export const useAntdIcons: Rule = {
  meta: {
    id: "use-antd-icons",
    description:
      "Prefer @ant-design/icons over hand-rolled <svg> for common icons.",
    category: "component",
    defaultSeverity: "warn",
  },
  create(ctx): RuleVisitor {
    return {
      JSXOpeningElement(path) {
        const name = path.node.name;
        if (name.type !== "JSXIdentifier" || name.name !== "svg") return;

        const loc = path.node.loc;
        if (!loc) return;
        ctx.report({
          message:
            "<svg> should likely be replaced with @ant-design/icons for common icons.",
          range: {
            start: { line: loc.start.line, column: loc.start.column },
            end: { line: loc.end.line, column: loc.end.column },
          },
        });
      },
    };
  },
};
