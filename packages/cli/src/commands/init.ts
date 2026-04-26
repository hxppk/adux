import fs from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { findAduxConfig, type AduxConfig } from "@adux/core";

export interface InitOptions {
  yes?: boolean;
  force?: boolean;
  dryRun?: boolean;
}

export interface InitResult {
  path: string;
  config: AduxConfig;
  output: string;
  written: boolean;
}

interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface DetectionResult {
  cwd: string;
  packageJson: PackageJson | null;
  packageManager: "pnpm" | "npm" | "yarn";
  designSystem: {
    name: string;
    version: string;
    adapter: string;
    skill: string;
    preset: string;
  };
  framework: "vite" | "next" | "react-scripts" | "unknown";
  sourceRoot: string;
  include: string[];
  devCommand?: string;
  devUrl?: string;
  routes: string[];
  existingConfigPath: string | null;
}

const DEFAULT_EXCLUDES = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/.turbo/**",
  "**/coverage/**",
];

export async function init(
  targetDir = ".",
  options: InitOptions = {},
): Promise<InitResult> {
  const cwd = path.resolve(targetDir);
  const detected = await detectProject(cwd);
  const configPath = path.join(cwd, "adux.config.cjs");

  if (detected.existingConfigPath && !options.force) {
    return {
      path: detected.existingConfigPath,
      config: configFromDetection(detected),
      written: false,
      output: [
        `ADUX config already exists: ${detected.existingConfigPath}`,
        "Use --force to overwrite adux.config.cjs.",
      ].join("\n"),
    };
  }

  const config = configFromDetection(detected);
  const configSource = renderConfig(config);
  const summary = renderDetectionSummary(detected, configPath);
  const shouldProceed = options.dryRun || options.yes || (await confirm(summary));

  if (!shouldProceed) {
    return {
      path: configPath,
      config,
      written: false,
      output: `${summary}\n\nCancelled. No files changed.`,
    };
  }

  if (!options.dryRun) {
    await fs.writeFile(configPath, configSource, "utf8");
  }

  const orphanWarning =
    options.force &&
    detected.existingConfigPath &&
    detected.existingConfigPath !== configPath
      ? [
          "",
          `Warning: ${detected.existingConfigPath} still exists and may also be discovered by ADUX.`,
          "Remove the old config when you are ready to use adux.config.cjs as the single source of truth.",
        ]
      : [];

  return {
    path: configPath,
    config,
    written: !options.dryRun,
    output: [
      summary,
      "",
      options.dryRun
        ? "Dry run. Generated config preview:"
        : `Created ${configPath}`,
      options.dryRun ? configSource.trimEnd() : "",
      ...orphanWarning,
      "",
      "Next steps:",
      "  adux review",
      "  adux report",
    ]
      .filter((line) => line !== "")
      .join("\n"),
  };
}

async function detectProject(cwd: string): Promise<DetectionResult> {
  const packageJson = await readPackageJson(cwd);
  const deps = {
    ...(packageJson?.dependencies ?? {}),
    ...(packageJson?.devDependencies ?? {}),
  };
  const packageManager = await detectPackageManager(cwd);
  const framework = await detectFramework(cwd, deps);
  const sourceRoot = await detectSourceRoot(cwd);
  const existingConfigPath = await findAduxConfig(cwd);
  const devCommand = detectDevCommand(packageJson, packageManager);
  const devUrl = await detectDevUrl(cwd, framework);

  return {
    cwd,
    packageJson,
    packageManager,
    designSystem: detectDesignSystem(deps),
    framework,
    sourceRoot,
    include: [`${sourceRoot}/**/*.{ts,tsx,js,jsx}`],
    devCommand,
    devUrl,
    routes: ["/"],
    existingConfigPath,
  };
}

async function readPackageJson(cwd: string): Promise<PackageJson | null> {
  const file = path.join(cwd, "package.json");
  const raw = await fs.readFile(file, "utf8").catch(() => null);
  if (!raw) return null;
  return JSON.parse(raw) as PackageJson;
}

async function detectPackageManager(
  cwd: string,
): Promise<DetectionResult["packageManager"]> {
  if (await findUp(cwd, "pnpm-lock.yaml")) return "pnpm";
  if (await findUp(cwd, "yarn.lock")) return "yarn";
  return "npm";
}

async function detectFramework(
  cwd: string,
  deps: Record<string, string>,
): Promise<DetectionResult["framework"]> {
  if (deps.vite || (await hasAny(cwd, ["vite.config.ts", "vite.config.js"]))) {
    return "vite";
  }
  if (deps.next || (await hasAny(cwd, ["next.config.ts", "next.config.js"]))) {
    return "next";
  }
  if (deps["react-scripts"]) return "react-scripts";
  return "unknown";
}

async function detectSourceRoot(cwd: string): Promise<string> {
  for (const candidate of ["src", "app", "pages"]) {
    if (await exists(path.join(cwd, candidate))) return candidate;
  }
  return ".";
}

function detectDevCommand(
  packageJson: PackageJson | null,
  packageManager: DetectionResult["packageManager"],
): string | undefined {
  if (!packageJson?.scripts?.dev) return undefined;
  return packageManager === "npm" ? "npm run dev" : `${packageManager} dev`;
}

async function detectDevUrl(
  cwd: string,
  framework: DetectionResult["framework"],
): Promise<string | undefined> {
  if (framework === "next") return "http://127.0.0.1:3000";
  if (framework !== "vite") return undefined;

  const viteConfigPath = await firstExisting(cwd, [
    "vite.config.ts",
    "vite.config.js",
  ]);
  const port = viteConfigPath
    ? await readPortFromFile(viteConfigPath)
    : undefined;
  return `http://127.0.0.1:${port ?? 5173}`;
}

