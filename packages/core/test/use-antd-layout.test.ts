import { describe, expect, it } from "vitest";
import { parseSource } from "../src/ast/parser.js";
import { runRules } from "../src/lint.js";
import { RuleRegistry } from "../src/rules/registry.js";
import { useAntdLayout } from "../src/rules/use-antd-layout.js";

function lint(src: string) {
  const file = parseSource(src, { filename: "test.tsx" });
  const registry = new RuleRegistry().register(useAntdLayout);
  return runRules(file, registry);
}

describe("use-antd-layout", () => {
  it("flags div with style display:flex", () => {
    const v = lint(
      `export default () => <div style={{ display: "flex" }}>x</div>;`,
    );
    expect(v).toHaveLength(1);
    expect(v[0]!.message).toContain("Flex");
  });

  it("flags div with className containing 'flex'", () => {
    const v = lint(`export default () => <div className="flex gap-2">x</div>;`);
    expect(v).toHaveLength(1);
  });

  it("flags div with className 'foo flex bar'", () => {
    const v = lint(
      `export default () => <div className="foo flex bar">x</div>;`,
    );
    expect(v).toHaveLength(1);
  });

  it("does not flag div with className 'flexible' (no word boundary)", () => {
    const v = lint(`export default () => <div className="flexible">x</div>;`);
    expect(v).toHaveLength(0);
  });

  it("does not flag div with style display:block", () => {
    const v = lint(
      `export default () => <div style={{ display: "block" }}>x</div>;`,
    );
    expect(v).toHaveLength(0);
  });

  it("does not flag antd Flex component", () => {
    const v = lint(
      `import { Flex } from "antd"; export default () => <Flex>x</Flex>;`,
    );
    expect(v).toHaveLength(0);
  });
});
