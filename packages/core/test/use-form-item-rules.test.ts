import { describe, expect, it } from "vitest";
import { parseSource } from "../src/ast/parser.js";
import { runRules } from "../src/lint.js";
import { RuleRegistry } from "../src/rules/registry.js";
import { useFormItemRules } from "../src/rules/use-form-item-rules.js";

function lint(src: string) {
  const file = parseSource(src, { filename: "test.tsx" });
  const registry = new RuleRegistry().register(useFormItemRules);
  return runRules(file, registry);
}

describe("use-form-item-rules", () => {
  it("flags <Form.Item required> without rules", () => {
    const v = lint(
      `export default () => <Form.Item name="x" required><Input/></Form.Item>;`,
    );
    expect(v).toHaveLength(1);
    expect(v[0]!.message).toContain("rules");
  });

  it("does not flag <Form.Item required> with rules", () => {
    const v = lint(
      `export default () => <Form.Item name="x" required rules={[{required:true}]}><Input/></Form.Item>;`,
    );
    expect(v).toHaveLength(0);
  });

  it("does not flag <Form.Item> without required", () => {
    const v = lint(
      `export default () => <Form.Item name="x"><Input/></Form.Item>;`,
    );
    expect(v).toHaveLength(0);
  });

  it("does not flag <Form.Item rules={...}> without required", () => {
    const v = lint(
      `export default () => <Form.Item name="x" rules={[{pattern:/./}]}><Input/></Form.Item>;`,
    );
    expect(v).toHaveLength(0);
  });

  it("does not flag plain <Form.Item> with neither", () => {
    const v = lint(
      `export default () => <Form.Item name="x"><Input/></Form.Item>;`,
    );
    expect(v).toHaveLength(0);
  });
});
