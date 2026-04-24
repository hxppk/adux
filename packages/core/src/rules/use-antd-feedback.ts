import type { Rule, RuleVisitor } from "./types.js";

const BLOCKED_GLOBALS: Record<string, string> = {
  alert: "antd message.info / message.warning / Modal.info",
  confirm: "antd Modal.confirm",
  prompt: "antd Modal with a Form.Item Input",
};

export const useAntdFeedback: Rule = {
  meta: {
    id: "use-antd-feedback",
    description:
      "Use antd message / notification / Modal / Result instead of alert() / confirm() / prompt().",
    category: "feedback",
    defaultSeverity: "error",
  },
  create(ctx): RuleVisitor {
    return {
      CallExpression(path) {
        const callee = path.node.callee;
        let name: string | null = null;

        if (callee.type === "Identifier") {
          name = callee.name;
        } else if (
          callee.type === "MemberExpression" &&
          callee.object.type === "Identifier" &&
          callee.object.name === "window" &&
          callee.property.type === "Identifier"
        ) {
          name = callee.property.name;
        }

        if (!name || !(name in BLOCKED_GLOBALS)) return;
        const loc = path.node.loc;
        if (!loc) return;

        ctx.report({
          message: `${name}() should be replaced with ${BLOCKED_GLOBALS[name]}.`,
          range: {
            start: { line: loc.start.line, column: loc.start.column },
            end: { line: loc.end.line, column: loc.end.column },
          },
        });
      },
    };
  },
};
