import type { Rule, RuleVisitor } from "./types.js";

/**
 * Flags `<Form.Item required>` without `rules`.
 *
 * In antd, the `required` attr on Form.Item only renders the `*` label marker;
 * it does NOT trigger validation. Real validation needs `rules={[{required:true,
 * message:"..."}]}`. This rule catches the common "I thought `required` was
 * enough" bug.
 */
export const useFormItemRules: Rule = {
  meta: {
    id: "use-form-item-rules",
    description:
      "Form.Item with `required` must also include `rules` — required only styles the label, it does not validate.",
    category: "feedback",
    defaultSeverity: "warn",
  },
  create(ctx): RuleVisitor {
    return {
      JSXOpeningElement(path) {
        const name = path.node.name;
        if (
          name.type !== "JSXMemberExpression" ||
          name.object.type !== "JSXIdentifier" ||
          name.object.name !== "Form" ||
          name.property.type !== "JSXIdentifier" ||
          name.property.name !== "Item"
        ) {
          return;
        }

        let hasRequired = false;
        let hasRules = false;
        for (const attr of path.node.attributes) {
          if (attr.type !== "JSXAttribute") continue;
          if (attr.name.type !== "JSXIdentifier") continue;
          if (attr.name.name === "required") hasRequired = true;
          if (attr.name.name === "rules") hasRules = true;
        }

        if (!hasRequired || hasRules) return;

        const loc = path.node.loc;
        if (!loc) return;
        ctx.report({
          message:
            "<Form.Item required> without `rules` only styles the label; add rules={[{required:true, message:'...'}]} for real validation.",
          range: {
            start: { line: loc.start.line, column: loc.start.column },
            end: { line: loc.end.line, column: loc.end.column },
          },
        });
      },
    };
  },
};
