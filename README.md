# ADUX

Ant Design UX Assistant — 自动化 Ant Design 设计规范的生成与审查工具链。

## Status
Pre-alpha · v0.0.1 alpha baseline（2026-04-24）

当前已可运行：
- 静态审查：`adux review <file|dir|glob>`，支持 `text` / `json` / `markdown` 输出。
- 配置文件：支持 `adux.config.js` / `.mjs` / `.cjs` / `.aduxrc.json` 覆盖内置规则级别。
- 浏览器审查可视化：Vite dev 模式注入 `@adux/runtime`，在真实 React 页面中显示违规 outline 和浮窗。
- Playground：`examples/playground` 是 Vite + React + antd 的端到端验证应用。

仍未实现：
- `@adux/generator` 仍是占位包。
- `adux dev` / `adux generate` CLI 入口尚未实现。
- 飞书 bot、PR 集成、npm 发布流程尚未实现。

设计文档：`/Users/hexu/PM流程/antdx-design-v2-working.md`  
上游能力实测：`/Users/hexu/PM流程/antd-capability-probe.md`  
Runtime 选型调研：`/Users/hexu/PM流程/adux-runtime-research.md`  
飞书使用指南：`https://www.feishu.cn/docx/Oc5CdyWvKoY4Arx2KOBcZFAJnbe`

## Packages
- `@adux/core` — AST 解析、规则框架、8 条静态规则、reporter、MCP/migration 基础能力。
- `@adux/cli` — CLI，目前实现 `adux review`。
- `@adux/runtime` — 浏览器运行时，基于 Bippy 监听 React commit，输出 runtime violations。
- `@adux/vite-plugin` — Vite dev 插件，注入 runtime，并提供 open-editor middleware。
- `@adux/playground` — Vite + React + antd 验证应用。
- `@adux/generator` — 占位包。

## Usage

```bash
pnpm install
pnpm build

# 静态审查
pnpm --filter @adux/cli build
node packages/cli/dist/bin.js review examples/playground/src/App.tsx --format text

# 浏览器 overlay
pnpm --filter @adux/playground dev
```

### Config

```js
// adux.config.cjs
module.exports = {
  rules: {
    "require-antd-component": "error",
    "design-token-only": "warn",
    "no-deprecated-api": "off",
  },
};
```

规则值可以是 `"error"`、`"warn"`、`"off"`，也可以写成 `{ severity, options }` 或 `[severity, options]`。

## Development
Requires Node >= 20 and pnpm 9.

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

当前基线已验证：
- `pnpm -r test`：99 tests pass
- `pnpm -r typecheck`：pass
- `pnpm -r build`：pass
