import fs from "node:fs/promises";
import path from "node:path";
import { findAduxConfig } from "@adux/core";
import { init, type InitResult } from "./init.js";
import { report, type ReportResult } from "./report.js";

export interface AuditOptions {
  yes?: boolean;
  outDir?: string;
  skillPaths?: string[];
}

export interface AuditResult {
  exitCode: number;
  output: string;
  outDir?: string;
  configPath?: string;
  initialized: boolean;
  report?: ReportResult;
}

export async function audit(
  targetDir = ".",
  options: AuditOptions = {},
): Promise<AuditResult> {
  const projectDir = path.resolve(targetDir);
  const existingConfigPath = await findAduxConfig(projectDir);
  let configPath = existingConfigPath ?? undefined;
  let initResult: InitResult | undefined;
  let initialized = false;

  if (!existingConfigPath) {
    initResult = await init(projectDir, {
      yes: options.yes,
      force: false,
    });

    if (!initResult.written) {
      return {
        exitCode: 0,
        output: renderCancelledGuide(initResult.output),
        configPath: initResult.path,
        initialized: false,
      };
    }

    configPath = initResult.path;
    initialized = true;
  }

  const reportResult = await withCwd(projectDir, () =>
    report(undefined, {
      outDir: options.outDir,
      skillPaths: options.skillPaths,
    }),
  );
  const artifacts = await auditArtifacts(reportResult.outDir);

  return {
    exitCode: reportResult.exitCode,
    output: renderAuditGuide({
      projectDir,
      configPath,
      initialized,
      reportResult,
      artifacts,
    }),
    outDir: reportResult.outDir,
    configPath,
    initialized,
    report: reportResult,
  };
}

async function withCwd<T>(
  cwd: string,
  callback: () => Promise<T>,
): Promise<T> {
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    return await callback();
  } finally {
    process.chdir(previous);
  }
}

function renderAuditGuide(args: {
  projectDir: string;
  configPath?: string;
  initialized: boolean;
  reportResult: ReportResult;
  artifacts: string[];
}): string {
  const { projectDir, configPath, initialized, reportResult, artifacts } = args;
  const outDir = reportResult.outDir;
  const lines = [
    "ADUX audit 完成",
    `项目：${projectDir}`,
    configPath
      ? `配置：${initialized ? "已创建" : "使用已有"} ${configPath}`
      : "配置：未找到",
    "",
    reportResult.output,
    "",
    "下一步看这里：",
    ...roleGuideLines(outDir, artifacts),
    `- 下次审查：adux audit ${sameDirHint(projectDir)}`,
    "",
    "分步命令仍可使用：adux init / adux review / adux report",
  ];

  return lines.join("\n");
}

function renderCancelledGuide(initOutput: string): string {
  return [
    initOutput,
    "",
    "ADUX audit 已停止，未生成报告。",
    "确认配置后可重新运行：adux audit . --yes",
  ].join("\n");
}

function roleGuideLines(outDir: string, artifacts: string[]): string[] {
  const available = new Set(artifacts);
  const files = [
    {
      label: "设计师 / 产品",
      action: "打开",
      file: path.join(outDir, "index.html"),
    },
    {
      label: "前端",
      action: "查看",
      file: path.join(outDir, "frontend.md"),
    },
    {
      label: "开发者",
      action: "查看",
      file: path.join(outDir, "developer.md"),
    },
    {
      label: "机器可读数据",
      action: "查看",
      file: path.join(outDir, "issues.json"),
    },
  ];

  return files
    .filter(({ file }) => available.has(file))
    .map(({ label, action, file }) => `- ${label}：${action} ${file}`);
}

function sameDirHint(projectDir: string): string {
  return projectDir === process.cwd() ? "." : projectDir;
}

async function auditArtifacts(outDir: string): Promise<string[]> {
  const files = [
    "index.html",
    "frontend.md",
    "developer.md",
    "issues.json",
  ].map((file) => path.join(outDir, file));

  const existing: string[] = [];
  for (const file of files) {
    if (await fs.stat(file).catch(() => null)) existing.push(file);
  }
  return existing;
}
