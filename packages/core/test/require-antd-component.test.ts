import { describe, expect, it } from "vitest";
import { parseSource } from "../src/ast/parser.js";
import { runRules } from "../src/lint.js";
import { RuleRegistry } from "../src/rules/registry.js";
import { requireAntdComponent } from "../src/rules/require-antd-component.js";

function lint(source: string) {
  const file = parseSource(source, { filename: "test.tsx" });
  const registry = new RuleRegistry().register(requireAntdComponent);
  return runRules(file, registry);
}

describe("require-antd-component", () => {
  it("flags bare <button>", () => {
    const v = lint(
      `export default function F() { return <button>click</button>; }`,
    );
    expect(v).toHaveLength(1);
    expect(v[0]!.ruleId).toBe("require-antd-component");
    expect(v[0]!.message).toContain("Button");
  });

  it("flags bare <input>", () => {
    const v = lint(`export default () => <input />;`);
    expect(v).toHaveLength(1);
    expect(v[0]!.message).toContain("Input");
  });

  it("flags bare <form> and nested <button> separately", () => {
    const v = lint(
      `export default () => <form><button>x</button></form>;`,
    );
    expect(v).toHaveLength(2);
    const ids = v.map((x) => x.message).join("\n");
    expect(ids).toContain("Form");
    expect(ids).toContain("Button");
  });

  it("does not flag antd Button (capitalized identifier)", () => {
    const v = lint(
      `import { Button } from "antd"; export default () => <Button>x</Button>;`,
    );
    expect(v).toHaveLength(0);
  });

  it("does not flag non-primitive lowercase tags like div / span / p", () => {
    const v = lint(
      `export default () => <div><p><span>x</span></p></div>;`,
    );
    expect(v).toHaveLength(0);
  });

  it("reports accurate line/column", () => {
    const v = lint(`const F = () => (
  <div>
    <button>x</button>
  </div>
);`);
    expect(v).toHaveLength(1);
    expect(v[0]!.range.start.line).toBe(3);
  });
});
