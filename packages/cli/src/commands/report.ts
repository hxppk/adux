import fs from "node:fs/promises";
import path from "node:path";
import type { AduxSkillRuleConfig, ReportInput, Violation } from "@adux/core";
import {
  activeReviewContext,
  collectReview,
  type ReviewData,
} from "./review.js";

export interface ReportOptions {
  outDir?: string;
  skillPaths?: string[];
}

export interface ReportResult {
  exitCode: number;
  outDir: string;
  output: string;
  data: ReviewData;
}

interface NormalizedIssue {
  id: string;
  origin: "static";
  file: string;
  line: number;
  column: number;
  ruleId: string;
  severity: Violation["severity"];
  message: string;
  rule: RuleReportMeta;
  location: {
    file: string;
    line: number;
    column: number;
    snippet?: string;
  };
  fix?: Violation["fix"];
}

interface RuleReportMeta {
  id: string;
  category: string;
  description: string;
  impact: string;
  fix: string;
  docsUrl?: string;
}

const RULE_HELP: Record<string, Omit<RuleReportMeta, "id">> = {
  "require-antd-component": {
    category: "component",
    description: "应使用设计系统组件替代原生 HTML 控件。",
    impact:
      "原生控件容易缺失设计系统提供的可访问性、间距、状态和交互一致性。",
    fix: "将原生 HTML 控件替换为对应的设计系统组件。",
  },
  "design-token-only": {
    category: "design-token",
    description: "视觉值应使用设计 Token，避免硬编码样式。",
    impact:
      "硬编码视觉值会偏离主题，也会让品牌换肤、暗色模式和统一调整变得困难。",
    fix: "从设计 Token 中读取颜色、圆角、间距等视觉值。",
  },
  "no-other-design-systems": {
    category: "design-system",
    description: "同一产品界面内不应混用多个组件库。",
    impact:
      "混用多个设计系统会造成交互和视觉语言不一致。",
    fix: "页面内统一使用已批准的设计系统；如确有例外，需要显式隔离和说明。",
  },
  "use-antd-feedback": {
    category: "feedback",
    description: "应使用设计系统反馈组件替代浏览器原生弹窗。",
    impact:
      "浏览器原生反馈会破坏产品视觉语言，也不便统一控制样式和行为。",
    fix: "使用 message、notification、Modal 或其他设计系统反馈 API。",
  },
  "use-antd-layout": {
    category: "layout",
    description: "常见布局应优先使用设计系统布局组件。",
    impact:
      "自定义布局代码容易让间距、对齐和响应式行为不一致。",
    fix: "常见布局优先使用 Flex、Row、Col、Space 或 Layout。",
  },
  "use-antd-icons": {
    category: "icon",
    description: "应使用已批准的设计系统图标。",
    impact:
      "临时 SVG 或自定义图标不易统一对齐、换肤和维护。",
    fix: "使用已批准图标包中的图标。",
  },
  "use-form-item-rules": {
    category: "form",
    description: "必填表单项必须配置真实校验规则。",
    impact:
      "只有必填标记但没有校验规则，会让无效数据通过表单提交。",
    fix: "为 Form.Item 添加 rules，并提供面向用户的校验提示。",
  },
  "no-deprecated-api": {
    category: "migration",
    description: "避免使用已废弃的设计系统 API。",
    impact:
      "废弃 API 会增加升级风险，并可能在未来版本中失效。",
    fix: "按当前设计系统版本的迁移建议替换为新 API。",
  },
};

