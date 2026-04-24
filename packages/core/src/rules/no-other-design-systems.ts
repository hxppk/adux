import type { Rule, RuleVisitor } from "./types.js";

/**
 * Packages that are strongly-owned UI libraries competing with antd.
 * Tailwind is CSS-layer so not detectable via imports — covered by a future
 * className-scanning rule (use-antd-layout).
 */
const FORBIDDEN_PACKAGES: readonly string[] = [
  "@arco-design/web-react",
  "@arco-design/web-vue",
  "@material-ui/core",
  "element-plus",
  "element-react",
  "element-ui",
  "@chakra-ui/react",
  "semantic-ui-react",
];

const FORBIDDEN_PREFIXES: readonly string[] = [
  "@arco-design/",
  "@mui/",
  "@material-ui/",
  "@chakra-ui/",
];

export const noOtherDesignSystems: Rule = {
  meta: {
    id: "no-other-design-systems",
    description:
      "Do not mix other UI libraries (Arco / MUI / Element / Chakra / Semantic) with Ant Design.",
    category: "component",
    defaultSeverity: "error",
  },
  create(ctx): RuleVisitor {
    return {
      ImportDeclaration(path) {
        const src = path.node.source.value;
        if (typeof src !== "string") return;
        const forbidden =
          FORBIDDEN_PACKAGES.includes(src) ||
          FORBIDDEN_PREFIXES.some((p) => src.startsWith(p));
        if (!forbidden) return;
        const loc = path.node.loc;
        if (!loc) return;
        ctx.report({
          message: `Import from "${src}" — do not mix other design systems with Ant Design.`,
          range: {
            start: { line: loc.start.line, column: loc.start.column },
            end: { line: loc.end.line, column: loc.end.column },
          },
        });
      },
    };
  },
};
