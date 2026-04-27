#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const publicPackages = [
  {
    dir: "packages/cli",
    name: "@adux/cli",
    required: ["bin", "files"],
  },
  {
    dir: "packages/core",
    name: "@adux/core",
    required: ["main", "types", "exports", "files"],
  },
  {
    dir: "packages/runtime",
    name: "@adux/runtime",
    required: ["main", "types", "exports", "files"],
  },
  {
    dir: "packages/vite-plugin",
    name: "@adux/vite-plugin",
    required: ["main", "types", "exports", "files"],
  },
];

const privatePackages = [
  { dir: "packages/generator", name: "@adux/generator" },
  { dir: "examples/playground", name: "@adux/playground" },
];

const errors = [];

for (const pkg of publicPackages) {
  const manifest = await readManifest(pkg.dir);
  expect(manifest.name === pkg.name, `${pkg.dir}: expected name ${pkg.name}`);
  expect(manifest.private !== true, `${pkg.name}: must not be private`);
  expect(manifest.license, `${pkg.name}: missing license`);
  expect(manifest.author, `${pkg.name}: missing author`);
  expect(manifest.repository?.url, `${pkg.name}: missing repository.url`);
  expect(
    manifest.repository?.directory === pkg.dir,
    `${pkg.name}: repository.directory must be ${pkg.dir}`,
  );
  expect(manifest.bugs?.url, `${pkg.name}: missing bugs.url`);
  expect(manifest.homepage, `${pkg.name}: missing homepage`);
  expect(
    Array.isArray(manifest.keywords) && manifest.keywords.length >= 3,
    `${pkg.name}: missing useful keywords`,
  );
  expect(
    manifest.publishConfig?.access === "public",
    `${pkg.name}: publishConfig.access must be public`,
  );
  expect(
    manifest.publishConfig?.tag === "rc",
    `${pkg.name}: publishConfig.tag must be rc before v0.1 stable`,
  );
  for (const field of pkg.required) {
    expect(manifest[field] != null, `${pkg.name}: missing ${field}`);
  }
}

const vitePlugin = await readManifest("packages/vite-plugin");
expect(
  vitePlugin.dependencies?.["@adux/runtime"] === "workspace:*",
  "@adux/vite-plugin must depend on @adux/runtime so users do not install runtime manually",
);
expect(
  !vitePlugin.peerDependencies?.["@adux/runtime"],
  "@adux/vite-plugin must not expose @adux/runtime as a user-installed peer",
);

for (const pkg of privatePackages) {
  const manifest = await readManifest(pkg.dir);
  expect(manifest.name === pkg.name, `${pkg.dir}: expected name ${pkg.name}`);
  expect(manifest.private === true, `${pkg.name}: must remain private`);
}

if (errors.length > 0) {
  console.error("[release metadata] failed");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("[release metadata] ok");

async function readManifest(dir) {
  return JSON.parse(
    await readFile(path.join(repoRoot, dir, "package.json"), "utf8"),
  );
}

function expect(condition, message) {
  if (!condition) errors.push(message);
}
