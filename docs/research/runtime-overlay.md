# ADUX Runtime — 浏览器 Overlay 审查可视化 OSS 调研

> 调研时间：2026-04-24  
> 源码保留路径：`/tmp/adux-research/`（axe-core, axe-core-npm, million, bippy, react-scan, devtools）

---

## 1. 参照项目逐项分析

### 1.1 axe-core + @axe-core/react

**源码路径**: `/tmp/adux-research/axe-core/lib/`, `/tmp/adux-research/axe-core-npm/packages/react/`

**a) 注入方式**
- `@axe-core/react` 通过 monkey-patch `React.createElement` 拦截所有组件创建（`index.ts:265-280`）
- 利用 `ReactDOM.findDOMNode()` 获取 DOM 节点（`index.ts:152`）
- 使用 `requestIdleCallback` 进行 debounce 审计（`index.ts:104-124`）

**b) DOM ↔ 源码位置映射**
- **没有源码映射**。只记录 CSS selector path（`node.target.toString()`）作为 DOM 定位方式
- 通过 `component._reactInternalFiber._debugID` 或 `component._reactInternals._debugID` 做去重（`index.ts:208-221`）
- 不支持点击跳转到源码编辑器

**c) UI 组件形态**
- **纯 console.log 输出**，没有视觉 overlay。格式化 console.group 展开查看违规详情（`logToConsole` 函数，`index.ts:229-258`）
- 没有 shadow DOM / iframe / 红框浮窗

**d) 与构建工具集成**
- 无 Vite/Webpack 插件。作为 React runtime library 使用：
  ```js
  import reactAxe from '@axe-core/react';
  reactAxe(React, ReactDOM, 1000);
  ```
- 仅支持 Web 环境，不依赖特定 bundler

**e) 许可证**
- axe-core: **MPL 2.0**（弱 copyleft，文件级传染）
- @axe-core/react: **MPL 2.0**
- 商业友好度：中等——需注意 MPL 文件级范围，可商用但修改需公开

**f) 代码量**
- axe-core core lib: ~32,000 LOC（重度）
- @axe-core/react: ~260 LOC（极轻）
- 总共：**重型**（但 React 集成薄）

**对 ADUX 的启发**
- Monkey-patch `React.createElement` 是捕获所有组件创建的可靠手段
- `requestIdleCallback` + debounce 模式适合不阻塞渲染的审查
- 缺乏视觉 overlay，不适合"让 PM 在浏览器里看到违规"的场景

---

### 1.2 Million.js / Bippy（React 侦测核心）

**源码路径**: `/tmp/adux-research/bippy/packages/bippy/src/`, `/tmp/adux-research/million/packages/react/its-fine.tsx`

**a) 注入方式**
- Bippy 通过 `__REACT_DEVTOOLS_GLOBAL_HOOK__` 注入 React 内部（`core.ts` 的 `instrument()` 函数）
- `its-fine.tsx` 使用 `Function.prototype.bind` monkey-patch 截获 fiber（第44-51行）：
  ```ts
  Function.prototype.bind = function (self, maybeFiber) {
    if (self === null && typeof maybeFiber?.type === 'function') {
      fiber.current = maybeFiber;
      Function.prototype.bind = bind;
    }
    return bind.apply(this, arguments);
  };
  ```

**b) DOM ↔ 源码位置映射**
- **核心机制**: 读取 React 在 dev 模式下自动注入的 `fiber._debugSource`（`source/get-source.ts:18-31`）
- `_debugSource` 包含 `fileName`（绝对路径）和 `lineNumber`（行号）
- 由 `@vitejs/plugin-react` 的 babel 插件 `@babel/plugin-transform-react-jsx-source` 自动生成
- Fallback: `getOwnerStack()` 解析组件 owner stack trace（`source/owner-stack.ts`）
- 路径标准化：`normalizeFileName()` 清理 bundler 前缀（`get-source.ts:89-181`）

**c) UI 组件形态**
- Bippy 本身**无 UI**，只提供程序化 API
- `its-fine.tsx` 提供 React hooks（`useFiber()`, `useNearestParent()`, `useContainer()`）供上层消费

**d) 与构建工具集成**
- 无独立构建工具插件
- 依赖宿主使用 `@vitejs/plugin-react`（dev 模式自动启用 `_debugSource`）

**e) 许可证**
- Bippy: **MIT**（商业友好）
- Million.js: **MIT**

