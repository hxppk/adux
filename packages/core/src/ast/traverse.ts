import babelTraverse from "@babel/traverse";
import type { ParseResult } from "./types.js";

// @babel/traverse's default export is CJS-wrapped; in ESM it can be the namespace itself.
// Reach through `.default` when present.
const traverse = (babelTraverse as unknown as { default?: typeof babelTraverse })
  .default ?? babelTraverse;

export type VisitorFn = (path: any, state?: unknown) => void;
export type Visitor = Record<string, VisitorFn>;

/** Walk a parsed AST with a Babel visitor. Thin wrapper for typing stability. */
export function walk(parsed: ParseResult, visitor: Visitor): void {
  traverse(parsed.ast as any, visitor as any);
}