export async function report(
  target: string | undefined,
  options: ReportOptions = {},
): Promise<ReportResult> {
  const data = await collectReview(target, {
    skillPaths: options.skillPaths,
  });
  const outDir = resolveOutDir(data, options.outDir);
  const issueBase = await resolveIssueBase(data);
  const views = data.config?.reports?.views ?? [
    "designer",
    "frontend",
    "developer",
  ];
  await fs.mkdir(outDir, { recursive: true });

  const issues = await normalizeIssues(
    data.perFile,
    issueBase,
    data.config?.skillRules,
  );
  const byRule = countIssues(issues, (issue) => issue.ruleId);
  const byFile = countIssues(issues, (issue) => issue.file);
  const byCategory = countIssues(issues, (issue) => issue.rule.category);
  await fs.writeFile(
    path.join(outDir, "issues.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        summary: {
          ...data.summary,
          byRule,
          byFile,
          byCategory,
        },
        configPath: data.configPath,
        target: data.target,
        designSystem: data.config?.designSystem,
        skillSources: data.config?.skillSources ?? [],
        issues,
      },
      null,
      2,
    ),
    "utf8",
  );
  const written = [path.join(outDir, "issues.json")];

  if (views.includes("designer")) {
    const file = path.join(outDir, "index.html");
    await fs.writeFile(file, renderDesignerHtml(data, issues), "utf8");
    written.push(file);
  }
  if (views.includes("frontend")) {
    const file = path.join(outDir, "frontend.md");
    await fs.writeFile(file, renderFrontendMarkdown(data, issues), "utf8");
    written.push(file);
  }
  if (views.includes("developer")) {
    const file = path.join(outDir, "developer.md");
    await fs.writeFile(file, renderDeveloperMarkdown(data, issues), "utf8");
    written.push(file);
  }

  return {
    exitCode: data.summary.totalErrors > 0 ? 1 : 0,
    outDir,
    output: [
      `ADUX 报告已生成到 ${outDir}`,
      ...written.map((file) => `- ${file}`),
      "",
      ...activeReviewContext(data),
    ].join("\n"),
    data,
  };
}

function resolveOutDir(data: ReviewData, outDir?: string): string {
  if (outDir) return path.resolve(outDir);
  const configDir = data.configPath ? path.dirname(data.configPath) : process.cwd();
  return path.resolve(configDir, data.config?.reports?.outDir ?? "adux-report");
}

async function normalizeIssues(
  perFile: ReportInput[],
  issueBase: string,
  skillRules?: Record<string, AduxSkillRuleConfig>,
): Promise<NormalizedIssue[]> {
  const issues: NormalizedIssue[] = [];
  for (const file of perFile) {
    const source = await fs.readFile(file.filename, "utf8").catch(() => "");
    for (const violation of file.violations) {
      const { line, column } = violation.range.start;
      const relativeFile =
        path.relative(issueBase, file.filename) || path.basename(file.filename);
      const rule = ruleMeta(violation.ruleId, skillRules);
      issues.push({
        id: stableIssueId(relativeFile, line, column, violation.ruleId),
        origin: "static",
        file: relativeFile,
        line,
        column,
        ruleId: violation.ruleId,
        severity: violation.severity,
        message: violation.message,
        rule,
        location: {
          file: relativeFile,
          line,
          column,
          snippet: source ? snippetForLine(source, line) : undefined,
        },
        fix: violation.fix,
      });
    }
  }
  return issues;
}

function stableIssueId(
  file: string,
  line: number,
  column: number,
  ruleId: string,
): string {
  return `static:${file}:${line}:${column}:${ruleId}`;
}

async function resolveIssueBase(data: ReviewData): Promise<string> {
  if (data.configPath) return path.dirname(data.configPath);

  const stat = await fs.stat(data.target).catch(() => null);
  if (stat?.isDirectory()) return data.target;
  if (stat?.isFile()) return path.dirname(data.target);
  return process.cwd();
}

