# Role-Aware Report Fields (v0.0.2)

`adux report` 产出三类视图，**底层只有一份 normalized `issues.json`**，三个 renderer 在不同字段子集上工作。本文档是 issues.json schema 与三视图字段映射的契约。

## Skill 字段穿透（v0.0.3+）

设计师可以在 `adux.skill.cjs`（或源 `design-guidelines.md`）里**覆盖任何内置规则的说明文案与严重级**。优先级链：

```
config.rules (severity/options)        ← 用户最终覆盖
  ↑ 覆盖
config.skillRules (从 config.skills 合并)
  ↑ 覆盖
RULE_HELP 内置兜底
  ↑ 覆盖
defaultHelp() 默认文案
```

**字段映射**

| Issue 字段 | 来源（按优先级取） |
|---|---|
| `rule.description` | skillRules\[id\].description → RULE_HELP\[id\].description → defaultHelp |
| `rule.impact` | skillRules\[id\].impact → RULE_HELP\[id\].impact → defaultHelp |
| `rule.fix` | skillRules\[id\].fix → RULE_HELP\[id\].fix → defaultHelp |
| `rule.docsUrl` | skillRules\[id\].docsUrl → RuleMeta.docsUrl |
| `rule.category` | skillRules\[id\].category → RULE_HELP\[id\].category → "custom" |
| `severity` | config.rules → skillRules\[id\].severity → 内置默认 |
| `options` | config.rules → skillRules\[id\].options → 内置默认 |

**这意味着**：设计师改了 `design-guidelines.md` 的某条 rule 的 `impact` / `fix`，跑 `adux audit` 就会让设计师视图（`index.html`）的副段落、前端视图（`frontend.md`）的「修复建议」立刻按团队语境呈现，**不需要前端改任何代码**。

**v0.0.3 边界**：skill 只能覆盖**已存在**的 ruleId 的元数据；无法新建 AST 检查规则。未知 ruleId 在 `config.skillRules` 里会被静默忽略（不会触发任何检查）。

---

## i18n 约定

- **机器可读字段保持英文**：`schemaVersion` / `origin` / `ruleId` / `severity` / `category` / `byRule` / `location.file` 等所有 schema key、ruleId 取值（如 `require-antd-component`）、CSS 类名、CLI 命令名 — 不本地化
- **面向用户的渲染文案使用中文**：designer html 标题与 banner、frontend.md 章节标题与 label、developer.md 小标题、RULE_HELP 的 description/impact/fix
- 后续若做多语言（v0.0.3+），通过 `reports.locale` 配置 + 渲染层 lookup table 切换，**不影响 issues.json 字段名**

---

## 1. `issues.json` Schema

```ts
interface IssuesReport {
  schemaVersion: number;            // 当前 1
  summary: Summary;
  configPath?: string;              // 解析到的 adux.config.* 绝对路径
  target: string;                   // review 入参或 config.target.root 解析后的绝对路径
  designSystem?: {                  // 来自 config.designSystem
    name: string;                   // antd | arco | semi | custom
    version?: string;
    adapter?: string;               // e.g. @adux/adapter-antd
    skill?: string;
    preset?: string;
  };
  issues: Issue[];
}

interface Summary {
  filesScanned: number;
  filesWithIssues: number;
  totalErrors: number;
  totalWarns: number;
  byRule: Record<string, CountBreakdown>;       // ruleId -> 计数
  byFile: Record<string, CountBreakdown>;       // 相对路径 -> 计数
  byCategory: Record<string, CountBreakdown>;   // RuleMeta.category -> 计数
}

interface CountBreakdown {
  total: number;
  error: number;
  warn: number;
}

interface Issue {
  id: string;                       // 稳定 id：`static:<file>:<line>:<column>:<ruleId>`
  origin: "static" | "runtime";     // v0.0.2 只产出 "static"，"runtime" 为 R1 预留
  file: string;                     // 相对 issueBase 的路径（向后兼容字段）
  line: number;                     // 1-based（向后兼容字段）
  column: number;                   // 1-based（向后兼容字段）
  ruleId: string;                   // 向后兼容字段
  severity: "error" | "warn";
  message: string;                  // rule 实例化时拼好的人类可读句子
  rule: {
    id: string;
    category: string;               // RuleMeta.category，用于 byCategory 聚合
    description: string;            // RuleMeta.description
    impact: string;                 // RULE_HELP[ruleId].impact，给 designer/PM 看
    fix: string;                    // RULE_HELP[ruleId].fix，frontend 兜底建议
    docsUrl?: string;               // RuleMeta.docsUrl —— 当前 v0.0.2 字段保留，规则尚未填充
  };
  location: {
    file: string;                   // 同顶层 file（结构化版本）
    line: number;
    column: number;
    snippet?: string;               // 可选：命中行 ±2 行源码片段
  };
  fix?: {                           // 来自 Violation.fix（rule 在 emit 时附带的可机械修复信息）
    description: string;
    replacement?: string;           // 有 replacement 表示一键 codemod 可行
  };
}
```

