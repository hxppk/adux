# Ant Design 上游能力实测报告

> 实测日期：2026-04-24 | 执行环境：macOS 15.7, Node 22.17.1

---

## 1. @ant-design/cli 包

### 存在性 + 版本
| 项目 | 值 |
|------|-----|
| 包名 | `@ant-design/cli` |
| 最新版 | `6.3.6` |
| 发布日 | 2026-04-17 |
| 首次发布 | 2026-03-17（仅1个月历史） |
| 入口 | `dist/index.js` (ESM only) |
| Node 要求 | `>=20.0.0` |
| 运行时依赖 | `oxc-parser` (仅1个) |
| 包体积 | 28MB unpacked（含全量 antd v4/v5/v6 元数据） |
| 维护者 | afc163, zombiej, chenshuai2144, arvinxx, madccc |

### 子命令枚举（16个）

```
list           — 列出所有组件（双语名称、分类、引入版本）
info           — 查询组件 API：props、类型、默认值
doc            — 组件完整 API 文档（Markdown）
demo           — 获取组件 Demo 源码（不指定名称则列清单）
token          — 查询 Design Token（全局/组件级）
semantic       — 查询组件语义化 classNames/styles 结构
changelog      — 查询 changelog 或跨版本 API diff
doctor         — 诊断项目级 antd 配置
usage          — 扫描项目组件/API 使用统计
lint           — 检查 antd 最佳实践
migrate        — 版本迁移指南（含 auto-fix）
env            — 收集环境信息
mcp            — 启动 MCP Server
bug / bug-cli  — 提交 bug 报告
```

### 关键设计特征
- **完全离线**：所有组件元数据随包发布，零网络请求
- **版本精确**：覆盖 v4/v5/v6 共 55+ 个小版本快照
- **模糊纠错**：拼写错误的组件名自动 Levenshtein 纠正
- **双语输出**：`--lang zh` 切换中文，所有输出支持 `--format json|text|markdown`

---

## 2. antd MCP Server

### 启动方式
```bash
antd mcp   # stdio 协议，无额外参数
```

### 协议握手实测
```
→ initialize(protocolVersion: "2024-11-05")
← result: { protocolVersion: "2024-11-05", serverInfo: { name: "antd", version: "6.3.6" } }
  capabilities: { tools: {}, prompts: {} }
```

### 7 个 Tool 清单

| Tool | 参数 | 输入样例 | 输出 |
|------|------|---------|------|
| `antd_list` | 无 | `{}` | 80+ 组件完整 JSON（name/nameZh/category/description/since） |
| `antd_info` | `component` | `{component:"Table"}` | 完整 props 表（name/type/default/since），60+ 属性 |
| `antd_doc` | `component` | `{component:"Button"}` | 完整 Markdown 文档（When To Use / API / 示例） |
| `antd_demo` | `component`, `name?` | `{component:"Table"}` | 39 个 demo 清单。指定 name 则返回完整 TSX 源码 |
| `antd_token` | `component?` | `{component:"Table"}` | 全局 70+ token 或组件级 token（含中英描述） |
| `antd_semantic` | `component` | `{component:"Table"}` | classNames/styles 语义结构（部分组件数据为空） |
| `antd_changelog` | `v1?`, `v2?`, `component?` | `{}` | 最新 changelog 条目（version/date/changes[]） |

### 真实输入→输出样例

**antd_info + Table：**
```json
// → Input
{"component": "Table"}

// ← Output (截取)
{
  "name": "Table", "nameZh": "表格",
  "props": [
    {"name": "bordered", "type": "boolean", "default": "false"},
    {"name": "columns", "type": "[ColumnsType](#column)\\[]"},
    {"name": "dataSource", "type": "object\\[]"},
    {"name": "pagination", "type": "object \\| false", "default": "-"},
    {"name": "rowSelection", "type": "object"},
    {"name": "scroll", "type": "object"},
    {"name": "size", "type": "`large` | `middle` | `small`"},
    ...
  ]
}
```

**antd_token + Table：**
```json
// ← Output (截取)
{
  "component": "Table",
  "tokens": [
    {"name": "borderColor", "type": "string", "description": "Border color of table"},
    {"name": "cellFontSize", "type": "number"},
    {"name": "cellPaddingBlock", "type": "number"},
    {"name": "headerBg", "type": "string"},
    ...
  ]
}
```

### 能力边界
| 能做 | 做不了 |
|------|--------|
| ✅ 查询任意组件的 props/类型/默认值 | ❌ 无 codegen / 生成代码能力 |
| ✅ 查询全局或组件级 Design Token | ❌ 无 lint / 审查能力（lint 是独立命令行） |
| ✅ 获取 demo 源码（生成参考） | ❌ 无项目级扫描（doctor/usage 是独立命令行） |
| ✅ 查询 changelog | ❌ MCP 中无 migrate 功能 |
| ✅ 完全离线 | |

