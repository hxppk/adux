import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/mcp/index.ts",
    "src/ast/index.ts",
    "src/rules/index.ts",
    "src/reporter/index.ts",
    "src/config/index.ts",
    "src/migrations/index.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node20",
});