**字段重复策略**：`file` / `line` / `column` / `ruleId` 同时出现在顶层和 `rule` / `location` 子对象里，**保留顶层是为了兼容 v0.0.1 消费者**（脚本/简单 grep）。新接入者请优先使用 `rule` + `location` 结构化子对象。

**id 稳定性**：`id` 由 `<origin>:<file>:<line>:<column>:<ruleId>` 拼成，**run-to-run 在源码不变时保持稳定**，可用于 PR diff、issue tracker 关联。重排文件不会改变 id。

---

## 2. Designer / PM View（`index.html`）

**目的**：让设计师 / 产品 / 设计 review 人理解"哪里出了什么问题、为什么重要"。**文件 path / 行号不作为主信息展示**（仅作 `where` 小字给定位参考），修复细节完全不展示。

**渲染样例**：
- 页面标题：`ADUX 设计师 / 产品报告`
- Metric 卡 4 个：`N 个文件已扫描` / `N 个文件有问题` / `N 个错误` / `N 个警告`
- Truncation banner（>100 时）：`仅显示前 100 条 / 共 N 条问题。完整结果请查看 frontend.md 或 issues.json。`

**用字段**：
- `summary.filesScanned` / `filesWithIssues` / `totalErrors` / `totalWarns` — 顶部 metric 卡
- `issues[].severity` — 视觉等级标签
- `issues[].rule.id` — 规则名（小字 mono）
- `issues[].message` — 主标题（"做错了什么"）
- `issues[].rule.impact` — 副段落（"为什么不能这样"，由 RULE_HELP 提供中文）
- `issues[].file` + `issues[].line` + `issues[].column` — 仅作 `where` 末行小字，方便回答"在哪页"

**不用字段**：
- `issues[].fix` / `rule.fix` — 修复建议是前端工作面，不展示
- `issues[].location.snippet` — 源码片段不展示
- `issues[].id` — id 是机器字段
- `summary.byRule` / `byFile` / `byCategory` — 暂不在 HTML 渲染（可能 v0.0.3 加饼图）

**截断规约**（F3 修订）：
- 当 `issues.length > 100` 时，**只渲染前 100 条**，并在列表前加 banner：「仅显示前 100 条 / 共 N 条问题。完整结果请查看 frontend.md 或 issues.json。」
- 截断不应静默；后续可由 `reports.maxIssues` 配置覆写默认 100

**未来字段**：
- `issues[].runtime?.screenshot` — 等 R2 crawl 接入后渲染缩略图

---

## 3. Frontend View（`frontend.md`）

**目的**：前端工程师按报告 fix 代码。要求**复制即用**：文件位置、规则、修复建议、可选的可粘贴片段。

**渲染样例**：
- 文件标题：`# ADUX 前端修复清单`
- 顶部总览：`已扫描 N 个文件，发现 X 个错误、Y 个警告。`
- 每条 issue 的 label：`修复建议：` / `替换内容：` / `上下文：`

**用字段**：
- `summary.filesScanned` / `totalErrors` / `totalWarns` — 顶部一句话总览
- 每个 issue：
  - `severity.toUpperCase()` + `ruleId` — H2 标题（severity 显示为 ERROR/WARN 大写英文，作为视觉锚点保留英文）
  - `location.file:line:column` — 代码块包起来便于点击 / 复制
  - `message` — 命中描述
  - `fix.description` ?? `rule.fix` — `修复建议：` 后内容，rule 提供的精确建议优先于 RULE_HELP 中文兜底
  - `fix.replacement` — 如有，`替换内容：` 段，渲染成 ```` ```diff ```` 或可粘贴 snippet

**不用字段**：
- `rule.impact` — 前端不需要"为什么"叙事，知道 rule 名足够
- `rule.docsUrl` — 可选，建议在 ruleId 旁边作链接（v0.0.2 不强制）
- `summary.byCategory` — 暂不展示
- `designSystem` — 暂不展示

**字段命名约定**：frontend.md 里 location 写法统一 `path/to/file.tsx:line:col`（**冒号分隔，无空格**），便于编辑器 jump-to-line 协议识别（VSCode `cmd+click`、JetBrains 等都识别这种格式）。

---

## 4. Developer View（`developer.md`）

**目的**：让规则作者 / config 维护者调试"为什么这条规则在这个 severity"、"config 从哪来"、"哪些规则跑了多少次"。

**渲染样例**：
- 文件标题：`# ADUX 开发者报告`
- 顶部元信息行：`配置文件:` / `扫描目标:` / `设计系统:` / `运行时:` / `报告视图:`
- 小节标题：`## 摘要` / `## 规则统计` / `## 文件统计` / `## 分类统计`
- 缺省占位：configPath 缺失渲染为 `未找到`；runtime 未启用渲染为 `未启用或未配置`