**f) 代码量**
- Bippy core + source: ~4,500 LOC（轻量）
- Million.js 整体: ~15,000 LOC（中型）

**对 ADUX 的启发**
- Bippy 的 `getSource(fiber)` 是 DOM→源码映射的标准解法
- `instrument()` 函数是接入 React reconciler 的关键入口
- `its-fine.tsx` 的 `Function.prototype.bind` 技巧在 React 19 仍有效（直到 2026-04 commit）
- 可作为 @adux/runtime 的底层依赖

---

### 1.3 react-scan（React 性能可视化）

**源码路径**: `/tmp/adux-research/react-scan/packages/scan/src/`  
**核心 commit**: `git clone --depth 1` latest main

**a) 注入方式**
- **Vite plugin** (`vite-plugin-react-scan/src/index.ts`): 
  - Dev 模式：通过 `transformIndexHtml` hook 注入 `<script type="module">`
  - 使用 `import { scan } from '/@id/react-scan'` 的 Vite 虚拟模块解析（`resolveId` hook，line 277-282）
  - Build 模式：复制 `auto.global.js` 并注入 script 标签
- Runtime 初始化：`scan()` → `initReactScanInstrumentation()` → `createInstrumentation()` → `instrument()` (Bippy)

**b) DOM ↔ 源码位置映射**
- **不使用 source map**。通过以下链完成：
  1. Babel plugin `reactScanComponentNamePlugin` 在编译时往组件添加 `displayName`（`react-component-name/babel/index.ts`）
  2. Runtime 使用 Bippy 的 `getDisplayName()` + `getFiberId()` + `getType()` 识别组件
  3. Canvas outline 通过 `getNearestHostFibers(fiber)` 获取实际 DOM 元素 → `getBoundingClientRect()` 计算位置
- `_debugSource` 被 Bippy 读取，但 react-scan 主要用于获取组件名而非跳转源码

**c) UI 组件形态**
- **Shadow DOM** 隔离容器（`data-react-scan` host → `shadowRoot`）
- **Canvas overlay**: 固定在 `position:fixed; z-index:2147483646` 的全屏 canvas（`outlines/index.ts:239-252`）
- **Web Worker + OffscreenCanvas** 用于高性能 outline 绘制（`outlines/index.ts:258-280`）
- **Preact** 渲染 toolbar/inspector UI（`web/toolbar.tsx`）
- Flash overlay 用于临时高亮元素（`web/views/inspector/flash-overlay.ts`）
- IntersectionObserver 懒加载元素矩形（`outlines/index.ts:115-148`）

**d) 与构建工具集成**
- Vite plugin（一级公民）
- 同时提供 standalone script 注入、browser extension
- `unplugin` 架构支持 webpack/rollup/esbuild/rspack/rolldown（`react-component-name/` 目录下各适配器）
- Next.js 通过 `next.config` 或 `instrumentation-client.ts` 支持

**e) 许可证**
- react-scan: **MIT**（商业友好）
- Bippy（依赖）: **MIT**
- Preact（依赖）: **MIT**

**f) 代码量**
- scan core: ~3,000 LOC
- scan web UI: ~15,000 LOC
- vite plugin: ~320 LOC
- 总计：**中型 ~22,000 LOC**

**对 ADUX 的启发**
- **最接近 ADUX 需求的参照项目**：
  - Canvas overlay 绘制红框 → 可改造为违规高亮
  - Shadow DOM 隔离 → 防止样式污染 antd
  - Vite plugin 注入 script → 对用户透明
  - Preact 轻量 UI → 浮窗列出命中规则
  - OffscreenCanvas + Worker → 性能优秀
- 但 react-scan 聚焦性能指标而非 lint 规则，UI 层需要完全重写
- 架构骨架可直接借鉴：Bippy instrument → Canvas overlay → Preact UI

---

### 1.4 Nuxt DevTools / Vite DevTools Kit

**源码路径**: `/tmp/adux-research/devtools/packages/devtools/src/`, `/tmp/adux-research/devtools/packages/devtools-kit/src/`

**a) 注入方式**
- Vite plugin (`@vitejs/devtools` / `vite-plugin-vue-tracer`)
- 通过 `addVitePlugin()` 注册（`module-main.ts:60`）
- iframe panel 注入到页面（`module-main.ts:66-76`）
- 快捷键：`Shift + Option + D`（macOS）

