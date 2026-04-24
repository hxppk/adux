import type { MigrationEntry } from "../migrations/types.js";
import type { Rule, RuleVisitor } from "./types.js";

interface NoDeprecatedApiOptions {
  migrations?: MigrationEntry[];
}

/**
 * Detect deprecated antd APIs using `searchPattern` regexes exported by
 * `antd migrate v{N-1} v{N} --format json`. No upstream coupling: if the
 * migrations data was not loaded (e.g. antd CLI unavailable), this rule is
 * a no-op.
 */
export const noDeprecatedApi: Rule = {
  meta: {
    id: "no-deprecated-api",
    description:
      "Detect deprecated antd APIs via the official migrate searchPatterns.",
    category: "deprecation",
    defaultSeverity: "warn",
  },
  create(ctx): RuleVisitor {
    const options = (ctx.options ?? {}) as NoDeprecatedApiOptions;
    const entries = options.migrations ?? [];
    if (entries.length === 0) return {};

    const compiled = entries
      .filter(
        (e): e is MigrationEntry & { searchPattern: string } =>
          typeof e.searchPattern === "string" && e.searchPattern.length > 0,
      )
      .map((e) => {
        try {
          return { re: new RegExp(e.searchPattern, "g"), entry: e };
        } catch {
          return null;
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    if (compiled.length === 0) return {};

    return {
      Program() {
        const source = ctx.file.source;
        for (const { re, entry } of compiled) {
          re.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = re.exec(source)) !== null) {
            const start = offsetToLoc(source, match.index);
            const end = offsetToLoc(source, match.index + match[0].length);
            const afterHint = entry.after ? ` → use \`${entry.after}\`` : "";
            ctx.report({
              message: `${entry.component}: ${entry.description}${afterHint}`,
              range: { start, end },
            });
            if (match[0].length === 0) re.lastIndex++;
          }
        }
      },
    };
  },
};

function offsetToLoc(
  source: string,
  offset: number,
): { line: number; column: number } {
  let line = 1;
  let column = 0;
  const clamped = Math.min(offset, source.length);
  for (let i = 0; i < clamped; i++) {
    if (source[i] === "\n") {
      line++;
      column = 0;
    } else {
      column++;
    }
  }
  return { line, column };
}
