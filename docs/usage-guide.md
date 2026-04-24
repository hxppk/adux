> **同步自飞书文档 [Oc5CdyWvKoY4Arx2KOBcZFAJnbe](https://www.feishu.cn/docx/Oc5CdyWvKoY4Arx2KOBcZFAJnbe)。以飞书版本为权威，本 md 是 git 历史快照；飞书更新后需手动 `lark-cli docs +fetch` 再提交刷新。**

---

<callout emoji="bulb" background-color="light-blue">
**ADUX（Ant Design UX Assistant）** —— 把设计师已写好的 Ant Design 规范**工程化成可执行工具链**的产品。本文档为 **v0.0.1 alpha** 使用指南。
</callout>

## 1. 产品定位
<image token="Y2LNbhKJ8oZ17CxEBEzcHHn4n5c" width="1672" height="941" align="center"/>

*图 1：产品定位 Hero：ADUX 将静态审查与运行时可视化合在一张真实 UI 反馈闭环里。*
**设计师写规范、工程师触手可及。** ADUX 把"不该硬编码颜色"、"不该裸 `<button>`"、"必须用 `Form.Item rules` 校验"这些散在设计师 ADUX 助手 skill 里的共识，**同时**落在 **CI 静态审查**和**浏览器实时 Overlay** 两层，让审查从"代码行号"跨到"真实 UI 元素"。
### 三类用户视角

<lark-table rows="4" cols="3" header-row="true" column-widths="140,290,290">

  <lark-tr>
    <lark-td>
      **角色**
    </lark-td>
    <lark-td>
      **场景**
    </lark-td>
    <lark-td>
      **ADUX 帮你做什么**
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      前端工程师
    </lark-td>
    <lark-td>
      写代码 / PR Review / CI 门禁
    </lark-td>
    <lark-td>
      `adux review` 命令行扫代码 · pre-commit 挂 exit code 阻断 · Vite dev 模式 overlay 直接看违规位置
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      PM / 设计师
    </lark-td>
    <lark-td>
      查看原型 / 对齐规范
    </lark-td>
    <lark-td>
      浏览器里红/黄框高亮违规元素，浮窗列清单 · 一眼看出规范对齐情况，不用读代码
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      团队 Tech Lead
    </lark-td>
    <lark-td>
      推规范落地
    </lark-td>
    <lark-td>
      把设计师的 8 条 ADUX 规则变成**可机读、可自动阻断**的工具链，不再靠人肉 review 约束
    </lark-td>
  </lark-tr>
</lark-table>

### 价值一句话
<callout emoji="white_check_mark" background-color="light-green">
**看到真实 UI 上的违规，不是抽象的代码行号。**
</callout>

---

## 2. 3 分钟快速开始
<image token="DJDXbPFG8ofTZtxFCaTcHTP7nCd" width="1672" height="941" align="center"/>

*图 2：3 分钟快速开始：安装、静态扫描、浏览器 Overlay 三步跑通 ADUX。*
### ① 安装
```bash
cd ~/adux
corepack pnpm install
corepack pnpm -r build

```

要求 Node >= 20、pnpm 9（通过 corepack 自动激活，无需 sudo）。
### ② 扫一个文件
```bash
node packages/cli/dist/bin.js review src/App.tsx

```

输出：
```plaintext
src/App.tsx:7:4   ERROR  <form> should be replaced with antd Form.         [require-antd-component]
src/App.tsx:10:18 ERROR  color: "#ff0000" is hardcoded — use theme.useToken() ...  [design-token-only]
src/App.tsx:11:6  WARN   <div> with flex layout — prefer antd Flex/Row/Col/Space.  [use-antd-layout]

3 issue(s): 2 error, 1 warn

```

**Exit code**：`0` = 无 error；`1` = 至少一处 error，可直接挂 CI pre-commit 做合并门禁。
### ③ 看 Overlay 真效果
```bash
corepack pnpm --filter @adux/playground dev

```

访问 http://127.0.0.1:5173/ —— 违规元素**红框（error）/ 黄框（warn）** 直接叠加在真实 UI 上，右下浮窗 `ADUX | 1 · 4` 列出全部命中，点击条目滚到元素 + 自动打开 IDE 对应行。
---

## 3. 架构详述
<image token="REn3b77pMog0zExeBKEcct5qnwg" width="1672" height="941" align="center"/>

*图 3：5 包架构：CLI、Core、Vite Plugin、Runtime 与规划中的 Generator 的协作关系。*
ADUX 是一套 pnpm monorepo，5 个包按 **引擎 + 入口** 分层：
### 三层职责
- **引擎层（@adux/core）**：AST parser · Rule 框架 · MCP client · migrations loader · reporter。所有规则实现都在这里。
- **入口层**：
  - `@adux/cli` —— 静态审查命令行，消费 core 的规则
  - `@adux/vite-plugin` + `@adux/runtime` —— 浏览器实时 overlay，同样消费 core 的规则契约
- **规划层（⏳）**：`@adux/generator` 预留给 W2+ 阶段从 pm-antd-prototype 迁移做 PM 原型生成
### 静态 vs 运行时
<image token="We39b8Nogo4fJkx1Cjoc4lsbnrf" width="1672" height="941" align="center"/>

*图 4：静态 AST 与运行时规则互补：一个适合 CI 门禁，一个看到真实页面状态。*

<lark-table rows="5" cols="3" header-row="true" column-widths="170,280,270">

  <lark-tr>
    <lark-td>
      **维度**
    </lark-td>
    <lark-td>
      **静态 AST 规则**
    </lark-td>
    <lark-td>
      **运行时规则**
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      运行环境
    </lark-td>
    <lark-td>
      CI / pre-commit / 编辑器保存
    </lark-td>
    <lark-td>
      Vite dev 模式浏览器
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      看得到的违规
    </lark-td>
    <lark-td>
      源码文本层面：硬编码值、import 混用、API 误用
    </lark-td>
    <lark-td>
      活 DOM + fiber props + 动态样式（运行时赋值）
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      能否阻断合并
    </lark-td>
    <lark-td>
      ✅ 挂 CI exit code
    </lark-td>
    <lark-td>
      ❌ 仅开发提示，不挂 CI
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      运行时开销
    </lark-td>
    <lark-td>
      无
    </lark-td>
    <lark-td>
      Bippy fiber hook + Canvas 绘制（dev 模式专属）
    </lark-td>
  </lark-tr>
</lark-table>

推荐姿势：**CI 用静态审查做门禁 + 本地 dev 开 runtime overlay 作体验反馈**。
---

## 4. 使用场景详解
### A. 命令行静态审查 ✅
**三种扫描模式**：
```bash
# 单文件
adux review src/App.tsx

# 整个目录（默认 tsx/ts/jsx/js/mjs/cjs，自动跳过 node_modules / dist / .next / .turbo / coverage）
adux review ./src

# glob 模式
adux review "src/**/*.tsx"

```

**三种输出格式**：
```bash
adux review ./src                     # text（默认）
adux review ./src --format markdown   # Markdown 报告，可直接贴 PR 或文档
adux review ./src --format json       # 结构化，喂给其他工具消费

```

**跨文件聚合样例**：
```plaintext
src/A.tsx:3:0    ERROR  Import from "@mui/material" — do not mix ...
src/B.tsx:10:18  ERROR  color: "#ff0000" is hardcoded ...
src/C.tsx:11:6   WARN   <div> with flex layout — prefer antd Flex ...

=== ADUX summary ===
Scanned 4 file(s), 3 with issues.
Total: 17 error, 4 warn

```

### B. Vite 浏览器 Overlay ✅
**配置 vite.config.ts**：
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import adux from "@adux/vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    adux({ runtime: { debug: true } }),
  ],
});