**b) DOM ↔ 源码位置映射**
- `vite-plugin-vue-tracer` 在编译时为每个 Vue 组件元素添加 `data-v-inspector-file` + `data-v-inspector-line` 自定义属性（`integrations/vue-tracer.ts`）
- 点击元素 → 读取 data 属性 → 通过 Vite server RPC 跳转编辑器中对应位置
- **不依赖 fiber / source map**

**c) UI 组件形态**
- **iframe 内嵌 panel**（独立于页面 DOM，完全样式隔离）
- Web components 构建 UI（`src/webcomponents/`）
- Docks 系统：可切换 iframe / 侧栏 / 浮窗模式

**d) 与构建工具集成**
- Vite 深度集成（Nuxt 生态）
- `@vitejs/devtools-kit` 提供 SDK 供第三方工具注册 panel

**e) 许可证**
- Nuxt DevTools: **MIT**

**f) 代码量**
- devtools + devtools-kit: ~15,000 LOC（中型）

**对 ADUX 的启发**
- `data-v-inspector-*` 方式是最简洁的 DOM→源码映射方案，但需要编译时注入
- iframe 隔离是最彻底的样式保护，但通信复杂且无法直接引用宿主 DOM
- 快捷键呼出 overlay 降低打扰感

---

### 1.5 React DevTools / Chrome DevTools Inspect Element

**源码路径**: React 官方 repo（未 clone，基于公开知识 + Bippy 源码验证）

**a) 注入方式**
- Chrome/Firefox Extension 注入 `__REACT_DEVTOOLS_GLOBAL_HOOK__` 到页面
- Backend agent 在页面内运行，通过 `postMessage` 或 Bridge 与 DevTools panel 通信
- 也支持 standalone 模式（`<script>` tag）

**b) DOM ↔ 源码位置映射**
- 使用 fiber 内部的 `_debugSource`（React dev mode 注入）
- `_debugSource.fileName` → 文件路径
- `_debugSource.lineNumber` → JSX 所在行号
- "Open in Editor" 功能通过 `launch-editor-middleware` + Vite/Webpack dev server 端点实现

**c) UI 组件形态**
- Chrome DevTools Panel（iframe）
- 组件树视图 + 右侧属性面板
- Inspect Element：hover 时在页面上高亮 DOM 元素（独立的 overlay mount）

**d) 与构建工具集成**
- 无。React DevTools 独立于构建工具
- 需要 dev 模式构建（`_debugSource` 仅在 dev 模式生成）
- `@vitejs/plugin-react` 自动启用

**e) 许可证**
- React DevTools: **MIT**
- React: **MIT**

**f) 代码量**
- React DevTools backend: ~15,000 LOC
- 整体：**重型**

**对 ADUX 的启发**
- `_debugSource` 机制是可靠的 DOM→源码映射基础
- Inspect Element 的 hover 高亮模式可参考 UX
- `launch-editor-middleware` 是 "点击跳源码" 的标准实现

---

### 1.6 补充参照：Chrome DevTools Inspect Element 机制

**不适用 git clone**（Chromium 源码过大），基于 Web 标准分析：

- **Inspect Element 的映射**: 基于 DOM tree + CSS selectors，不依赖 framework
- **Overlay**: 独立的 overlay page（不是 shadow DOM，是独立的 Compositor Layer）
- **对我们有价值的部分**: 高亮框的 CSS 实现（outline + 负 margin + pointer-events:none）

---

## 2. 技术选型对比表（横向矩阵）

| 维度 | axe-core+React | Bippy | react-scan | Nuxt DevTools | React DevTools |
|------|:---:|:---:|:---:|:---:|:---:|
| **注入方式** | Monkey-patch React.createElement | RDT hook (__REACT_DEVTOOLS_GLOBAL_HOOK__) | Vite plugin + script tag + RDT hook | Vite plugin + iframe | Browser Extension + RDT hook |
| **DOM→源码映射** | ❌ CSS selector only | ✅ fiber._debugSource | ⚠️ displayName + fiber id | ✅ data-attr + RPC | ✅ fiber._debugSource |
| **UI 形态** | ❌ console.log only | ❌ 无 UI（纯 API） | ✅ Shadow DOM + Canvas + Preact | ✅ iframe + Web Components | ✅ iframe panel + overlay |
| **Vite 集成** | ❌ | ❌ | ✅ 一级公民 | ✅ 一级公民 | ❌ |
| **许可证** | MPL 2.0 ⚠️ | MIT ✅ | MIT ✅ | MIT ✅ | MIT ✅ |
| **代码量** | ~300 (React) + ~32K (core) | ~4.5K | ~22K | ~15K | ~15K |
| **生产可用性** | ✅ a11y 领域标准 | ✅ 底层库 | ✅ v0.5 快速迭代 | ✅ | ✅ |
| **对 ADUX 复用度** | 低（a11y 语义不匹配） | 高（作为底层依赖） | 最高（架构骨架匹配） | 中（Vue 生态差异） | 中（逻辑匹配但形态不同） |