function renderDesignerHtml(data: ReviewData, issues: NormalizedIssue[]): string {
  const bySeverity = groupBy(issues, (issue) => issue.severity);
  const errorCount = bySeverity.error?.length ?? 0;
  const warnCount = bySeverity.warn?.length ?? 0;
  const visibleIssues = issues.slice(0, 100);
  const limitBanner =
    issues.length > visibleIssues.length
      ? `<p class="limit">仅显示前 ${visibleIssues.length} 条 / 共 ${issues.length} 条问题。完整结果请查看 frontend.md 或 issues.json。</p>`
      : "";
  const issueRows = visibleIssues
    .map((issue) => {
      return `<article class="issue ${issue.severity}">
  <div class="issue-head">
    <span class="severity">${escapeHtml(issue.severity)}</span>
    <span class="rule">${escapeHtml(issue.ruleId)}</span>
  </div>
  <h2>${escapeHtml(issue.message)}</h2>
  <p>${escapeHtml(issue.rule.impact)}</p>
  <p class="where">${escapeHtml(issue.file)}:${issue.line}:${issue.column}</p>
</article>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ADUX 报告</title>
  <style>
    body { margin: 0; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #202124; background: #f7f8fa; }
    main { max-width: 1080px; margin: 0 auto; padding: 32px 20px 56px; }
    header { margin-bottom: 24px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }
    .metric, .issue { background: #fff; border: 1px solid #e4e7ec; border-radius: 8px; padding: 16px; }
    .metric strong { display: block; font-size: 24px; }
    .issue { margin: 12px 0; }
    .issue-head { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
    .severity { text-transform: uppercase; font-size: 12px; font-weight: 700; color: #fff; background: #d92d20; border-radius: 999px; padding: 2px 8px; }
    .warn .severity { background: #b54708; }
    .rule { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #475467; }
    .issue h2 { margin: 0 0 8px; font-size: 16px; }
    .where { color: #667085; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .limit { background: #fff7e6; border: 1px solid #ffd591; border-radius: 8px; padding: 12px 16px; color: #874d00; }
    @media (max-width: 720px) { .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>ADUX 设计师 / 产品报告</h1>
      <p>这个视图说明哪里不符合规范，以及为什么重要。具体修复请交给前端查看 frontend.md。</p>
    </header>
    <section class="summary">
      <div class="metric"><strong>${data.summary.filesScanned}</strong> 个文件已扫描</div>
      <div class="metric"><strong>${data.summary.filesWithIssues}</strong> 个文件有问题</div>
      <div class="metric"><strong>${errorCount}</strong> 个错误</div>
      <div class="metric"><strong>${warnCount}</strong> 个警告</div>
    </section>
    ${limitBanner}
    <section>${issueRows || "<p>未发现问题。</p>"}</section>
  </main>
</body>
</html>
`;
}

function renderFrontendMarkdown(
  data: ReviewData,
  issues: NormalizedIssue[],
): string {
  const lines = [
    "# ADUX 前端修复清单",
    "",
    `已扫描 ${data.summary.filesScanned} 个文件，发现 ${data.summary.totalErrors} 个错误、${data.summary.totalWarns} 个警告。`,
    "",
  ];

  for (const issue of issues) {
    lines.push(
      `## ${issue.severity.toUpperCase()} ${issue.ruleId}`,
      "",
      `位置：\`${issue.file}:${issue.line}:${issue.column}\``,
      "",
      issue.message,
      "",
      `修复建议：${issue.fix?.description ?? issue.rule.fix}`,
    );

    if (issue.fix?.replacement) {
      lines.push("", "替换内容：", "", "```diff", issue.fix.replacement, "```");
    }
    if (issue.location.snippet) {
      lines.push("", "上下文：", "", "```tsx", issue.location.snippet, "```");
    }
    lines.push("");
  }

  if (issues.length === 0) lines.push("未发现问题。", "");
  return lines.join("\n");
}

function renderDeveloperMarkdown(
  data: ReviewData,
  issues: NormalizedIssue[],
): string {
  const config = data.config;
  return [
    "# ADUX 开发者报告",
    "",
    `配置文件：${data.configPath ? `\`${data.configPath}\`` : "未找到"}`,
    `扫描目标：\`${data.target}\``,
    `设计系统：${config?.designSystem?.name ?? "未配置"} ${config?.designSystem?.version ?? ""}`.trim(),
    `运行时：${config?.runtime?.enabled ? config.runtime.via ?? "已启用" : "未启用或未配置"}`,
    `报告视图：${(config?.reports?.views ?? ["designer", "frontend", "developer"]).join(", ")}`,
    "",
    "## 摘要",
    "",
    `- 已扫描文件：${data.summary.filesScanned}`,
    `- 有问题文件：${data.summary.filesWithIssues}`,
    `- 错误：${data.summary.totalErrors}`,
    `- 警告：${data.summary.totalWarns}`,
    "",
    "## 规则统计",
    "",
    ...renderCountSection(issues, (issue) => issue.ruleId),
    "",
    "## 文件统计",
    "",
    ...renderCountSection(issues, (issue) => issue.file),
    "",
    "## 分类统计",
    "",
    ...renderCountSection(issues, (issue) => issue.rule.category),
  ].join("\n");
}

function renderCountSection(
  issues: NormalizedIssue[],
  keyFor: (issue: NormalizedIssue) => string,
): string[] {
  if (issues.length === 0) return ["未发现问题。", ""];
  const counts = groupBy(issues, keyFor);
  return Object.entries(counts)
    .sort(([, a], [, b]) => b.length - a.length)
    .flatMap(([key, keyIssues]) => [
      `- \`${key}\`: ${keyIssues.length}`,
    ]);
}

function groupBy<T>(
  values: T[],
  keyFor: (value: T) => string,
): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};
  for (const value of values) {
    (grouped[keyFor(value)] ??= []).push(value);
  }
  return grouped;
}