```

启动 dev server 访问页面，违规元素 **红框（error）/ 黄框（warn）** 高亮，右下浮窗清单，点击条目：
1. `scrollIntoView` 平滑滚动到元素
1. POST `/__adux/open-editor`，直接在 IDE 打开对应源码行
**vite-plugin 配置选项**：

<lark-table rows="6" cols="3" header-row="true" column-widths="200,120,380">

  <lark-tr>
    <lark-td>
      **选项**
    </lark-td>
    <lark-td>
      **默认值**
    </lark-td>
    <lark-td>
      **说明**
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      `disabled`
    </lark-td>
    <lark-td>
      `false`
    </lark-td>
    <lark-td>
      设为 `true` 整个插件 no-op（CI 环境可以用 env guard）
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      `runtime.overlay`
    </lark-td>
    <lark-td>
      `true`
    </lark-td>
    <lark-td>
      是否渲染 Shadow DOM + Canvas + 浮窗 UI
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      `runtime.debug`
    </lark-td>
    <lark-td>
      `false`
    </lark-td>
    <lark-td>
      runtime 在 console 打 init / audit 日志
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      `runtime.severities`
    </lark-td>
    <lark-td>
      `["error", "warn"]`
    </lark-td>
    <lark-td>
      过滤要渲染的级别；`["error"]` 只看强阻断
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      `editorEndpoint`
    </lark-td>
    <lark-td>
      `/__adux/open-editor`
    </lark-td>
    <lark-td>
      浏览器 POST 打开 IDE 的路径
    </lark-td>
  </lark-tr>
</lark-table>

<callout emoji="gift" background-color="light-yellow">
当前使用需要把 `@adux/runtime` 显式写成项目 devDep（pnpm 不会把非直接依赖 hoist 给 Vite optimizeDeps 识别）。vite-plugin 零配置 resolve 规划中 ⏳。
</callout>

### C. 飞书集成 ⏳
<image token="NYwTbZzeGo6oEPxj7TncRPuun9e" width="1672" height="941" align="center"/>

*图 5：飞书未来工作流：从 @ADUX bot 请求到 Playwright 截图与审查卡片回传。*
规划三种入口：
- **工程师审查**：@ADUX bot 贴代码 → 后台起 Vite + runtime → Playwright 截图 + overlay 叠加 → 飞书回推带标注的图 + diff 建议
- **PM 原型生成**：@ADUX bot "生成用户管理 CRUD" → 触发 `@adux/generator` → 飞书回截图 + 可点预览链接
- **PR Review 自动化**：`@ADUX bot review <PR URL>` → fetch diff → 跑静态规则 → 飞书回帖含违规摘要
**当前状态**：完全未开始。
---

## 5. 规则清单
### 静态 AST 规则（8/8 ✅ 全部实现）

<lark-table rows="9" cols="4" header-row="true" column-widths="240,80,90,350">

  <lark-tr>
    <lark-td>
      **规则 ID**
    </lark-td>
    <lark-td>
      **级别**
    </lark-td>
    <lark-td>
      **分类**
    </lark-td>
    <lark-td>
      **检测内容**
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      `require-antd-component`
    </lark-td>
    <lark-td>
      error
    </lark-td>
    <lark-td>
      component
    </lark-td>
    <lark-td>
      裸 `<button>` / `<input>` / `<select>` / `<textarea>` / `<form>` / `<table>` / `<dialog>`，要求改成 antd 对应组件
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      `no-other-design-systems`
    </lark-td>
    <lark-td>
      error
    </lark-td>
    <lark-td>
      component
    </lark-td>
    <lark-td>
      import 了 Arco / MUI / Element / Chakra / Semantic 等非 antd UI 库
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      `design-token-only`
    </lark-td>
    <lark-td>
      error
    </lark-td>
    <lark-td>
      design-token
    </lark-td>
    <lark-td>
      inline style 硬编码 hex/rgba/px（color / padding / margin / borderRadius 系）
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      `use-antd-feedback`
    </lark-td>
    <lark-td>
      error
    </lark-td>
    <lark-td>
      feedback
    </lark-td>
    <lark-td>
      调用 `alert()` / `confirm()` / `prompt()`，应改成 antd `message` / `notification` / `Modal`
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      `use-antd-layout`
    </lark-td>
    <lark-td>
      warn
    </lark-td>
    <lark-td>
      layout
    </lark-td>
    <lark-td>
      `<div>` 带 `display: flex` 或 `className` 含 flex，建议 antd `Flex` / `Row` / `Col` / `Space`
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      `use-antd-icons`
    </lark-td>
    <lark-td>
      warn
    </lark-td>
    <lark-td>
      component
    </lark-td>
    <lark-td>
      手写 `<svg>`，建议用 `@ant-design/icons` 官方图标库
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      `use-form-item-rules`
    </lark-td>
    <lark-td>
      warn
    </lark-td>
    <lark-td>
      feedback
    </lark-td>
    <lark-td>
      `<Form.Item required>` 没挂 `rules` —— 只会加 `*` 标记不会真校验
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      `no-deprecated-api`
    </lark-td>
    <lark-td>
      warn
    </lark-td>
    <lark-td>
      deprecation
    </lark-td>
    <lark-td>
      基于 `antd migrate` searchPattern 检测 deprecated API（如 Modal `visible=` → `open=`）。无 antd CLI 时降级为 no-op。
    </lark-td>
  </lark-tr>
</lark-table>

### 运行时规则（2/N ⏳ 继续补齐）

<lark-table rows="3" cols="3" header-row="true" column-widths="300,100,360">

  <lark-tr>
    <lark-td>
      **规则 ID**
    </lark-td>
    <lark-td>
      **级别**
    </lark-td>
    <lark-td>
      **检测内容**
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      `runtime-require-antd-component`
    </lark-td>
    <lark-td>
      error
    </lark-td>
    <lark-td>
      Fiber.type 是 7 种 bare HTML tag 之一（button/input/select/textarea/form/table/dialog），静态规则的 runtime 同胞
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      `runtime-hardcoded-color`
    </lark-td>
    <lark-td>
      warn
    </lark-td>
    <lark-td>
      `element.style.{color, backgroundColor, borderColor}` 上的硬编码值 —— 能抓到动态赋值（静态规则做不到）
    </lark-td>
  </lark-tr>
</lark-table>

<callout emoji="construction" background-color="light-yellow">
**Runtime 规则 roadmap**：把静态 8 条都做 runtime counterpart，外加只有 runtime 能做的规则（Button loading stuck >500ms / async onClick 无 spinner / Form 无 validateTrigger 等）⏳
</callout>

---

## 6. 配置 ✅
支持 `adux.config.js` / `.mjs` / `.cjs` / `.aduxrc.json` 四种格式。CLI 从被扫描文件所在目录**向上遍历**自动查找。
```javascript
// adux.config.cjs
module.exports = {
  rules: {
    // 简写：级别字符串
    "require-antd-component": "error",
    "design-token-only": "warn",
    "no-deprecated-api": "off",

    // 数组形式：[severity, options]
    "use-antd-feedback": ["warn", { /* 规则特定选项 */ }],

    // 对象形式：{ severity, options }
    "use-antd-icons": { severity: "off" },
  },
};