---

## 3. 推荐的 @adux/runtime 实现路径

### 推荐：选项 A（vite plugin 注入 + 自建 runtime UI），混合 Bippy 底层能力

**理由**:
1. **react-scan 验证了这条路径可行**——Vite plugin 注入 + RDT hook + Canvas overlay + Shadow DOM UI
2. **Bippy 提供了现成的深层能力**——fiber 遍历、`getSource()` 映射、`instrument()` 钩子
3. **axe-core 的 monkey-patch 模式**可以改造用于拦截 antd 组件（如 Modal/Drawer）
4. **不推荐选项 B**（借壳 axe-core）：axe-core 的规则引擎是为 a11y 设计的，ADUX 的规则（如 antd Table 无分页、Form 无校验等）完全不同
5. **不推荐选项 C**（浏览器扩展）：ADUX 的目标用户是 PM/工程师，安装扩展的门槛高于 npm install + vite plugin

### 混合架构图

```
┌─────────────────────────────────────────────────────┐
│  @adx/vite-plugin                                    │
│  ├─ transformIndexHtml: 注入 <script type="module">  │
│  ├─ resolveId: 解析 /@id/adux-runtime                 │
│  └─ configureServer: launch-editor endpoint          │
└──────────────┬──────────────────────────────────────┘
               │ inject
┌──────────────▼──────────────────────────────────────┐
│  @adx/runtime (browser)                              │
│  ┌──────────────────────────────────────────────┐   │
│  │  Instruments (基于 Bippy instrument())         │   │
│  │  ├─ onCommitFiberRoot → 审计触发              │   │
│  │  ├─ traverseRenderedFibers → 遍历组件树       │   │
│  │  └─ getSource(fiber) → 源码位置映射           │   │
│  ├──────────────────────────────────────────────┤   │
│  │  Rule Engine (自建)                           │   │
│  │  ├─ 规则定义格式 (JSON Schema / TS)            │   │
│  │  ├─ 规则执行器 (访问 fiber + DOM)              │   │
│  │  └─ 违规结果结构 {element, rule, message,     │   │
│  │       source:{file,line}}                      │   │
│  ├──────────────────────────────────────────────┤   │
│  │  Overlay UI (Preact + Shadow DOM)             │   │
│  │  ├─ Canvas overlay → 红框高亮违规元素         │   │
│  │  ├─ Tooltip 浮窗 → 列出命中规则               │   │
│  │  ├─ Sidebar panel → 违规列表总览              │   │
│  │  └─ onClick → fetch /__adux/open-editor       │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 4. 最小可行原型伪代码 + 核心文件结构

### 4.1 文件结构

```
packages/
├── adx-vite-plugin/          # Vite 插件
│   ├── src/
│   │   └── index.ts          # < 200 LOC
│   └── package.json
│
├── adx-runtime/               # 浏览器运行时
│   ├── src/
│   │   ├── index.ts           # 入口: init() 函数
│   │   ├── instrument.ts      # Bippy instrument 封装
│   │   ├── rules/
│   │   │   ├── engine.ts      # 规则引擎
│   │   │   └── definitions/   # 内置规则定义
│   │   │       └── antd.ts    # antd 规则
│   │   ├── overlay/
│   │   │   ├── host.ts        # Shadow DOM 宿主创建
│   │   │   ├── canvas.ts      # Canvas 红框绘制
│   │   │   ├── tooltip.tsx    # 浮窗组件 (Preact)
│   │   │   └── sidebar.tsx    # 侧栏组件 (Preact)
│   │   └── utils/
│   │       └── source.ts      # fiber → source 映射
│   └── package.json
│
└── playground/                # 开发测试项目
    ├── vite.config.ts
    └── src/App.tsx
