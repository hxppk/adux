import type { File } from "@babel/types";

export interface SourceLocation {
  line: number;
  column: number;
}

export interface SourceRange {
  start: SourceLocation;
  end: SourceLocation;
}

export interface ParseResult {
  ast: File;
  /** Source text, kept for diagnostics & range-based previews. */
  source: string;
  /** Logical file name for reports (may be synthetic, e.g. "<input>"). */
  filename: string;
}