```

三种写法互通，按需选用。
---

## 7. 开发者指南
### 添加一条静态规则
`packages/core/src/rules/<rule-id>.ts`:
```typescript
import type { Rule, RuleVisitor } from "./types.js";

export const myRule: Rule = {
  meta: {
    id: "my-rule",
    description: "...",
    category: "custom",
    defaultSeverity: "warn",
  },
  create(ctx): RuleVisitor {
    return {
      JSXOpeningElement(path) {
        // 访问 AST，调 ctx.report 上报违规
      },
    };
  },
};

```

**接入清单**：
1. `rules/index.ts` 导出
1. `config/defaults.ts` 注册到 `createDefaultRegistry`
1. 加 `test/<rule-id>.test.ts` 单测
1. `corepack pnpm --filter @adux/core test` 验证
### 添加一条运行时规则
`packages/runtime/src/rules/<rule-id>.ts`:
```typescript
import type { RuntimeRule } from "../types.js";

export const myRuntimeRule: RuntimeRule = {
  id: "my-runtime-rule",
  description: "...",
  severity: "error",
  check(ctx) {
    // ctx.fiber · ctx.elements · ctx.props · ctx.displayName · ctx.source
    // return violations 数组
  },
};

```

然后导出 + 注册到 `DEFAULT_RUNTIME_RULES`。
---

## 8. Roadmap ⏳
按优先级：
1. **Runtime 规则扩展**：`use-antd-feedback` / `use-antd-layout` / `use-form-item-rules` 等都做 runtime counterpart
1. **PM 原型生成**（`@adux/generator`）：从 pm-antd-prototype 迁移升级，支持"一句话 → Vite + antd 项目"
1. **飞书 bot 集成**（`@adux/skill-hermes`）：工程师贴代码 → Playwright 截图 + overlay → 飞书回推
1. **PR Review 集成**：`adux review --pr <URL>` fetch diff → 跑规则 → 回 GitHub / 飞书评论
1. **vite-plugin 零配置**：自动 resolve runtime 路径，免用户 devDep 声明
1. **npm 公开发布**：建 CHANGELOG + 发 `@adux/*` pre-release
1. **Claude Code skill 包装**：`/adux review` 可在 Claude Code 里直接调用
1. **预览链接常驻服务**：飞书场景下不用每次跑 Playwright
---

## 9. 常见问题
### Q1: 为啥不直接用 `antd lint`？
A: 实测 `@ant-design/cli 6.3.6` 的 `antd lint` 对硬编码颜色、裸 button 等常见违规**完全 0 命中**（该 CLI 首发才 1 个月，lint 功能尚在早期）。ADUX 完全自建审查规则集；但 `antd info` / `antd token` / `antd migrate` 这些结构化数据接口都直接使用。
### Q2: 静态规则 vs 运行时规则怎么选？
A: **静态**看源码 —— CI 友好、无运行时开销、可 pre-commit 阻断；**运行时**看活的 fiber + DOM —— 能检测动态样式、条件渲染后的真实 UI，但需 dev 模式。两者**互补**，推荐 CI 用静态 + 本地 dev 时开 overlay。
### Q3: 为啥选 Bippy / Preact 架构？
A: 前期产出过 523 行 OSS 调研报告（`adux-runtime-research.md`），横向比较了 axe-core / Lighthouse / Million Lint / react-scan / Nuxt DevTools。结论：**react-scan 的 Shadow DOM + Canvas + Bippy + Preact** 组合最接近 ADUX 需求，**全 MIT 许可**，工程落地最快。Bippy 的 `getSource(fiber)` 直接读 React dev mode 的 `_debugSource` 拿文件行号，是标准做法。
### Q4: 外部团队怎么用？
A: 当前未发 npm registry，只能在本仓库 workspace 内使用。公开发布在 Roadmap 里 ⏳。
---

## 10. 致谢
- **设计师**：ADUX 规范 skill 原作（8 条规则 + Token 值表）
- **Bippy / react-scan**：浏览器 overlay 架构借鉴源
- **Ant Design 官方**：`@ant-design/cli` 提供完全离线的组件 / Token / 迁移数据
- **deepseek v4-pro**（API Usage Billing）：并行贡献了 `@adux/core` MCP client、`@adux/vite-plugin`、`@adux/runtime` Bippy wrapper 三个关键工程模块（≈700 行代码 + 35 tests）
- **codex（gpt-5.5 xhigh）**：本文档 5 张配图生成 · `adux.config` loader 模块 · README 持续维护
---

<callout emoji="memo" background-color="gray">
本文档由 Claude Opus 4.7（1M 上下文）主笔，配图由 codex (gpt-image-2) 生成。ADUX 版本 v0.0.1 alpha（2026-04-24）。
</callout>

