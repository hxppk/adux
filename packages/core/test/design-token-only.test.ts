import { describe, expect, it } from "vitest";
import { parseSource } from "../src/ast/parser.js";
import { runRules } from "../src/lint.js";
import { RuleRegistry } from "../src/rules/registry.js";
import { designTokenOnly } from "../src/rules/design-token-only.js";

function lint(src: string) {
  const file = parseSource(src, { filename: "test.tsx" });
  const registry = new RuleRegistry().register(designTokenOnly);
  return runRules(file, registry);
}

describe("design-token-only", () => {
  it("flags hardcoded hex color", () => {
    const v = lint(`export default () => <div style={{ color: "#1677ff" }}/>;`);
    expect(v).toHaveLength(1);
    expect(v[0]!.message).toContain("color");
    expect(v[0]!.message).toContain("#1677ff");
  });

  it("flags rgba color", () => {
    const v = lint(
      `export default () => <div style={{ backgroundColor: "rgba(0,0,0,0.08)" }}/>;`,
    );
    expect(v).toHaveLength(1);
    expect(v[0]!.message).toContain("backgroundColor");
  });

  it("flags hardcoded numeric padding", () => {
    const v = lint(`export default () => <div style={{ padding: 17 }}/>;`);
    expect(v).toHaveLength(1);
    expect(v[0]!.message).toContain("padding");
  });

  it("flags hardcoded pixel string margin", () => {
    const v = lint(`export default () => <div style={{ margin: "20px" }}/>;`);
    expect(v).toHaveLength(1);
    expect(v[0]!.message).toContain("margin");
  });

  it("flags multiple violations in one style object", () => {
    const v = lint(
      `export default () => <div style={{ color: "#ff0000", padding: 23 }}/>;`,
    );
    expect(v).toHaveLength(2);
  });

  it("does not flag token expression (theme.useToken)", () => {
    const v = lint(
      `const { token } = theme.useToken(); export default () => <div style={{ color: token.colorPrimary }}/>;`,
    );
    expect(v).toHaveLength(0);
  });

  it("does not flag className", () => {
    const v = lint(`export default () => <div className="foo">x</div>;`);
    expect(v).toHaveLength(0);
  });

  it("does not flag non-design-token style props (e.g. display)", () => {
    const v = lint(`export default () => <div style={{ display: "flex" }}/>;`);
    expect(v).toHaveLength(0);
  });
});
