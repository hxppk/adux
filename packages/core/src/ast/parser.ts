import { parse as babelParse } from "@babel/parser";
import type { File } from "@babel/types";
import type { ParseResult } from "./types.js";

export type Syntax = "ts" | "tsx" | "js" | "jsx";

export interface ParseOptions {
  filename?: string;
  /** When omitted, inferred from filename extension; falls back to "tsx". */
  syntax?: Syntax;
}

export function parseSource(
  source: string,
  options: ParseOptions = {},
): ParseResult {
  const filename = options.filename ?? "<input>";
  const syntax = options.syntax ?? inferSyntax(filename);

  const plugins: Array<"typescript" | "jsx"> = [];
  if (syntax === "ts" || syntax === "tsx") plugins.push("typescript");
  if (syntax === "tsx" || syntax === "jsx") plugins.push("jsx");

  const ast = babelParse(source, {
    sourceType: "module",
    sourceFilename: filename,
    plugins,
    errorRecovery: true,
  }) as unknown as File;

  return { ast, source, filename };
}

function inferSyntax(filename: string): Syntax {
  if (filename.endsWith(".tsx")) return "tsx";
  if (filename.endsWith(".jsx")) return "jsx";
  if (filename.endsWith(".ts")) return "ts";
  if (filename.endsWith(".js") || filename.endsWith(".mjs")) return "js";
  return "tsx";
}
