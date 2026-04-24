import { describe, expect, it } from "vitest";
import { parseSource } from "../src/ast/parser.js";
import { runRules } from "../src/lint.js";
import { RuleRegistry } from "../src/rules/registry.js";
import { useAntdIcons } from "../src/rules/use-antd-icons.js";

function lint(src: string) {
  const file = parseSource(src, { filename: "test.tsx" });
  const registry = new RuleRegistry().register(useAntdIcons);
  return runRules(file, registry);
}

describe("use-antd-icons", () => {
  it("flags hand-rolled <svg>", () => {
    const v = lint(
      `export default () => <svg width="16" height="16"><path d="..."/></svg>;`,
    );
    expect(v).toHaveLength(1);
    expect(v[0]!.message).toContain("@ant-design/icons");
  });

  it("does not flag SearchOutlined", () => {
    const v = lint(
      `import { SearchOutlined } from "@ant-design/icons"; export default () => <SearchOutlined/>;`,
    );
    expect(v).toHaveLength(0);
  });

  it("does not flag div or span", () => {
    const v = lint(`export default () => <div><span>x</span></div>;`);
    expect(v).toHaveLength(0);
  });

  it("reports severity=warn (soft rule)", () => {
    const v = lint(`export default () => <svg/>;`);
    expect(v[0]!.severity).toBe("warn");
  });
});
