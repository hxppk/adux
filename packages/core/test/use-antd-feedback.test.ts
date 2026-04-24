import { describe, expect, it } from "vitest";
import { parseSource } from "../src/ast/parser.js";
import { runRules } from "../src/lint.js";
import { RuleRegistry } from "../src/rules/registry.js";
import { useAntdFeedback } from "../src/rules/use-antd-feedback.js";

function lint(src: string) {
  const file = parseSource(src, { filename: "test.tsx" });
  const registry = new RuleRegistry().register(useAntdFeedback);
  return runRules(file, registry);
}

describe("use-antd-feedback", () => {
  it("flags alert()", () => {
    const v = lint(`const f = () => { alert("done"); };`);
    expect(v).toHaveLength(1);
    expect(v[0]!.message).toContain("alert");
    expect(v[0]!.message).toContain("message");
  });

  it("flags window.confirm()", () => {
    const v = lint(`if (window.confirm("ok?")) {}`);
    expect(v).toHaveLength(1);
    expect(v[0]!.message).toContain("confirm");
  });

  it("flags prompt()", () => {
    const v = lint(`const name = prompt("name?");`);
    expect(v).toHaveLength(1);
  });

  it("flags window.alert in assignment", () => {
    const v = lint(`const f = () => { window.alert("x"); };`);
    expect(v).toHaveLength(1);
  });

  it("does not flag antd message.info", () => {
    const v = lint(
      `import { message } from "antd"; message.info("done");`,
    );
    expect(v).toHaveLength(0);
  });

  it("does not flag unrelated method named info", () => {
    const v = lint(`console.info("hi");`);
    expect(v).toHaveLength(0);
  });
});
