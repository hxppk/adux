# antdx 方案 v2 —— 设计收敛 Working Doc

> 2026-04-24 · Claude Opus 4.7 在 review deepseek-cc brainstorming v1 基础上做的设计收敛。等 deepseek 的 antd 能力实测产出后，合并为 v2 正式方案。

---

## 状态总览

| 问题 | 状态 | 决策 |
|---|---|---|
| Q1 命名冲突 | ✅ | ADUX（沿用设计师命名） |
| Q2 上游能力实测 | ✅ | 知识层可用、审查/生成层必须自建 |
| Q3 LLM 调用归属 | ✅ | 可插拔增强层（AST+模板为核心） |
| Q4 审查形态 | ✅ | R1 静态 + R2 LLM 增强 + **R3 浏览器 overlay 可视化** |
| Q5 飞书交互 | ✅ | 截图 + overlay 叠加（不是代码块） |
| Q6 MVP 切片 | ✅ | 4 周双线并行（审查新建 + 生成包装） |
| Q7 @adux/runtime 选型 | ⏳ | deepseek 在调研 OSS 参照 |
| antd 版本对齐 | ✅ | 锁 6.x，设计师 skill 5.x 内容冲突处按 6.x |

### 决策记录（D1-D6）

| D | 决策 | 结论 |
|---|---|---|
| D1 | LLM 归属：可插拔增强层 | ✅ 同意 |
| D2 | MVP R1 先行，R2 v2+ | ✅ 同意 |
| D3 | 飞书输出形态 | ✅ **升级：overlay 截图回传，不是代码块** |
| D4 | MVP 窄路径 | ✅ **升级：生成 + 审查双线并行，必须可运行原型** |
| D5 | antd 版本对齐 | ✅ 不冲突按设计师原文，冲突处按 6.x |
| D6 | deepseek session | ✅ 关掉 v1 brainstorming，新 session 派 A 研究任务 |

---

## Q1 — 命名收敛 ✅

### 事实确认
- `@ant-design/x` v2.5.0 **官方已占**（AGI 对话组件库 "Craft AI-driven interfaces effortlessly"），强心智冲突
- `antdx` 裸名 / `@antdx/core` scope 虽然 npm 404 可注册，但命名心智撞车不推荐
- **设计师已有命名资产**：`ADUX助手pro`（Ant Design UX Assistant Pro）已经在内部传播

### 决策：沿用 ADUX 品牌

| 用途 | 名字 |
|---|---|
| 品牌/产品名 | **ADUX**（Ant Design UX） |
| npm 核心包 | `@adux/core` |
| npm CLI 包 | `@adux/cli`（bin 名：`adux`） |
| Claude Code skill | `adux`（沿用"助手"心智） |
| Hermes skill | `adux-bot` |
| 飞书 bot 名 | "ADUX 助手" |

**理由**：
- 避开 `@ant-design/x` 的心智冲突
- 复用设计师已有命名资产和 stakeholder 熟悉度
- ADUX = Ant Design UX 语义清晰，同时覆盖生成 + 审查
- 中英文都能叫（中文"ADUX 助手"，英文 "ADUX"）

---

## Q3 — LLM 调用归属（核心矛盾）

### 矛盾回顾
v1 方案说：
- PM 能"一句话→原型"（必须走 LLM，模板拼接做不到这个质量）
- 外部团队 "npm install 即用，不需要 Claude API key"

这两个同时成立是不可能的，除非：

### 四条可行路径

#### 路径 A — BYO Key（Bring Your Own Key）
- 用户自带 `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`，写进 `antdx.config.js` 或 env
- 核心包内置 LLM client（anthropic SDK + openai SDK）
- 不带 key 时 CLI 降级到"纯模板生成"，质量低但可用

**Pro**：最灵活、对外部团队友好、成本转嫁
**Con**：首次配置门槛、外部用户可能直接放弃

#### 路径 B — 共享额度（通过 ClaudeClaw/OpenClaw 网关）
- 团队内部：走 ClaudeClaw 的订阅账号（已有现成能力）
- 外部团队：不支持，或走路径 A
- 核心包内置的 LLM client 支持切换 endpoint（类似你的 claude-deepseek alias 思路）

**Pro**：内部零配置
**Con**：外部分发链路断了