```

### 4.2 核心伪代码

```typescript
// ─── adx-vite-plugin/src/index.ts ───
export default function adxPlugin(): Plugin {
  return {
    name: 'adx',
    enforce: 'pre',
    transformIndexHtml(html) {
      // 注入 runtime 脚本（仅在 dev 模式下）
      return html.replace('</head>', `
        <script type="module">
          import { init } from '/@id/adux-runtime';
          init(${JSON.stringify(userOptions)});
        </script>
      </head>`);
    },
    resolveId(id) {
      if (id === '/@id/adux-runtime') return 'adux-runtime';
    },
    configureServer(server) {
      // launch-editor endpoint
      server.middlewares.use('/__adux/open-editor', (req, res) => {
        const { file, line } = parse(req.url);
        launchEditor(file, line);
        res.end('ok');
      });
    }
  };
}

// ─── adx-runtime/src/instrument.ts ───
import { instrument, getSource, getDisplayName } from 'bippy';

export function createADUXInstrumentation(rules: Rule[], ui: OverlayUI) {
  instrument({
    name: 'adux',
    onCommitFiberRoot(_rendererID, root) {
      // 遍历本次 commit 的所有 fiber
      traverseRenderedFibers(root.current, (fiber) => {
        // 1. 获取 DOM 元素
        const hostFibers = getNearestHostFibers(fiber);
        const elements = hostFibers.map(f => f.stateNode).filter(Boolean);

        // 2. 运行规则
        for (const rule of rules) {
          const violations = rule.check(fiber, elements);
          for (const v of violations) {
            // 3. 获取源码位置
            const source = await getSource(fiber);
            // 4. 上报到 overlay
            ui.addViolation({
              element: elements[0],
              rule: rule.name,
              message: v.message,
              file: source?.fileName,
              line: source?.lineNumber,
            });
          }
        }
      });
    }
  });
}

// ─── adx-runtime/src/overlay/host.ts ───
export function createOverlayHost(): ShadowRoot {
  const host = document.createElement('div');
  host.setAttribute('data-adux', 'true');
  document.documentElement.appendChild(host);
  return host.attachShadow({ mode: 'open' });
}

