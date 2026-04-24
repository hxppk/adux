import { describe, expect, it } from "vitest";
import { parseSource } from "../src/ast/parser.js";
import { runRules } from "../src/lint.js";
import { RuleRegistry } from "../src/rules/registry.js";
import { noOtherDesignSystems } from "../src/rules/no-other-design-systems.js";

function lint(src: string) {
  const file = parseSource(src, { filename: "test.tsx" });
  const registry = new RuleRegistry().register(noOtherDesignSystems);
  return runRules(file, registry);
}

describe("no-other-design-systems", () => {
  it("flags @mui/material", () => {
    const v = lint(`import { Button } from "@mui/material";`);
    expect(v).toHaveLength(1);
    expect(v[0]!.ruleId).toBe("no-other-design-systems");
  });

  it("flags @arco-design/web-react", () => {
    const v = lint(`import { Button } from "@arco-design/web-react";`);
    expect(v).toHaveLength(1);
  });

  it("flags element-plus", () => {
    const v = lint(`import ElementPlus from "element-plus";`);
    expect(v).toHaveLength(1);
  });

  it("flags @chakra-ui/react", () => {
    const v = lint(`import { Button } from "@chakra-ui/react";`);
    expect(v).toHaveLength(1);
  });

  it("does not flag antd", () => {
    const v = lint(`import { Button } from "antd";`);
    expect(v).toHaveLength(0);
  });

  it("does not flag @ant-design/icons", () => {
    const v = lint(`import { SearchOutlined } from "@ant-design/icons";`);
    expect(v).toHaveLength(0);
  });

  it("does not flag react itself", () => {
    const v = lint(`import React from "react";`);
    expect(v).toHaveLength(0);
  });
});