#### 路径 C — 接官方 MCP 的内置模型
- 如果 `@ant-design/cli mcp` 真有内置生成能力（需等 deepseek 实测结论）
- 核心包只做 orchestrator，LLM 调用全转给上游

**Pro**：无 key 负担
**Con**：能力完全受限于官方，审查/生成定制空间小——这就退化到 A 方案"轻封装"了

#### 路径 D — 纯模板 + 插槽（无 LLM）
- 核心包完全不调 LLM
- PM 通过填表/选模板/组合 block 拼页面
- 审查走 AST 静态规则

**Pro**：零依赖、零成本、离线可用
**Con**：PM "一句话→原型" 的爽感没了，降级为"选择题式原型生成器"

### 建议分层采取

| 场景 | LLM 策略 |
|---|---|
| Claude Code skill（本地） | 复用当前 session 的 LLM（skill 天然在 Claude 里跑） |
| Hermes 飞书 bot（团队内部） | 路径 B——走 ClaudeClaw 共享额度 |
| 独立 CLI（团队内部工程师用） | 路径 A + D——默认模板/AST，带 key 时升级到 LLM |
| 外部团队发布 | 路径 A + D——强调"自带 key 升级"，不强制 |

**核心设计决策**：把"LLM 生成"做成**可插拔的增强层**，不是核心引擎。核心引擎走 AST + 模板，LLM 调用在 `engine/llm-enhancer/` 模块，通过 strategy pattern 切换（none / anthropic / openai / via-claude-code-skill）。

这样 B 方案"中引擎"不退化到 A，也不强迫外部用户进 Claude 生态。

---

## Q4 — 审查形态拆分

### v1 的混淆
v1 `reviewer/` 目录列了 `lint-runner` / `style-check` / `component-check`，全是静态规则，但方案里又说"工程师贴代码进飞书 → 审查" —— 这是两条完全不同的路径。

### 拆分为两个独立 feature

#### Feature R1 — 静态扫描（CLI / CI / IDE）
- **触发**：`adux review ./src` 命令、pre-commit hook、CI job
- **输入**：文件路径或整个项目
- **输出**：结构化报告（JSON / text / markdown），可机读
- **实现**：
  - ⚠ **不依赖 `antd lint`**（deepseek 实测 6.3.6 版本 lint 功能处于早期阶段、0 命中我们的坏代码），R1 核心价值就是自建这层
  - AST 解析（babel parser + @babel/traverse），跑自建规则集
  - 规则集通过 extends/overrides 组合，类似 ESLint shareable config
  - **数据源**：`antd mcp` 长连接（组件 props/token 校验）+ `antd migrate --format json` 提取的 `searchPattern`（deprecated 规则的现成数据源）
- **MVP 规则集 = 设计师 ADUX skill 已写好的 8 条**（见下方"设计师已有资产"段的详细映射表），其中 `no-deprecated-api` 的数据源改为 `antd migrate` 的 searchPattern 而不是 `antd lint`
- **不要**：在 R1 里塞 LLM 调用（这是 R2 的事）

#### Feature R2 — 交互式 LLM review（飞书 / Claude Code skill）
- **触发**：工程师在飞书 @bot 贴一段代码，或 Claude Code 里 `/adux explain <file>`
- **输入**：代码片段（片段 / 单文件 / diff）
- **输出**：自然语言 review + 具体 patch 建议（不是打分）
- **实现**：
  - 先跑 R1 拿到静态规则命中
  - 把命中 + 上下文代码一起喂给 LLM，让它生成"为什么错 + 怎么改"的解释
  - LLM 层复用 Q3 的 enhancer 策略
- **MVP 可选**：first release 可以不做，先把 R1 打磨到位

### 关键取舍
- R1 能独立发布、外部团队零门槛使用（AST + 官方 lint）
- R2 依赖 Q3 的 LLM 策略，是 R1 的增强
- 两者共享 `adux.config.js` 的规则集定义

---

## ★ 新增 Feature R3 — 浏览器 overlay 审查可视化（D3/D4 升级）

### 背景
用户决策 D3 否定"代码块回传"，要求**在原型界面上进行审查**——违规直接叠加在真实 UI 上。D4 同时要求 MVP 必须有**可运行的原型**（至少 HTML / 本地前端），生成 + 审查一体。

