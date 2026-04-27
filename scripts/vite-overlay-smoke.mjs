#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const keep = process.env.ADUX_VITE_SMOKE_KEEP === "1";
const version =
  process.env.ADUX_NPM_VERSION ?? (await packageVersion("vite-plugin"));
const spec =
  process.env.ADUX_VITE_PLUGIN_SPEC ?? `@adux/vite-plugin@${version}`;
const tmp = await mkdtemp(path.join(tmpdir(), "adux-vite-overlay-smoke-"));
let server;

try {
  await mkdir(path.join(tmp, "src"), { recursive: true });
  await writeJson(path.join(tmp, "package.json"), {
    private: true,
    type: "module",
    scripts: {
      dev: "vite",
    },
    dependencies: {
      "@vitejs/plugin-react": "^4.3.4",
      react: "^18.3.1",
      "react-dom": "^18.3.1",
      typescript: "^5.6.3",
      vite: "^5.4.11",
    },
  });
  await writeFile(
    path.join(tmp, "index.html"),
    '<div id="root"></div><script type="module" src="/src/main.tsx"></script>\n',
    "utf8",
  );
  await writeFile(
    path.join(tmp, "src", "main.tsx"),
    [
      'import React from "react";',
      'import { createRoot } from "react-dom/client";',
      'import App from "./App";',
      'createRoot(document.getElementById("root")!).render(<App />);',
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(tmp, "src", "App.tsx"),
    [
      "export default function App() {",
      '  return <div style={{ display: "flex", color: "#ff0000", padding: 16 }}><button>Bare button</button></div>;',
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(tmp, "vite.config.ts"),
    [
      'import { defineConfig } from "vite";',
      'import react from "@vitejs/plugin-react";',
      'import adux from "@adux/vite-plugin";',
      "export default defineConfig({",
      "  plugins: [react(), adux({ runtime: { debug: true } })],",
      "});",
      "",
    ].join("\n"),
    "utf8",
  );

  await runPnpm(["install"], { cwd: tmp });
  await runPnpm(["add", "-D", spec], { cwd: tmp });

  const manifest = JSON.parse(
    await readFile(path.join(tmp, "package.json"), "utf8"),
  );
  if (manifest.devDependencies?.["@adux/runtime"]) {
    throw new Error("Smoke app must not directly install @adux/runtime");
  }

  server = spawn("corepack", ["pnpm", "dev", "--host", "127.0.0.1", "--port", "5173"], {
    cwd: tmp,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => process.stdout.write(chunk));
  server.stderr.on("data", (chunk) => process.stderr.write(chunk));

  await waitForHttp("http://127.0.0.1:5173/");
  const html = await fetchText("http://127.0.0.1:5173/");
  if (!html.includes("__x00__adux-runtime")) {
    throw new Error("Expected transformed HTML to inject ADUX runtime script");
  }

  const runtimeModule = await fetchText(
    "http://127.0.0.1:5173/@id/__x00__adux-runtime",
  );
  if (
    !runtimeModule.includes("@adux/runtime") &&
    !runtimeModule.includes("@adux_runtime")
  ) {
    throw new Error("Expected virtual runtime module to resolve @adux/runtime");
  }

  console.log(`[adux vite overlay smoke] ok (${spec})`);
  await stopServer();
  if (!keep) await rm(tmp, { recursive: true, force: true });
} catch (error) {
  await stopServer();
  console.error("[adux vite overlay smoke] failed");
  console.error(error instanceof Error ? error.stack : String(error));
  console.error(`[adux vite overlay smoke] kept temp dir: ${tmp}`);
  process.exitCode = 1;
}

async function waitForHttp(url) {
  const started = Date.now();
  while (Date.now() - started < 30000) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry until Vite starts listening.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status}`);
  }
  return response.text();
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

async function stopServer() {
  if (!server || server.killed) return;
  server.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (!server.killed) server.kill("SIGKILL");
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
