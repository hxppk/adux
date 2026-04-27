#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const expected = process.argv[2]?.replace(/^v/, "");
if (!expected) {
  console.error("Usage: node scripts/verify-release-version.mjs <version>");
  process.exit(2);
}

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const packageDirs = [
  "packages/cli",
  "packages/core",
  "packages/runtime",
  "packages/vite-plugin",
];

const versions = await Promise.all(
  packageDirs.map(async (dir) => {
    const manifest = JSON.parse(
      await readFile(path.join(repoRoot, dir, "package.json"), "utf8"),
    );
    return [manifest.name, manifest.version];
  }),
);

const mismatches = versions.filter(([, version]) => version !== expected);
if (mismatches.length > 0) {
  console.error(`[release version] expected ${expected}`);
  for (const [name, version] of mismatches) {
    console.error(`- ${name}: ${version}`);
  }
  process.exit(1);
}

console.log(`[release version] ok (${expected})`);
