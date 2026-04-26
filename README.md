# ADUX

Ant Design UX Assistant — 自动化 Ant Design 设计规范的生成与审查工具链。

## Status
Pre-alpha · v0.0.4-alpha.0（2026-04-26）

当前已可运行：
- **一键审查（推荐入口）**：`adux audit <dir>` 自动探测项目 → 生成配置 → 跑审查 → 输出三角色报告 → 终端打印「下一步看这里」引导。
- **设计师 Skill 配置**（v0.0.3）：`adux skill init` 生成 `design-guidelines.md` 模板；`adux skill import <md>` 转成 `adux.skill.cjs` 并自动写入 `adux.config.cjs`。设计师改文案 → `adux audit` 立即让团队语境覆盖三角色报告。
- 角色化报告：`adux report` 产出 `issues.json` + 设计师/产品 HTML + 前端修复 Markdown + 开发者调试 Markdown，支持中文文案。
- 静态审查：`adux review <file|dir|glob>`，支持 `text` / `json` / `markdown` 输出。
- 配置文件：`adux init` 自动探测项目并生成 `adux.config.cjs`；配置显式声明 UI 库、检查目标、runtime 和报告视图。
- 浏览器审查可视化：Vite dev 模式注入 `@adux/runtime`，在真实 React 页面中显示违规 outline 和浮窗。
- Playground：`examples/playground` 是 Vite + React + antd 的端到端验证应用。

仍未实现：
- `@adux/generator` 仍是占位包。
- `adux dev` / `adux generate` CLI 入口尚未实现。
- 飞书 bot、PR 集成尚未实现。
- npm 公开 registry 发布尚未实现；**GitHub Release tarball alpha 已打通**（v0.0.4-alpha.0），见下方「Install / Try it」。