---

## 3. antd lint — 代码审查

### 测试环境
Vite + React 19 + TypeScript 项目，`antd 6.3.6` 已安装。

### 测试用例 1：故意违规代码
```tsx
// App.tsx — 2 处故意违规
<div style={{ padding: 24, background: "#f0f0f0", color: "#ff0000" }}>
  <h1 style={{ color: "#ff4d4f" }}>用户管理</h1>
  <button style={{ padding: "8px 16px", background: "#1677ff", ... }}>
    新增用户  {/* 裸 <button>，非 antd Button */}
  </button>
  <Table columns={columns} dataSource={users} />
</div>
```

**lint 输出：0 issues（4个category全部为0）**

### 测试用例 2：已知 deprecated API
```tsx
<Modal visible={true} ...>       // v5 起 visible → open
<Dropdown overlay={...}>         // v5 起 overlay → menu
<Table notARealProp={true} ...>  // 不存在的 prop
```

**lint 输出：0 issues**

### 结论
**`antd lint` 在当前版本（6.3.6）不可用。** 即使用了 `--only deprecated|a11y|usage|performance` 分别测试，全部返回空。可能原因：
- oxc-parser 的 lint 规则尚未充分实现（CLI 仅发布1个月）
- 需要特定的项目配置或 oxc 配置文件
- lint 功能可能处于早期阶段

**对 antdx 影响：不能用 antd lint 做审查引擎，必须自建。**

---

## 4. antd doctor — 项目诊断

### 诊断维度实测（12项）

```
✓ duplicate-install     — antd 重复安装检测
✓ dayjs-duplicate       — dayjs 重复安装检测
✓ cssinjs-duplicate     — @ant-design/cssinjs 重复安装
✓ cssinjs-compat        — cssinjs peer dependency 兼容
✓ icons-compat          — @ant-design/icons 兼容
✓ theme-config          — 主题配置检测
✓ babel-plugin          — babel/webpack antd 插件检测
✓ cssinjs               — @ant-design/cssinjs 是否安装
✓ ecosystem-compat:cssinjs       — 生态包兼容检测
✓ ecosystem-compat:cssinjs-utils
✓ ecosystem-compat:icons
✗ antd-installed        — antd 未在 node_modules 中（部分安装）
✗ react-compat          — 无法检测 React 兼容（antd 未完全安装）
⚠ ecosystem-compat:react-slick  — peer dep 警告
```

### 能力边界
| 能做 | 做不了 |
|------|--------|
| ✅ 依赖安装检查 | ❌ 不检查代码质量 |
| ✅ 生态包兼容性 | ❌ 不检查样式/布局 |
| ✅ babel/webpack 插件检测 | ❌ 不检查组件使用方式 |
| ✅ 主题配置检测 | |

**对 antdx：可用于项目初始化时的环境预检。**

---

## 5. antd usage — 组件使用统计

### 实测输出
```json
{
  "scanned": 4,
  "components": [
    {"name": "Button", "imports": 1, "files": ["src/App.tsx"]},
    {"name": "Table", "imports": 1, "files": ["src/App.tsx"]},
    {"name": "Space", "imports": 1, "files": ["src/App.tsx"]}
  ],
  "nonComponents": [
    {"name": "message", "imports": 1, "files": ["src/App.tsx"]}
  ],
  "summary": {"totalComponents": 3, "totalImports": 3}
}
```

**能力边界：** 能区分组件 vs 非组件（如 message/notification），能列出每个组件的文件和导入次数。适合做项目基线扫描。

---

## 6. antd migrate — 版本迁移

### 实测输出（v4→v5，JSON格式）
每条迁移项包含：
- `component` — 影响的组件
- `breaking` — 是否 breaking change
- `description` — 变更描述
- `autoFixable` / `codemod` — 自动修复能力
- `searchPattern` — 正则搜索模式（可直接用于代码扫描）
- `migrationGuide` — 迁移步骤
- `before` / `after` — 代码示例

支持迁移：v3→v4, v4→v5, v5→v6

### 能力边界
| 能做 | 做不了 |
|------|--------|
| ✅ 版本间 API diff 查询 | ❌ 不执行实际 codemod（只是指南） |
| ✅ 搜索模式提供 | ❌ 不修改文件（`--apply` 生成 agent prompt） |
| ✅ before/after 代码示例 | |

**对 antdx：可用于审查助手的 deprecated API 检测规则数据源。**

---

## 7. 周边包扫描（@ant-design scope）

