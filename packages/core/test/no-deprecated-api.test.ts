import { describe, expect, it } from "vitest";
import { parseSource } from "../src/ast/parser.js";
import { runRules } from "../src/lint.js";
import { RuleRegistry } from "../src/rules/registry.js";
import { noDeprecatedApi } from "../src/rules/no-deprecated-api.js";
import { parseMigrations } from "../src/migrations/loader.js";
import type { MigrationEntry } from "../src/migrations/types.js";

const FAKE_MIGRATIONS: MigrationEntry[] = [
  {
    component: "Modal",
    breaking: true,
    description: "`visible` renamed to `open`",
    searchPattern: "\\bvisible\\s*=",
    before: "visible={true}",
    after: "open={true}",
  },
  {
    component: "Dropdown",
    breaking: true,
    description: "`overlay` replaced by `menu`",
    searchPattern: "\\boverlay\\s*=",
    before: "overlay={menu}",
    after: "menu={menu}",
  },
];

function lint(
  src: string,
  migrations: MigrationEntry[] | null = FAKE_MIGRATIONS,
) {
  const file = parseSource(src, { filename: "test.tsx" });
  const reg = new RuleRegistry().register(noDeprecatedApi);
  if (migrations !== null) {
    reg.override("no-deprecated-api", { options: { migrations } });
  }
  return runRules(file, reg);
}

describe("no-deprecated-api", () => {
  it("flags Modal visible= (deprecated in v6)", () => {
    const v = lint(`export default () => <Modal visible={true}>x</Modal>;`);
    expect(v).toHaveLength(1);
    expect(v[0]!.ruleId).toBe("no-deprecated-api");
    expect(v[0]!.message).toContain("Modal");
    expect(v[0]!.message).toContain("open");
  });

  it("flags Dropdown overlay=", () => {
    const v = lint(`<Dropdown overlay={menu}><a>x</a></Dropdown>`);
    expect(v).toHaveLength(1);
    expect(v[0]!.message).toContain("Dropdown");
  });

  it("does not flag modern API (open=)", () => {
    const v = lint(`<Modal open={true}>x</Modal>`);
    expect(v).toHaveLength(0);
  });

  it("no-op when no migrations configured", () => {
    const v = lint(`<Modal visible={true}>x</Modal>`, null);
    expect(v).toHaveLength(0);
  });

  it("multiple matches in one source", () => {
    const v = lint(
      `<div><Modal visible={true}/><Dropdown overlay={x}/></div>`,
    );
    expect(v).toHaveLength(2);
  });

  it("severity is warn (soft rule, not blocking)", () => {
    const v = lint(`<Modal visible={true}>x</Modal>`);
    expect(v[0]!.severity).toBe("warn");
  });
});

describe("parseMigrations (loader)", () => {
  it("parses array root", () => {
    const result = parseMigrations(
      JSON.stringify([{ component: "X", breaking: true, description: "d" }]),
      "5",
      "6",
    );
    expect(result?.entries).toHaveLength(1);
    expect(result?.from).toBe("5");
    expect(result?.to).toBe("6");
  });

  it("parses { from, to, entries } shape", () => {
    const result = parseMigrations(
      JSON.stringify({
        from: "5",
        to: "6",
        entries: [{ component: "X", breaking: true, description: "d" }],
      }),
      "?",
      "?",
    );
    expect(result?.entries).toHaveLength(1);
    expect(result?.from).toBe("5");
  });

  it("returns null on malformed JSON", () => {
    expect(parseMigrations("not json", "5", "6")).toBeNull();
  });
});