### 形态
- **新包 `@adux/runtime`**：浏览器运行时库，注入 vite dev server 的页面
- **新包 `@adux/vite-plugin`**：vite 插件，dev 模式自动注入 runtime + 保留 source map
- 违规元素加红框 outline（类似 React DevTools 的 inspect）
- 右下角浮窗列出全部命中规则，点击跳转源码位置
- 飞书场景：headless 浏览器启动 → Playwright 截图 + overlay 叠图 → 飞书回推

### 实现路径（W3 任务）
⏳ deepseek 正在调研 axe-core / Lighthouse / Million Lint / Stagewise / React DevTools 的 OSS 参照，产出 `/Users/hexu/PM流程/adux-runtime-research.md` 后确定技术选型。

### 包结构更新
```
@adux/core          引擎：AST 规则 + MCP client + 生成器
@adux/cli           CLI：adux generate / review / dev
@adux/runtime  ★    浏览器 overlay 运行时（新增）
@adux/vite-plugin ★ vite 插件：注入 runtime + source map（新增）
@adux/generator     pm-antd-prototype 重组
@adux/skill-claude-code  Claude Code skill
@adux/skill-hermes  Hermes 飞书 skill
```

---

## Q5 — 飞书交互细节

### v1 的空白
v1 只写了"Hermes skill → 意图识别 → 调用核心 CLI"，但下面这些全没答：
1. 自然语言怎么变 CLI 参数？
2. 生成的 Vite 项目怎么发回飞书？
3. 同步还是异步？
4. 审查请求工程师怎么输入？

### 逐项决策

#### 1. 自然语言 → 参数解析
- Hermes skill 本身就在 agent SDK 里跑，用 LLM 做 intent parsing 是天然的
- 不做 DSL，让 agent 直接理解用户消息后调用 core CLI 的 typed function
- 例：用户 "@bot 帮我生成一个用户管理 CRUD 页面，带搜索"
  → agent 解析为：`generate({type: 'crud', entity: '用户', features: ['search']})`
- 这部分 Hermes skill 的 SKILL.md 定义好 tools schema + 调用规则即可

#### 2. 生成产物如何回传
**产物形态 = 三选一（按场景）**：
- **预览链接**（首选）：生成的项目自动 push 到团队内的静态预览服务（比如一个常驻的 prototype-host，按 ID 生成子路径 `prototype.team.com/xxx`），飞书消息回 "已生成，点这里查看" + 截图
- **截图 + zip**（降级）：跑 Playwright 截主页 + 打包 zip 发飞书附件
- **代码贴回**（最简）：只发 app.tsx 代码块回飞书，让用户自己跑——适合短 prototype

**MVP 做法**：先做第三种，最轻量；有预算再做预览服务。

#### 3. 同步 vs 异步
- 生成耗时通常 30s–3min，飞书消息不能同步等待
- **异步模型**：
  - 用户 @bot → 立即回 "收到，任务 id: xxx，预计 2 分钟" 
  - 后台跑 → 完成后 @用户 新消息附结果
  - 失败 → @用户 错误摘要
- Hermes agent SDK 天然支持长时任务（workspace/task 记录 + 消息回推）

#### 4. 审查请求输入形态
工程师不会贴整个项目进飞书。三种输入形态：
- **贴代码段**：`@bot review` + 代码块 → 临时项目 + overlay 截图 + 注释，回推飞书
- **贴 PR 链接**：`@bot review https://git.team.com/xxx/pull/123` → 机器人 fetch PR diff → 跑 R1 + overlay 截图 → 结果回帖
- **上传文件**：飞书附件 .tsx/.zip → bot 下载 → 跑 R1 + overlay 截图 → 报告回

**MVP 做法**（W4）：贴代码段形态 → 后台起 vite + `@adux/runtime` → Playwright 截图带 overlay → 回推飞书。**不是纯代码 diff**，要见 UI。

### 产物形态回传（D3 升级决策）
- ~~代码块贴回~~ 已否定
- **首选**：headless 浏览器 + runtime overlay → **截图 + 违规高亮**发飞书，下方附 diff 文本
- **降级**：如果 Playwright 失败，fall back 到 diff 代码块 + 文字描述
- **v2+**：预览链接服务常驻（不用每次跑 Playwright）

---

## Q6 — MVP 切片（4 周计划 ✅ 已定）

