# ADUX Roadmap

**当前版本**：v0.0.4-alpha.0（2026-04-26）
**对外使用指南权威版**：[飞书 Oc5CdyWvKoY4Arx2KOBcZFAJnbe](https://www.feishu.cn/docx/Oc5CdyWvKoY4Arx2KOBcZFAJnbe)
**v0.0.2 用户操作指南**：[飞书 PwELdQhtyopM86xqX7dcMcQvnLe](https://www.feishu.cn/docx/PwELdQhtyopM86xqX7dcMcQvnLe)

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

- **136 tests 全绿**（core 73 + vite-plugin 13 + cli 28 + runtime 22）— v0.0.3 累计（+12 tests for skill: 6 cli + 4 core, +2 audit/report 兼容）
- `pnpm -r typecheck` 全绿
- Playground（`examples/playground`）端到端验证 overlay
- 真实项目 sandbox 验证（`/Users/hexu/中心agent` 的 copy）：task detail 页 11 error · 1 warn；OA 审批表单页 37 error · 3 warn
- v0.0.2 真实项目验证（`hxppk/recommend-admin-prototype`，2026-04-26）：22 文件扫描 / 15 个有问题 / 8 error / 110 warn，三角色报告全部产出

---

## ⏳ Roadmap（按影响力排序）

### 高优先级

**R0. v0.0.2 流程清晰度** ✅ 已完成
- [x] `adux init` 自动探测 UI 库、框架、源码目录、dev 命令并生成最小配置
- [x] 显式 config schema：`designSystem` / `target` / `runtime` / `reports` / `rules`
- [x] `adux review` 支持无 path 时读取 config target；显式路径与 config.include 不再嵌套（F-bug 已修）
- [x] `adux report` 生成同一份 `issues.json` + 三角色报告产物（中文文案 + stable id + truncation banner）
- [x] **`adux audit <dir>`** 一键 init-if-needed → report → 终端三角色引导，作为 README 推荐入口
- [x] 三角色字段契约 [`docs/role-report-fields.md`](role-report-fields.md)
- [x] 真实项目验证（`hxppk/recommend-admin-prototype`：22 文件 / 8 error / 110 warn）
- [x] 用户操作指南（飞书）含三角色 init + 日常使用流程 + 4 张配图

**R1. 页面 Overlay 闭环（`adux audit --runtime` / `adux dev`）**
- [ ] 将现有 `@adux/vite-plugin` + `@adux/runtime` 接入推荐流程：启动 dev server → 打开页面 → 注入 overlay → 收集 runtime issues
- [ ] `issues.json` 合并 `origin: "runtime"`，补充 `runtime.selector` / `runtime.routeUrl` / `runtime.fiberPath` / `runtime.screenshotRef`
- [ ] Designer HTML 支持页面截图、元素高亮和 route 维度分组
- [ ] Frontend MD 对 runtime issue 降级到 selector / route，当 source location 缺失时仍可交付
- [ ] CLI 形态二选一收敛：`adux audit . --runtime`（推荐）或 `adux dev`

**R2. 一键安全修复（`adux fix`）**
- [ ] 新命令 `adux fix . --dry-run` 输出 patch，不直接写盘
- [ ] 新命令 `adux fix . --write` 只应用确定性、安全 codemod
- [ ] 首批安全修复：`<button>` → `<Button>`、`<input>` → `<Input>`、`Dropdown overlay` → `menu`、`Modal visible` → `open`
- [ ] 报告产物增加 `patch.diff`，前端可直接 review / apply
- [ ] 不确定修复（例如设计 token 选择）只给建议，不自动写死

**R3. 设计规范 Skill 输入** ✅ v0.0.3 minimal slice 已完成
- [x] 新命令 `adux skill init` 生成 `design-guidelines.md` 团队规范模板（非互动，`--force` 覆盖）
- [x] 新命令 `adux skill import <md>` 将设计师 Markdown 解析成 `adux.skill.cjs` 并自动写入 `adux.config.cjs.skills`（不重复）
- [x] config 顶层 `skills: ["./adux.skill.cjs"]`，loadAduxConfig 合并为 `config.skillRules`，按数组顺序后覆前
- [x] 优先级链：`config.rules` → `skillRules` → `RULE_HELP` → 默认；config.rules 是最终覆盖层
- [x] report 三角色 renderer 优先使用 skill 提供的 `description` / `impact` / `fix` / `docsUrl`
- [ ] **未实现（v0.0.4+）**：skill 注入新的 AST 检查规则（当前只能覆盖已有规则元数据）
- [ ] **未实现**：从飞书表格导入；规范内容覆盖 token 列表、组件 prop 要求等结构化字段
- [ ] **未实现**：`designSystem.skill` 自动加载默认 skill（避免隐式魔法，v0.0.3 仅作 metadata）

**R4. Runtime 规则扩展**
- [ ] `runtime-no-other-design-systems`（按 fiber displayName 检测来自其他 UI 库的组件）
- [ ] `runtime-use-antd-feedback`（拦截 `window.alert/confirm/prompt` 调用）
- [ ] `runtime-use-antd-layout`（检测活 DOM 的 computed style `display:flex`）
- [ ] `runtime-use-form-item-rules`
- [ ] **Runtime-only** 新规则：Button loading stuck >500ms · async `onClick` 无 spinner · Form 无 `validateTrigger`

**R5. 全站爬虫模式（`adux crawl`）**
- [ ] 新命令 `adux crawl <url> --routes <list>`
- [ ] 启 headless 浏览器遍历每个路由
- [ ] 注入 runtime 收集每页 `runtime.violations`
- [ ] 汇总生成全站报告（飞书 bot 审查场景的底层）

**R6. vite-plugin 零配置**
- [x] 自动 resolve `@adux/runtime` 路径（免用户 devDep 声明）
- [x] 通过插件自身依赖解析 runtime 入口，规避 pnpm 非 direct dep 不 hoist 的问题

### 中优先级

**R7. PM 原型生成（`@adux/generator`）**
- [ ] 从 `pm-antd-prototype` 迁移升级到 workspace
- [ ] 支持"一句话 → Vite + antd 项目"
- [ ] 接 MCP 校验 props

**R8. 飞书 bot 集成（`@adux/skill-hermes`）**
- [ ] 工程师贴代码 → 后台起 Vite + runtime → Playwright 截图 + overlay → 飞书回推带标注的图
- [ ] PM 生成原型 → 飞书回截图 + 预览链接
- [ ] `@bot review <PR URL>` → fetch diff → 跑静态规则 → 回 GitHub / 飞书评论

**R9. Claude Code skill 包装**
- [ ] `/adux review` 在 Claude Code 里直接调用

### 低优先级

**R10. 安装链路 / 公开发布** — v0.0.4 alpha 走通 GitHub tarball
- [x] CLI 用 tsup `noExternal` bundle `@adux/core`，单 tgz 自洽
- [x] 各发布包统一版本号；CLI version 从 `package.json` 动态读取
- [x] `pnpm pack:smoke` 端到端：build → pack 各包 → mkdtemp 临时项目 install cli tgz → 跑 `adux audit/skill init/skill import/audit` 全流程
- [x] `pnpm release:check`：typecheck + tests + pack:smoke 一把验证
- [x] [`docs/release-checklist.md`](release-checklist.md) 文档化版本 bump / pack / GitHub release / 验证 / rollback
- [x] README「Install / Try it」章节 + GitHub release tarball URL
- [ ] **未实现**：CHANGELOG、`@adux/*` 注册到 npm 公开 registry、`pnpm publish -r` 接入 CI、文档迁 GitHub Pages（v0.1 正式版）

**R11. 预览链接常驻服务**
- [ ] 飞书场景下不用每次跑 Playwright headless

---

## 技术债 / 已知问题

- `@adux/vite-plugin` 已补新 `__x00__` 路径、`configResolved` base 适配、runtime 入口解析的 test 覆盖。（2026-04-26）
- `runtimeBareButton` 和 `runtimeRequireAntdComponent` 语义重叠，下一轮直接删 `runtimeBareButton`（codex 确认的过渡期兼容 re-export）
- `adux crawl` 之前，运行时只看"当前路由"，全站视角必须走 CLI 静态审查

---

## 参考资料

- 设计稿（session 工作稿）：[docs/design/v2-working.md](design/v2-working.md)
- 上游 antd CLI 能力实测：[docs/research/antd-cli-probe.md](research/antd-cli-probe.md)
- 浏览器 overlay OSS 选型（523 行调研）：[docs/research/runtime-overlay.md](research/runtime-overlay.md)
- 完整使用指南（飞书权威 + git 快照）：[docs/usage-guide.md](usage-guide.md) · [飞书链接](https://www.feishu.cn/docx/Oc5CdyWvKoY4Arx2KOBcZFAJnbe)