- 产品规划与路线图：[`docs/roadmap.md`](docs/roadmap.md)
- 设计稿：[`docs/design/v2-working.md`](docs/design/v2-working.md)
- 上游 antd CLI 能力实测：[`docs/research/antd-cli-probe.md`](docs/research/antd-cli-probe.md)
- 浏览器 overlay OSS 选型：[`docs/research/runtime-overlay.md`](docs/research/runtime-overlay.md)
- 完整使用指南（飞书权威 + git 快照）：[`docs/usage-guide.md`](docs/usage-guide.md) · [飞书链接](https://www.feishu.cn/docx/Oc5CdyWvKoY4Arx2KOBcZFAJnbe)

## Install / Try it

> v0.0.4 alpha 阶段通过 GitHub Release tarball 安装，**不需要** npm login，也不需要 `@adux` npm 组织。
> v0.1 正式版会切到 `npm install @adux/cli`。

最简流程：

```bash
mkdir adux-tryout && cd adux-tryout
pnpm init -y

# 装 CLI（已 bundle @adux/core，单个 tgz 即可跑）
pnpm add -D https://github.com/hxppk/adux/releases/download/v0.0.4-alpha.0/adux-cli-0.0.4-alpha.0.tgz

# 一键审查（项目可以是任意已存在的 antd / vite 项目）
./node_modules/.bin/adux audit /path/to/your-project --yes
```

如果想要浏览器实时 overlay（vite 项目）：

```bash
pnpm add -D \
  https://github.com/hxppk/adux/releases/download/v0.0.4-alpha.0/adux-vite-plugin-0.0.4-alpha.0.tgz \
  https://github.com/hxppk/adux/releases/download/v0.0.4-alpha.0/adux-runtime-0.0.4-alpha.0.tgz
```

并在 `vite.config.ts` 里：

```ts
import adux from "@adux/vite-plugin";

export default {
  plugins: [adux()],
};
```

> 找最新 tag：[GitHub Releases](https://github.com/hxppk/adux/releases)。
> 完整发布流程：[`docs/release-checklist.md`](docs/release-checklist.md)。

---

## Packages
- `@adux/core` — AST 解析、规则框架、8 条静态规则、reporter、MCP/migration 基础能力（已被 `@adux/cli` bundle，安装 cli 即可，不必单独装）。
- `@adux/cli` — CLI 入口，提供 `adux audit / init / review / report / skill`。
- `@adux/runtime` — 浏览器运行时，基于 Bippy 监听 React commit，输出 runtime violations。
- `@adux/vite-plugin` — Vite dev 插件，注入 runtime，并提供 open-editor middleware。
- `@adux/playground` — Vite + React + antd 验证应用（仓库内部，不发布）。
- `@adux/generator` — 占位包（不发布）。

## Usage

### 推荐：`adux audit` 一键审查

最简流程，对任意 antd / 类似项目跑一次完整审查：

```bash
pnpm install
pnpm build

# 本地开发版如果还没有 `adux` 命令，先 link 到 PATH
mkdir -p ~/.local/bin
ln -sf "$PWD/packages/cli/dist/bin.js" ~/.local/bin/adux
rehash 2>/dev/null || true

# 一键：探测 → 配置 → 审查 → 三角色报告 → 终端引导
adux audit /path/to/your-project --yes

# 已 cd 到项目根后
adux audit . --yes
```

如果不想 link，也可以直接使用完整 Node 路径：

```bash
node /path/to/adux/packages/cli/dist/bin.js audit /path/to/your-project --yes
```

终端会打印项目路径、配置位置、报告产物路径，并提示三类角色应该打开哪个文件：
- 设计师 / 产品 → `adux-report/index.html`
- 前端 → `adux-report/frontend.md`
- 开发者 / 规则维护 → `adux-report/developer.md`
- CI / 机器消费 → `adux-report/issues.json`

下次重跑只需 `adux audit .`。

### 分步命令（高级）

需要单独控制流程时使用：

```bash
# 探测并生成配置（首次）
node packages/cli/dist/bin.js init examples/playground --dry-run --yes

# 静态审查（默认 text 输出）
node packages/cli/dist/bin.js review examples/playground --format text

# 单独生成报告
node packages/cli/dist/bin.js report examples/playground --out-dir /tmp/adux-report

# 浏览器 overlay
pnpm --filter @adux/playground dev
```

### 设计师 Skill 配置（v0.0.3）

让设计师以 Markdown 写规则文案 / 严重级，覆盖三角色报告里的 `description` / `impact` / `fix`：

```bash
# 在项目根生成模板
adux skill init                                   # 默认产出 ./design-guidelines.md

# 设计师按团队语境编辑模板后，导入成 adux.skill.cjs
adux skill import design-guidelines.md            # 自动注入到 adux.config.cjs 的 skills 数组

# 重新跑 audit，三角色报告里的文案立刻按团队语境呈现
adux audit . --yes
```

`adux.config.cjs` 会自动多出一行 `skills: ["./adux.skill.cjs"]`。多个 skill 文件按数组顺序覆盖（后者赢）；`config.rules` 仍然是最终覆盖层，对 severity / options 拥有最终决定权。

字段穿透与优先级见 [`docs/role-report-fields.md`](docs/role-report-fields.md#skill-字段穿透v003)。

> 当前 v0.0.3 的 skill 只能**覆盖已有内置规则**的元数据/严重级，未来版本会支持注入新的 AST 检查规则。

### Config

```js
// adux.config.cjs
module.exports = {
  meta: {
    schemaVersion: 1,
    projectName: "your-app",
  },
  designSystem: {
    name: "antd",
    version: "5",
    adapter: "@adux/adapter-antd",
    skill: "adux-antd",
    preset: "recommended",
  },
  target: {
    mode: "repo",
    root: ".",
    include: ["src/**/*.{ts,tsx,js,jsx}"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    devServer: {
      command: "pnpm dev",
      url: "http://127.0.0.1:5173",
    },
    routes: ["/"],
  },
  runtime: {
    enabled: true,
    via: "vite-plugin",
    openEditor: true,
  },
  reports: {
    outDir: "adux-report",
    views: ["designer", "frontend", "developer"],
    screenshots: false,
  },
  rules: {
    "require-antd-component": "error",
    "design-token-only": "warn",
    "no-deprecated-api": "off",
  },
};
```

规则值可以是 `"error"`、`"warn"`、`"off"`，也可以写成 `{ severity, options }` 或 `[severity, options]`。

### Known limitation: 多源码根项目

`adux init` 当前会按 `src` → `app` → `pages` 的顺序选择第一个源码根。对于同时存在多个源码目录的项目（例如 `src/`、`frontend/`、`admin/` 并存），生成的 `target.include` 可能只覆盖其中一部分。此时需要手工扩展 `adux.config.cjs`：

```js
module.exports = {
  target: {
    mode: "repo",
    root: ".",
    include: [
      "src/**/*.{ts,tsx,js,jsx}",
      "frontend/**/*.{ts,tsx,js,jsx}",
      "admin/**/*.{ts,tsx,js,jsx}",
    ],
  },
};
```

如果只想临时扫描某个目录，也可以直接传显式路径：

```bash
adux review frontend
adux report frontend --out-dir adux-report-frontend
```

## Development
Requires Node >= 20 and pnpm 9.

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

当前基线已验证：
- `pnpm -r test`：136 tests pass（core 73 + vite-plugin 13 + cli 28 + runtime 22）
- `pnpm -r typecheck`：pass
- `pnpm -r build`：pass