**用字段**：
- 顶部元信息块：
  - `configPath` — 解析到的 config（或渲染为「未找到」）
  - `target` — 实际扫描根
  - `designSystem.name` + `version` — config 配置的 design system
  - `config.runtime.enabled` + `via` — runtime overlay 状态
  - `config.reports.views` — 启用的 view 列表
- `summary` 全字段（含 `byRule` / `byFile` / `byCategory`）
- `summary.byRule` 排序后渲染为列表（current 实现已有）
- 未来：每个 issue 的 `severitySource` —— `default` / `config.rules` / `extends` / `overrides`，**当前 v0.0.2 未填**，flagged 给后续 PR

**不用字段**：
- `issues[].rule.impact` — developer 关心机制，不关心叙事
- `issues[].location.snippet` — 已在 frontend.md / IDE 跳转里，避免冗余

**未来字段**：
- `severitySource` — 让 dev 一眼看"为什么 warn 不是 error"
- `runtime?.fiberPath` — runtime 来源 issue 的 fiber 调用栈
- `errors[]`(parser 失败 / config 加载警告) — 当前没有结构化错误产物

---

## 5. Stable ID 规约（F1）

格式：`<origin>:<file>:<line>:<column>:<ruleId>`

- `<origin>` — `static` 或 `runtime`
- `<file>` — 相对 issueBase 的路径（不含项目外绝对路径，避免泄漏机器信息）
- 同一源码 + 同一规则版本 → 同一 id
- 文件重命名 / 行号偏移会改变 id，这是预期行为（PR diff 时 reviewer 应能看到 "解决 N 条 + 新增 M 条"）
- **不**将 message 文本纳入 id，因 message 可能包含规则演进时变化的措辞

消费方建议：
- PR comment bot 用 id 去重（同一 issue 多次扫描不重复评论）
- Issue tracker 集成时把 id 当 external_ref

---

## 6. Truncation 规约（F3）

- Designer HTML：硬上限 100，超出加 banner，提示读 `frontend.md` / `issues.json`
- Frontend MD：**不截断**（前端要看全集）
- Developer MD：**不截断**（debug 时要看全集）
- `issues.json`：**不截断**（机器消费）
- 配置覆写：未来 `reports.maxIssues?: number` 或 `reports.designerMaxIssues?: number`

---

## 7. Runtime（R1）接入要求

R1 把 `runtime-*` 规则的运行时违规也合并到同一份 `issues.json`：

- `origin: "runtime"`
- 顶层 `file` / `line` / `column` 仍要填（来自 fiber `_debugSource` 或 source map）；无 source 信息时填 `"<runtime>"` + line:0:0 占位
- 新增可选块：
  ```ts
  runtime?: {
    selector?: string;       // CSS selector / `[data-testid]`
    fiberPath?: string;      // App > Layout > MyForm > Button
    screenshotRef?: string;  // adux-report/screenshots/<id>.png 相对路径
    routeUrl?: string;       // crawl 模式下命中所在的 URL
  }
  ```
- `summary.byOrigin?: { static: number; runtime: number }` — 加聚合便于 dev 调试比例
- `id` 形如 `runtime:<routeUrl-or-file>:<selector>:<ruleId>`

三视图渲染调整（R1 落地时）：
- Designer HTML：runtime 来源 issue 显示 `screenshotRef` 缩略图 + `selector`
- Frontend MD：runtime issue 也写 `location.file:line` 字段，缺失时降级为 `selector`
- Developer MD：列出 `byOrigin` 比例

---

## 变更管理

- 本文档与 `packages/cli/src/commands/report.ts` 的 `NormalizedIssue` 形状**一一对应**
- schema 任何字段增减必须：
  1. 升 `schemaVersion`
  2. 同步本文档
  3. 在 PR 描述里说明 breaking / additive
