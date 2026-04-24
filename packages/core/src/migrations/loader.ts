import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { MigrationEntry, MigrationSet } from "./types.js";

const execFileAsync = promisify(execFile);

export interface LoadMigrationsOptions {
  /** antd binary. Default: "antd" (resolved via PATH or node_modules). */
  command?: string;
  /** Target major version, e.g. "6". Default: "6". */
  to?: string;
  /** Source major; default = to - 1. */
  from?: string;
  /** Timeout ms. Default: 10000. */
  timeoutMs?: number;
}

/**
 * Load `antd migrate v{from} v{to} --format json` and parse out entries.
 * Tolerant of output-shape variation (array root, .entries, .migrations).
 * Returns null on any failure — callers should fall back gracefully.
 */
export async function loadMigrations(
  opts: LoadMigrationsOptions = {},
): Promise<MigrationSet | null> {
  const { command = "antd", to = "6", timeoutMs = 10000 } = opts;
  const from = opts.from ?? String(Math.max(1, Number(to) - 1));

  try {
    const { stdout } = await execFileAsync(
      command,
      ["migrate", `v${from}`, `v${to}`, "--format", "json"],
      { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 },
    );
    return parseMigrations(stdout, from, to);
  } catch {
    return null;
  }
}

export function parseMigrations(
  stdout: string,
  from: string,
  to: string,
): MigrationSet | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return null;
  }

  const entries = coerceEntries(parsed);
  if (!entries) return null;

  // If the parsed object carries its own from/to, prefer those.
  const p = parsed as { from?: unknown; to?: unknown };
  const actualFrom = typeof p.from === "string" ? p.from : from;
  const actualTo = typeof p.to === "string" ? p.to : to;

  return { from: actualFrom, to: actualTo, entries };
}

function coerceEntries(parsed: unknown): MigrationEntry[] | null {
  if (Array.isArray(parsed)) {
    return parsed as MigrationEntry[];
  }
  const obj = parsed as { entries?: unknown; migrations?: unknown };
  if (Array.isArray(obj?.entries)) return obj.entries as MigrationEntry[];
  if (Array.isArray(obj?.migrations)) return obj.migrations as MigrationEntry[];
  return null;
}