### 总体路径
**生成 + 审查双线并行，可视化为差异化护城河**

| 周 | 审查线（R1 + R3） | 生成线 | 交付 |
|---|---|---|---|
| **W1**<br/>打地基 | `@adux/core` 脚手架 + MCP 长连接 + babel AST + 第 1 条规则 `require-antd-component` + `adux review <file>` CLI | `@adux/generator` 骨架（重组 pm-antd-prototype 代码位置，逻辑不变） | 能跑 1 条规则的 alpha |
| **W2**<br/>铺基础面 | R1 剩 7 条规则落地（含 `no-deprecated-api` 用 `antd migrate` searchPattern） | `adux generate "..."` 出可运行 Vite + antd 项目（复用旧能力） | 双线基础完成 |
| **W3** ★<br/>可视化核心 | `@adux/runtime` + `@adux/vite-plugin`：注入 runtime、overlay 红框、浮窗清单、源码回跳 | 生成引擎接 MCP 校验 props | `adux dev` 本地浏览器见 overlay |
| **W4**<br/>飞书入口 | Hermes skill：Playwright 跑 `adux dev` + overlay 截图叠加 → 飞书回推 | Hermes skill：PM @bot → 生成项目 + 首页截图 + 预览链接 → 飞书回推 | 飞书入口上线 |
| **v2+** | R2 LLM 增强（autofix 建议）、PR 集成、interactive 飞书卡片、浏览器扩展 | 预览链接常驻服务（不每次跑 Playwright） | —— |

### 工作量评估
- 审查线：**新能力建设**，需要实打实写 AST 规则 + overlay runtime
- 生成线：**旧能力包装**，pm-antd-prototype 代码迁移 + 接 MCP 校验
- 一个全栈工程师 4 周可完成；两个并行可压到 2.5 周

---

## 设计师已有资产（2026-04-24 读到）

来源：`/Users/hexu/Downloads/SKILL-ADUX助手pro.md` + `/Users/hexu/Downloads/CLAUDE.md`

- ✅ 品牌命名：`ADUX助手pro`
- ✅ 审查规则（8 条）：直接作为 R1 MVP 规则集原文
- ✅ Design Token 具体值表（颜色/间距/圆角/阴影/字体）：作为 `design-token-only` 规则的白名单
- ✅ 组件速查表（布局/导航/表单/数据展示/反馈 五大类）：作为 R2 LLM review 的 system prompt 素材
- ✅ CLAUDE.md §1 明确要求 "通过 antd-components MCP server 校验组件 API"：和 Q2 deepseek 测的 `antd mcp` 对齐，这不是假设是**设计师已确认的前提**

**这意味着**：ADUX 产品不是从零起步，而是把设计师已经写成文档的规则**工程化成可执行工具链**。产品价值 = 规则执行的自动化 + 多入口分发，不是规则的原创。

---

## deepseek probe 最终结论 ✅

完整报告：`/Users/hexu/PM流程/antd-capability-probe.md`（323 行，2026-04-24 实测）

### 关键信号

| 层 | 状态 | 备注 |
|---|---|---|
| 知识层（组件/Token/Demo 查询） | ✅ 完全可用 | MCP 7 tools + CLI `info/doc/token/demo/list/semantic/changelog` |
| 诊断层（项目配置/依赖） | ✅ 可用 | `antd doctor` 12 项 |
| 迁移层（版本升级） | ✅ 可用 | `antd migrate` 含 `searchPattern` + before/after |
| 审查层（代码规范） | ❌ **缺失** | `antd lint` 实测 0 命中，**R1 必须自建** |
| 生成层（代码生成） | ❌ **缺失** | 上游无，ADUX 从 pm-antd-prototype 迁移升级 |

### 新发现（对方案产生实际影响）

1. **`@ant-design/cli` 很新**：首次发布 2026-03-17（仅 1 个月），latest 2026-04-17。28MB 完全离线（元数据 bundled）。**影响**：上游在快速演化，ADUX 要做好版本耦合跟踪。
2. **`antd migrate` 的 searchPattern 直接可用**：每条迁移项都有正则 pattern + before/after 代码，**直接作为 `no-deprecated-api` 规则的数据源**，不用我们从 changelog 手抠。
3. **MCP stdio 每次启动有开销**：ADUX 核心包**必须维持 MCP 长连接 + 缓存层**（基础设施决策）。
4. **antd 当前是 6.3.6**，但设计师 CLAUDE.md / SKILL 写的是 "Ant Design 5.x"——有版本 drift，要和设计师对齐是不是升到 6.x。
5. **`@ant-design/pro-components` 2.8.10** 评价⭐⭐⭐，可作为生成引擎的模板库来源。

