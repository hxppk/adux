#!/usr/bin/env node
import { spawn } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const packages = ["core", "runtime", "vite-plugin", "cli"];

const keep = process.env.ADUX_PACK_SMOKE_KEEP === "1";
const tmp = await mkdtemp(path.join(tmpdir(), "adux-pack-smoke-"));
const packDir = path.join(tmp, "packs");
const appDir = path.join(tmp, "app");

try {
  await mkdir(packDir, { recursive: true });
  await mkdir(path.join(appDir, "src"), { recursive: true });

  const version = await packageVersion("cli");
  await run("pnpm", ["-r", "run", "build"], { cwd: repoRoot });

  for (const pkg of packages) {
    await run("pnpm", ["pack", "--pack-destination", packDir], {
      cwd: path.join(repoRoot, "packages", pkg),
    });
  }

  const tarballs = await readdir(packDir);
  const cliTgz = tarballPath(tarballs, "adux-cli");
  const coreTgz = tarballPath(tarballs, "adux-core");
  const runtimeTgz = tarballPath(tarballs, "adux-runtime");
  const vitePluginTgz = tarballPath(tarballs, "adux-vite-plugin");

  await assertCliTarballIsSelfContained(cliTgz);

  await writeJson(path.join(appDir, "package.json"), {
    private: true,
    type: "module",
  });
  await run("pnpm", [
    "add",
    "-D",
    cliTgz,
  ], { cwd: appDir });

  await writeJson(path.join(appDir, "package.json"), {
    private: true,
    type: "module",
    dependencies: {
      antd: "^5.0.0",
      vite: "^5.0.0",
      "@vitejs/plugin-react": "^4.0.0",
    },
  });
  await writeFile(
    path.join(appDir, "src", "App.tsx"),
    [
      "export function App() {",
      '  return <button style={{ color: "#ff0000" }}>Save</button>;',
      "}",
      "",
    ].join("\n"),
    "utf8",
  );

  const aduxBin = path.join(
    appDir,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "adux.cmd" : "adux",
  );
  const versionResult = await run(aduxBin, ["--version"], { cwd: appDir });
  if (!versionResult.stdout.includes(version)) {
    throw new Error(
      `Expected adux --version to include ${version}, got ${JSON.stringify(
        versionResult.stdout.trim(),
      )}`,
    );
  }

  await run(aduxBin, ["init", ".", "--yes"], { cwd: appDir });
  await run(aduxBin, ["skill", "init"], { cwd: appDir });
  await run(aduxBin, ["skill", "import", "design-guidelines.md"], {
    cwd: appDir,
  });
  await run(aduxBin, ["audit", ".", "--yes"], {
    cwd: appDir,
    allowedExitCodes: [1],
  });

  const report = JSON.parse(
    await readFile(path.join(appDir, "adux-report", "issues.json"), "utf8"),
  );
  if (!Array.isArray(report.issues) || report.issues.length === 0) {
    throw new Error("Expected adux audit to produce issues.json with issues");
  }
  const configText = await readFile(path.join(appDir, "adux.config.cjs"), "utf8");
  if (!configText.includes('"skills": ["./adux.skill.cjs"]')) {
    throw new Error("Expected skill import to add ./adux.skill.cjs to config");
  }

  await run("pnpm", [
    "add",
    "-D",
    coreTgz,
    runtimeTgz,
    vitePluginTgz,
  ], { cwd: appDir });
  await run("node", [
    "--input-type=module",
    "-e",
    [
      'const core = await import("@adux/core");',
      'const runtime = await import("@adux/runtime");',
      'const plugin = await import("@adux/vite-plugin");',
      'if (typeof core.createDefaultRegistry !== "function") throw new Error("core import failed");',
      'if (typeof runtime.init !== "function") throw new Error("runtime import failed");',
      'if (typeof plugin.default !== "function") throw new Error("vite plugin import failed");',
    ].join(" "),
  ], { cwd: appDir });

  console.log(`[adux pack smoke] ok (${version})`);
  console.log(`[adux pack smoke] tarballs: ${packDir}`);
  if (!keep) await rm(tmp, { recursive: true, force: true });
} catch (error) {
  console.error("[adux pack smoke] failed");
  console.error(error instanceof Error ? error.stack : String(error));
  console.error(`[adux pack smoke] kept temp dir: ${tmp}`);
  process.exitCode = 1;
}

async function packageVersion(pkg) {
  const manifest = JSON.parse(
    await readFile(path.join(repoRoot, "packages", pkg, "package.json"), "utf8"),
  );
  return manifest.version;
}

function tarballPath(files, prefix) {
  const name = files.find((file) => file.startsWith(`${prefix}-`) && file.endsWith(".tgz"));
  if (!name) throw new Error(`Missing packed tarball for ${prefix}`);
  return path.join(packDir, name);
}

async function assertCliTarballIsSelfContained(cliTgz) {
  const result = await run("tar", ["-xOf", cliTgz, "package/package.json"]);
  const manifest = JSON.parse(result.stdout);
  if (manifest.dependencies?.["@adux/core"]) {
    throw new Error("CLI tarball still depends on @adux/core");
  }
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
