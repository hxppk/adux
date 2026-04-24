import { describe, expect, it } from "vitest";
import { runtimeRequireAntdComponent } from "../src/rules/runtime-require-antd-component.js";
import type { RuntimeRuleContext } from "../src/types.js";

function ctx(type: unknown): RuntimeRuleContext {
  return {
    fiber: { type },
    elements: [{ nodeType: 1 } as Element],
    displayName: typeof type === "string" ? type : undefined,
    props: {},
    source: {
      fileName: "/src/App.tsx",
      lineNumber: 12,
    },
  };
}

describe("runtimeRequireAntdComponent", () => {
  it.each([
    ["button", "Button"],
    ["input", "Input"],
    ["select", "Select"],
    ["textarea", "Input.TextArea"],
    ["form", "Form"],
    ["table", "Table"],
    ["dialog", "Modal"],
  ])("flags bare <%s> as antd %s", (tag, suggested) => {
    const violations = runtimeRequireAntdComponent.check(ctx(tag));

    expect(violations).toHaveLength(1);
    expect(violations?.[0]!.ruleId).toBe(
      "runtime-require-antd-component",
    );
    expect(violations?.[0]!.message).toContain(`<${tag}>`);
    expect(violations?.[0]!.message).toContain(suggested);
    expect(violations?.[0]!.severity).toBe("error");
    expect(violations?.[0]!.source?.lineNumber).toBe(12);
  });

  it("does not flag generic layout elements", () => {
    expect(runtimeRequireAntdComponent.check(ctx("div"))).toBeUndefined();
    expect(runtimeRequireAntdComponent.check(ctx("span"))).toBeUndefined();
  });

  it("does not flag composite components", () => {
    function Button() {}

    expect(runtimeRequireAntdComponent.check(ctx(Button))).toBeUndefined();
  });
});