### 基础设施决策（新增）

| 决策 | 内容 |
|---|---|
| MCP 连接 | ADUX 核心包进程常驻时维持 `antd mcp` 长连接；CLI 一次性调用时启动即退 |
| 缓存层 | 按 `(antd 版本, tool, input)` 作为 cache key；版本变了全部失效 |
| 规则数据源 | 启动时拉一次 `antd migrate --format json` 全量，本地构建 deprecated 索引 |
| 离线兜底 | 因 `@ant-design/cli` 本身离线，ADUX 也保持零网络（除用户显式开 R2 LLM） |

---

## W1 具体任务清单（可马上开工）

**目标**：`@adux/core` 能跑第 1 条规则 `require-antd-component`，CLI 命令 `adux review <file>` 产出结构化报告。

### 仓库结构
```
adux/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── mcp/
│   │   │   │   └── client.ts         # antd mcp stdio 长连接 + 缓存
│   │   │   ├── ast/
│   │   │   │   ├── parser.ts         # babel 封装
│   │   │   │   └── traverse.ts       # visitor 框架
│   │   │   ├── rules/
│   │   │   │   ├── types.ts          # Rule 接口定义
│   │   │   │   ├── registry.ts       # 规则注册 + extends/overrides
│   │   │   │   └── require-antd-component.ts  # 第 1 条
│   │   │   ├── config/
│   │   │   │   ├── loader.ts
│   │   │   │   └── defaults.ts
│   │   │   └── reporter/
│   │   │       ├── text.ts
│   │   │       ├── json.ts
│   │   │       └── markdown.ts
│   │   ├── test/
│   │   │   └── require-antd-component.test.ts
│   │   └── package.json
│   ├── cli/
│   │   ├── src/
│   │   │   ├── bin.ts                # #!/usr/bin/env node
│   │   │   └── commands/
│   │   │       └── review.ts
│   │   └── package.json
│   └── generator/                    # W2 才动
│       └── package.json              # 占位
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

### W1 任务切分（7 个子任务，可并行 3-4 个）

| # | 任务 | 依赖 | 验收 |
|---|---|---|---|
| W1.1 | monorepo 脚手架（pnpm workspace + tsup + vitest） | —— | `pnpm install` OK |
| W1.2 | `@adux/core` MCP client（启动 antd mcp stdio、initialize、tools/list、`(version,tool,input)` 缓存、graceful shutdown） | —— | 单测：查 Table props 返回 60+ 条 |
| W1.3 | AST parser + traverse 骨架（babel-parser + @babel/traverse） | —— | 解析 `App.tsx` 返回 AST，visit 所有 JSXElement |
| W1.4 | `Rule` 接口 + registry（extends/overrides） | W1.3 | 能 register / disable / configure 规则 |
| W1.5 | `require-antd-component` 规则实现（扫 JSX 裸 `<button>/<input>/<form>/<a>`） | W1.4 | 单测 3 个正例 3 个反例 |
| W1.6 | `@adux/cli`：`adux review <path>` 命令 + JSON/text reporter | W1.5 | `adux review App.tsx --format json` 出 JSON |
| W1.7 | E2E 测试：对设计师 CLAUDE.md §2 示例代码跑一遍 | W1.6 | 命中 `<button>` 裸标签 |

### 谁来写 W1
3 个选项：
- **你自己写**：最直接，一个人 5-7 天够
- **派给 deepseek**：A 研究完后派 W1.1-W1.6 给它（一个 session 干一件事更稳）
- **并行**：你/Claude Opus 写 W1.1/W1.3/W1.4/W1.5（设计决策密集），deepseek 做 W1.2 MCP client（纯工程）

**待你决定**。A 研究还有 40 分钟左右，其间你可以：(1) 先动 W1.1 脚手架；(2) 等 A 完成一次性派发多任务；(3) 人肉把 W1 任务扔给团队工程师。