// ─── adx-runtime/src/overlay/canvas.ts ───
export function drawViolationBox(
  ctx: CanvasRenderingContext2D,
  rect: DOMRect,
  severity: 'error' | 'warning'
) {
  const color = severity === 'error' ? '#f5222d' : '#faad14';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

  // 填充半透明背景
  ctx.fillStyle = severity === 'error'
    ? 'rgba(245,34,45,0.08)'
    : 'rgba(250,173,20,0.08)';
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
}
```

---

## 5. 风险 / 已知坑

### 5.1 Source Map 在生产环境被混淆

**问题**: `fiber._debugSource` 仅在 React dev build 存在，生产环境为 `null`。  
**事实**: ADUX 定位为**开发时工具**（不是生产监控），因此依赖 dev 模式是合理的。  
**缓解**: 在 vite plugin 中检查 `process.env.NODE_ENV === 'development'`，生产构建静默跳过。  
**参考**: react-scan 的 `getIsProduction()` 检查（`instrumentation.ts`），Bippy 的 `hasDebugSource()` fallback 到 owner stack。

### 5.2 Vite HMR 下 Overlay 的重绘

**问题**: HMR 更新时 React fiber 树被替换，canvas overlay 可能残留旧的违规框。  
**缓解方案**:
1. 监听 `import.meta.hot` 事件，HMR 时清空 canvas
2. 使用 `WeakMap<Fiber>` 绑定，fiber 被 GC 后自动清理
3. 参考 react-scan 的 `blueprintMap.delete(fiber)` 在每次 commit 后清理旧数据

### 5.3 多 React 实例问题

**问题**: 页面可能加载了多个 React 实例（如微前端、embed widget），`__REACT_DEVTOOLS_GLOBAL_HOOK__` 只有一个。  
**缓解**: Bippy 已处理多 renderer 情况，`instrument()` 支持 `onCommitFiberRoot(_rendererID, root)` 的 `_rendererID` 参数区分。  
**注意**: externals 配置确保只有一个 React 实例时不必处理。

### 5.4 跨 iframe 组件的检测

**问题**: iframe 内的 React app 有独立的 fiber 树，主框架的 instrument hook 不可见。  
**缓解**:
1. 对于可控的 iframe（同源），通过 `iframe.contentWindow.__REACT_DEVTOOLS_GLOBAL_HOOK__` 注入
2. 对于不可控的 iframe（跨域），标记为"无法检测"而非报错
3. 在 sidebar 提示："iframe 内的组件需单独加载 ADUX"
4. 参考 axe-core 的 `frameMessenger` 机制（`axe-core/lib/core/public/frame-messenger.js`）处理跨 frame 聚合

### 5.5 antd 组件内部的 Portal（Modal/Drawer/Notification）怎么 attach overlay

**问题**: antd Modal/Drawer 使用 `ReactDOM.createPortal` 或 `rc-dialog` 的 Portal，渲染到 `document.body` 的直接子节点，不在组件树的原位置。Canvas overlay 也需要跟随到 portal root 层级。  
**缓解方案**:
1. **Canvas 本身就是 fixed + 最高 z-index** → 已覆盖 portal（portal 在 body 层级，canvas 也在 body 层级且 z-index 更高）
2. **Tooltip 浮窗需要特殊处理**: 检测违规元素是否在 portal 内（`element.closest('.ant-modal-root')`），tooltip 挂载到同一 portal root 而非 Shadow DOM
3. **规则定义时标记 antd 组件**: 规则 `antd/modal-no-destroy-on-close` 需访问 fiber 获取 `destroyOnClose` prop，而非仅检测 DOM
4. **位置计算**: portal 内的元素 `getBoundingClientRect()` 返回视口坐标，canvas 坐标匹配，无需额外转换

### 5.6 其他次要风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| Bippy API 不稳定（v0.5.x） | 升级时 breaking | 锁定版本，核心逻辑薄封装 |
| Preact 与 React 18/19 兼容 | JSX runtime 冲突 | Shadow DOM 内独立 Preact，不影响宿主 |
| 大型页面性能（>1000 fiber） | 审计耗时 | `requestIdleCallback` + 增量处理 |
| antd v4/v5 API 差异 | 规则需双版本 | 规则定义支持版本标记 `antdVersions: [4,5]` |

---

## 6. 结论与下一步

**推荐技术栈**: `vite-plugin-adx` + `@adux/runtime`（依赖 bippy + preact）

**实现顺序建议**:
1. **Day 1-2**: 搭建 vite plugin + Bippy instrument + Canvas overlay（验证冒烟）
2. **Day 3-4**: 实现 2-3 条核心规则（如 Table 分页缺失检测）+ Tooltip 浮窗
3. **Day 5**: 处理边缘情况（Portal 内 overlay、HMR 清理、iframe 标记）
4. **Day 6-7**: Sidebar 违规列表 + 点击跳源码

**不需要自研的部分**（直接复用 OSS）:
- Fiber 遍历: `bippy`（MIT）
- React 内部访问: `bippy` 的 `instrument()` / `getSource()` / `getNearestHostFibers()`
- 轻量 UI 框架: `preact`（MIT）
- 编辑器中跳转: `launch-editor-middleware`（MIT，Vite 生态标准）

**必须自研的部分**:
- 规则定义格式与引擎（ADUX 独有需求）
- Canvas overlay 绘制逻辑（基于 react-scan 的 canvas.ts 改造）
- antd 组件特定检测逻辑（如检测 Button loading、Form rules、Table pagination）
- Portal 内组件的 overlay 定位

---

## 附录：源码引用索引

| 项目 | 关键文件 | 关注点 |
|------|---------|--------|
| axe-core | `lib/core/public/run.js` | 审计执行流程 |
| @axe-core/react | `packages/react/index.ts` | React.createElement monkey-patch |
| Bippy | `src/core.ts`, `src/source/get-source.ts` | Fiber instrument + source mapping |
| react-scan | `src/core/instrumentation.ts` | Instrumentation 架构 |
| react-scan | `src/new-outlines/index.ts` | Canvas overlay 绘制 + Worker |
| react-scan | `src/web/toolbar.tsx` | Shadow DOM + Preact UI |
| react-scan | `src/web/views/inspector/overlay/index.tsx` | Canvas overlay 动画 |
| react-scan | `packages/vite-plugin-react-scan/src/index.ts` | Vite plugin 注入模式 |
| react-scan | `src/react-component-name/babel/index.ts` | 构建时 displayName 注入 |
| Million | `packages/react/its-fine.tsx` | Fiber 访问 hooks |
| Nuxt DevTools | `src/module-main.ts` | Vite plugin 注入 + iframe |
| Nuxt DevTools | `src/integrations/vue-tracer.ts` | Vue 组件 inspector |
