import type { Rule, RuleVisitor } from "./types.js";

/**
 * Bare HTML elements that have a direct antd equivalent and should not be hand-rolled.
 * Derived from the designer's ADUX skill rule #1 ("必须使用 Ant Design 组件").
 */
const BARE_TAGS_TO_ANTD: Record<string, string> = {
  button: "Button",
  input: "Input",
  select: "Select",
  textarea: "Input.TextArea",
  form: "Form",
  table: "Table",
  dialog: "Modal",
};

export const requireAntdComponent: Rule = {
  meta: {
    id: "require-antd-component",
    description:
      "Use Ant Design components instead of bare HTML elements for UI primitives.",
    category: "component",
    defaultSeverity: "error",
  },
  create(ctx): RuleVisitor {
    return {
      JSXOpeningElement(path) {
        const name = path.node.name;
        if (name.type !== "JSXIdentifier") return;

        const tag = name.name;
        const suggested = BARE_TAGS_TO_ANTD[tag];
        if (!suggested) return;

        const loc = path.node.loc;
        if (!loc) return;

        ctx.report({
          message: `<${tag}> should be replaced with antd ${suggested}.`,
          range: {
            start: { line: loc.start.line, column: loc.start.column },
            end: { line: loc.end.line, column: loc.end.column },
          },
        });
      },
    };
  },
};
