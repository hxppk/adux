#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const keep = process.env.ADUX_NPM_SMOKE_KEEP === "1";
const version = process.env.ADUX_NPM_VERSION ?? (await packageVersion("cli"));
const spec = process.env.ADUX_NPM_SPEC ?? `@adux/cli@${version}`;
const tmp = await mkdtemp(path.join(tmpdir(), "adux-npm-install-smoke-"));

try {
  await writeJson(path.join(tmp, "package.json"), {
    private: true,
    type: "module",
  });
  await writeFile(
    path.join(tmp, "App.tsx"),
    [
      "export function App() {",
      '  return <button style={{ color: "#ff0000" }}>Save</button>;',
      "}",
      "",
    ].join("\n"),
    "utf8",
  );

  await runPnpm(["add", "-D", spec], { cwd: tmp });
  const aduxBin = path.join(
    tmp,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "adux.cmd" : "adux",
  );
  const versionResult = await run(aduxBin, ["--version"], { cwd: tmp });
  if (!versionResult.stdout.includes(version)) {
    throw new Error(
      `Expected adux --version to include ${version}, got ${JSON.stringify(
        versionResult.stdout.trim(),
      )}`,
    );
  }
  await run(aduxBin, ["audit", ".", "--yes"], {
    cwd: tmp,
    allowedExitCodes: [1],
  });

  console.log(`[adux npm install smoke] ok (${spec})`);
  if (!keep) await rm(tmp, { recursive: true, force: true });
} catch (error) {
  console.error("[adux npm install smoke] failed");
  console.error(error instanceof Error ? error.stack : String(error));
  console.error(`[adux npm install smoke] kept temp dir: ${tmp}`);
  process.exitCode = 1;
}

async function packageVersion(pkg) {
  const manifest = JSON.parse(
    await readFile(path.join(repoRoot, "packages", pkg, "package.json"), "utf8"),
  );
  return manifest.version;
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function run(command, args, options = {}) {
  const allowedExitCodes = options.allowedExitCodes ?? [0];
  const cwd = options.cwd ?? repoRoot;
  console.log(`$ ${command} ${args.join(" ")}`);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (allowedExitCodes.includes(code ?? 0)) {
        resolve({ stdout, stderr, code: code ?? 0 });
        return;
      }
      reject(
        new Error(
          [
            `Command failed with exit code ${code}: ${command} ${args.join(" ")}`,
            stdout.trim(),
            stderr.trim(),
          ]
            .filter(Boolean)
            .join("\n"),
        ),
      );
    });
  });
}

function runPnpm(args, options = {}) {
  return run("corepack", ["pnpm", ...args], options);
}