function countIssues(
  issues: NormalizedIssue[],
  keyFor: (issue: NormalizedIssue) => string,
): Record<string, { total: number; error: number; warn: number }> {
  const counts: Record<string, { total: number; error: number; warn: number }> =
    {};
  for (const issue of issues) {
    const key = keyFor(issue);
    const entry = (counts[key] ??= { total: 0, error: 0, warn: 0 });
    entry.total += 1;
    entry[issue.severity] += 1;
  }
  return counts;
}

function ruleMeta(
  ruleId: string,
  skillRules?: Record<string, AduxSkillRuleConfig>,
): RuleReportMeta {
  const skill = skillRules?.[ruleId];
  return {
    id: ruleId,
    ...(RULE_HELP[ruleId] ?? defaultHelp()),
    ...ruleMetaFromSkill(skill),
  };
}

function ruleMetaFromSkill(
  skill: AduxSkillRuleConfig | undefined,
): Partial<Omit<RuleReportMeta, "id">> {
  if (!skill) return {};
  const meta = {
    category: skill.category,
    description: skill.description,
    impact: skill.impact,
    fix: skill.fix,
    docsUrl: skill.docsUrl,
  };
  return Object.fromEntries(
    Object.entries(meta).filter(([, value]) => value !== undefined),
  );
}

function defaultHelp(): Omit<RuleReportMeta, "id"> {
  return {
    category: "custom",
    description: "实现应与当前配置的设计系统保持一致。",
    impact: "这个问题可能导致界面与当前设计系统不一致。",
    fix: "根据规则提示调整实现，使其符合当前设计系统。",
  };
}

function snippetForLine(source: string, line: number): string {
  const lines = source.split(/\r?\n/);
  const start = Math.max(1, line - 2);
  const end = Math.min(lines.length, line + 2);
  const width = String(end).length;
  const snippet: string[] = [];
  for (let current = start; current <= end; current += 1) {
    const marker = current === line ? ">" : " ";
    const content = lines[current - 1] ?? "";
    snippet.push(`${marker} ${String(current).padStart(width, " ")} | ${content}`);
  }
  return snippet.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
