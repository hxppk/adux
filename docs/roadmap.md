# ADUX Roadmap

**当前版本**：v0.0.1 alpha（2026-04-24）
**对外使用指南权威版**：[飞书 Oc5CdyWvKoY4Arx2KOBcZFAJnbe](https://www.feishu.cn/docx/Oc5CdyWvKoY4Arx2KOBcZFAJnbe)

---

## ✅ 已完成（v0.0.1 alpha）

### 静态审查

- `@adux/core` — AST parser · Rule 框架 · MCP client · migrations loader · reporter
- `@adux/cli` — `adux review <file|dir|glob>` · text / json / markdown 三种 format
- **8 条静态规则全部实现**：
  1. `require-antd-component`
  2. `no-other-design-systems`
  3. `design-token-only`
  4. `use-antd-feedback`
  5. `use-antd-layout`
  6. `use-antd-icons`
  7. `use-form-item-rules`
  8. `no-deprecated-api`（依赖 `antd migrate` searchPattern 数据，无 antd CLI 时降级 no-op）
- `adux.config.{js,mjs,cjs}` / `.aduxrc.json` 配置加载（extends / overrides / rules 三种写法）

### 浏览器 Overlay

- `@adux/vite-plugin` — transformIndexHtml 注入 · configResolved 适配 `base` · virtual module · launch-editor endpoint
- `@adux/runtime` — Bippy fiber hook · debounce audit · Shadow DOM host · Canvas outline · Preact panel
- **2 条 runtime 规则**：`runtime-require-antd-component` · `runtime-hardcoded-color`

### 验证

- **99 tests 全绿**（core 68 + vite-plugin 9 + runtime 22）
- `pnpm -r typecheck` 全绿
- Playground（`examples/playground`）端到端验证 overlay
- 真实项目 sandbox 验证（`/Users/hexu/中心agent` 的 copy）：task detail 页 11 error · 1 warn；OA 审批表单页 37 error · 3 warn

---

## ⏳ Roadmap（按影响力排序）

### 高优先级

**R1. Runtime 规则扩展**
- [ ] `runtime-no-other-design-systems`（按 fiber displayName 检测来自其他 UI 库的组件）
- [ ] `runtime-use-antd-feedback`（拦截 `window.alert/confirm/prompt` 调用）
- [ ] `runtime-use-antd-layout`（检测活 DOM 的 computed style `display:flex`）
- [ ] `runtime-use-form-item-rules`
- [ ] **Runtime-only** 新规则：Button loading stuck >500ms · async `onClick` 无 spinner · Form 无 `validateTrigger`

**R2. 全站爬虫模式（`adux crawl`）**
- [ ] 新命令 `adux crawl <url> --routes <list>`
- [ ] 启 headless 浏览器遍历每个路由
- [ ] 注入 runtime 收集每页 `runtime.violations`
- [ ] 汇总生成全站报告（飞书 bot 审查场景的底层）

**R3. vite-plugin 零配置**
- [ ] 自动 resolve `@adux/runtime` 路径（免用户 devDep 声明）
- [ ] 通过 `require.resolve` 拿绝对路径注入，规避 pnpm 非 direct dep 不 hoist 的问题

### 中优先级

**R4. PM 原型生成（`@adux/generator`）**
- [ ] 从 `pm-antd-prototype` 迁移升级到 workspace
- [ ] 支持"一句话 → Vite + antd 项目"
- [ ] 接 MCP 校验 props

**R5. 飞书 bot 集成（`@adux/skill-hermes`）**
- [ ] 工程师贴代码 → 后台起 Vite + runtime → Playwright 截图 + overlay → 飞书回推带标注的图
- [ ] PM 生成原型 → 飞书回截图 + 预览链接
- [ ] `@bot review <PR URL>` → fetch diff → 跑静态规则 → 回 GitHub / 飞书评论

**R6. Claude Code skill 包装**
- [ ] `/adux review` 在 Claude Code 里直接调用

### 低优先级

**R7. npm 公开发布**
- [ ] 建 CHANGELOG
- [ ] 发 `@adux/*` pre-release 到 npm
- [ ] 文档迁到 GitHub Pages

**R8. 预览链接常驻服务**
- [ ] 飞书场景下不用每次跑 Playwright headless

---

## 技术债 / 已知问题

- `@adux/vite-plugin` 的单测停留在 `LEGACY_VIRTUAL_ID = "/@id/adux-runtime"`，新 `__x00__` 路径和 `configResolved` base 适配没有 test 覆盖。（2026-04-24 确认，本次未补）
- `runtimeBareButton` 和 `runtimeRequireAntdComponent` 语义重叠，下一轮直接删 `runtimeBareButton`（codex 确认的过渡期兼容 re-export）
- `adux crawl` 之前，运行时只看"当前路由"，全站视角必须走 CLI 静态审查

---

## 参考资料

- 设计稿（session 工作稿）：[docs/design/v2-working.md](design/v2-working.md)
- 上游 antd CLI 能力实测：[docs/research/antd-cli-probe.md](research/antd-cli-probe.md)
- 浏览器 overlay OSS 选型（523 行调研）：[docs/research/runtime-overlay.md](research/runtime-overlay.md)
- 完整使用指南（飞书权威 + git 快照）：[docs/usage-guide.md](usage-guide.md) · [飞书链接](https://www.feishu.cn/docx/Oc5CdyWvKoY4Arx2KOBcZFAJnbe)