function detectDesignSystem(
  deps: Record<string, string>,
): DetectionResult["designSystem"] {
  if (deps.antd) {
    return {
      name: "antd",
      version: majorVersion(deps.antd),
      adapter: "@adux/adapter-antd",
      skill: "adux-antd",
      preset: "recommended",
    };
  }
  if (deps["@arco-design/web-react"]) {
    return {
      name: "arco",
      version: majorVersion(deps["@arco-design/web-react"]),
      adapter: "@adux/adapter-arco",
      skill: "adux-arco",
      preset: "recommended",
    };
  }
  if (deps["@douyinfe/semi-ui"]) {
    return {
      name: "semi",
      version: majorVersion(deps["@douyinfe/semi-ui"]),
      adapter: "@adux/adapter-semi",
      skill: "adux-semi",
      preset: "recommended",
    };
  }
  return {
    name: "custom",
    version: "unknown",
    adapter: "@adux/adapter-custom",
    skill: "adux-custom",
    preset: "recommended",
  };
}

function configFromDetection(detected: DetectionResult): AduxConfig {
  return {
    meta: {
      schemaVersion: 1,
      projectName: detected.packageJson?.name ?? path.basename(detected.cwd),
    },
    designSystem: detected.designSystem,
    target: {
      mode: "repo",
      root: ".",
      include: detected.include,
      exclude: DEFAULT_EXCLUDES,
      devServer:
        detected.devCommand || detected.devUrl
          ? {
              command: detected.devCommand,
              url: detected.devUrl,
            }
          : undefined,
      routes: detected.routes,
    },
    runtime: {
      enabled: detected.framework === "vite",
      via: detected.framework === "vite" ? "vite-plugin" : "playwright-inject",
      openEditor: true,
    },
    reports: {
      outDir: "adux-report",
      views: ["designer", "frontend", "developer"],
      screenshots: false,
    },
    skills: [],
    rules: defaultRulesFor(detected.designSystem.name),
  };
}

function defaultRulesFor(
  designSystemName: string,
): NonNullable<AduxConfig["rules"]> {
  if (designSystemName === "antd") {
    return {
      "require-antd-component": "error",
      "design-token-only": "warn",
      "no-deprecated-api": "warn",
    };
  }

  return {
    "design-token-only": "warn",
  };
}

function renderConfig(config: AduxConfig): string {
  return `/** @type {import("@adux/core").AduxConfig} */
module.exports = ${formatObject(config)};
`;
}

function formatObject(value: unknown, indent = 0): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[${value.map((item) => JSON.stringify(item)).join(", ")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(
      ([, entryValue]) => entryValue !== undefined,
    );
    if (entries.length === 0) return "{}";
    const pad = " ".repeat(indent);
    const childPad = " ".repeat(indent + 2);
    const lines = entries.map(([key, entryValue]) => {
      const rendered = formatObject(entryValue, indent + 2);
      return `${childPad}${JSON.stringify(key)}: ${rendered},`;
    });
    return ["{", ...lines, `${pad}}`].join("\n");
  }
  return JSON.stringify(value);
}

function renderDetectionSummary(
  detected: DetectionResult,
  configPath: string,
): string {
  return [
    "ADUX detected:",
    `- UI library: ${detected.designSystem.name} ${detected.designSystem.version}`,
    `- App: ${detected.framework}`,
    `- Source: ${detected.sourceRoot}`,
    `- Dev command: ${detected.devCommand ?? "not detected"}`,
    `- Dev URL: ${detected.devUrl ?? "not detected"}`,
    `- Runtime overlay: ${detected.framework === "vite" ? "vite-plugin" : "playwright-inject"}`,
    "",
    `Create ${configPath}?`,
  ].join("\n");
}

async function confirm(summary: string): Promise<boolean> {
  if (!input.isTTY) return true;

  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(`${summary} [Y/n] `);
    return answer.trim() === "" || /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

async function exists(file: string): Promise<boolean> {
  return Boolean(await fs.stat(file).catch(() => null));
}

async function hasAny(cwd: string, names: string[]): Promise<boolean> {
  return Boolean(await firstExisting(cwd, names));
}

async function firstExisting(
  cwd: string,
  names: string[],
): Promise<string | null> {
  for (const name of names) {
    const file = path.join(cwd, name);
    if (await exists(file)) return file;
  }
  return null;
}

async function findUp(cwd: string, name: string): Promise<string | null> {
  let dir = cwd;
  while (true) {
    const file = path.join(dir, name);
    if (await exists(file)) return file;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

async function readPortFromFile(file: string): Promise<number | undefined> {
  const source = await fs.readFile(file, "utf8").catch(() => "");
  // TODO(v0.0.3): parse Vite config structurally instead of using a broad regex.
  const match = source.match(/\bport\s*:\s*(\d{2,5})/);
  return match?.[1] ? Number(match[1]) : undefined;
}

function majorVersion(range: string): string {
  const match = range.match(/\d+/);
  return match?.[0] ?? "unknown";
}