### DX / codegen / lint 相关

| 包名 | 版本 | 描述 | 对 antdx 价值 |
|------|------|------|--------------|
| `@ant-design/cli` | 6.3.6 | CLI + MCP | ⭐⭐⭐ 核心数据源 |
| `antd` | 6.3.6 | 组件库本体 | ⭐⭐⭐ 运行时依赖 |
| `@ant-design/icons` | 6.1.1 | 图标库 | ⭐⭐ 生成时图标推荐 |
| `@ant-design/cssinjs` | 2.1.2 | CSS-in-JS 引擎 | ⭐ 理解 token → CSS 映射 |
| `@ant-design/colors` | 8.0.1 | 调色板计算 | ⭐ 颜色校验 |
| `antd-style` | 4.1.0 | antd token + emotion 方案 | ⭐ 备选样式方案 |
| `@ant-design/pro-components` | 2.8.10 | Pro 组件集 | ⭐⭐ 生成时可选用 |
| `@ant-design/tools` | 19.2.0 | antd 内部工具 | 低（内部包） |
| `@ant-design/nextjs-registry` | 1.3.0 | Next.js 集成 | 低 |

---

## 8. 对 B 方案（antdx 中引擎）的影响评估

### 直接可用（不需要额外开发）

| 能力 | 来源 | 接口 |
|------|------|------|
| 组件知识查询 | MCP `antd_info` / CLI `antd info` | 进程内调用 MCP client 或 shell |
| Design Token 查询 | MCP `antd_token` / CLI `antd token` | 同上 |
| Demo 源码获取 | MCP `antd_demo` / CLI `antd demo` | 同上 |
| 组件列表 | MCP `antd_list` / CLI `antd list` | 同上 |
| 完整文档 | MCP `antd_doc` | 同上 |
| 项目诊断 | CLI `antd doctor` | shell |
| 导入统计 | CLI `antd usage` | shell |
| 迁移搜索模式 | CLI `antd migrate` 中的 `searchPattern` | JSON 解析 |

### 需要包装（加缓存/错误处理/结构化）

| 能力 | 问题 | 方案 |
|------|------|------|
| MCP 通信 | 每次启动 stdio proc 开销 | antdx 启动时维持 MCP 长连接 + 缓存层 |
| Token 校验 | `antd token` 返回全量，无"这个值是否合法token"查询 | antdx 建立 token name → value 索引 |
| Demo 质量 | Demo 是教学用，不直接适配 PM 需求 | antdx 做模板映射（Demo 片段 → 业务页面） |

### 必须自建（上游无此能力）

| 能力 | 理由 | 优先级 |
|------|------|--------|
| **硬编码样式检测** | `antd lint` 完全不可用 | 🔴 P0 |
| **非 antd 组件检测** | 无上游工具 | 🔴 P0 |
| **裸 HTML 布局检测** | 无上游工具 | 🔴 P0 |
| **反馈组件合规检测** | 无上游工具 | 🔴 P0 |
| **Props 真实存在校验** | 可用 MCP `antd_info` 做数据源，但校验逻辑需自建 | 🟡 P1 |
| **原型生成引擎** | 上游无代码生成能力，antdx 从 pm-antd-prototype 迁移 | 🔴 P0 |
| **交互式审查流程** | 上游无此概念 | 🟡 P1 |
| **Feishu 集成** | 业务逻辑 | 🟡 P1 |

---

## TL;DR

**上游数据源够不够撑 B 方案？够，但有硬缺口。**

### 总结

```
知识层（查询组件/Token/API）  ✅ 完全可用 — MCP 7 tools + CLI 子命令
诊断层（项目配置/依赖检查）  ✅ 可用 — antd doctor 12项检查
迁移层（版本升级指南）     ✅ 可用 — migrate 含 searchPattern
审查层（代码规范检查）     ❌ 缺失 — antd lint 实测 0 结果，需自建
生成层（代码生成）        ❌ 缺失 — 上游无此能力，需自建
```

**必须自建的核心模块：**
1. **审查引擎** — 替代/补充 `antd lint`，实现：硬编码样式检测、非 antd 组件检测、裸布局检测、反馈组件检测
2. **生成引擎** — 从 pm-antd-prototype 迁移升级：需求→结构化文档→组件选型→代码生成
3. **MCP 长连接 + 缓存** — 进程常驻，避免每次查询启动 stdio

**可以依赖上游的：**
- 所有组件知识（props/types/defaults/since）
- 所有 Design Token（全局+组件级，含中英描述）
- 38+ demo 源码（作为生成模板参考）
- `antd usage` 项目导入统计
- `antd doctor` 环境诊断
- `antd migrate` 的 searchPattern（作为审查规则数据源）
