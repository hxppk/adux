# ADUX Release Checklist (v0.0.4 alpha — GitHub Release Tarball)

> 当前发布路径：**GitHub Release tarball**，不走 npm 公开 registry。等 v0.1 正式版再切到 `npm publish`。
> 用户安装入口：`pnpm add -D https://github.com/hxppk/adux/releases/download/<tag>/<asset>.tgz`。

---

## 0. Pre-flight — 工作树检查

- [ ] `git status` 干净，没有未提交改动
- [ ] 在 `main` 分支或基于 `main` 的 release 分支
- [ ] 上一次 release tag 检查：`git tag --list | tail -3`

---

## 1. 版本号 bump

**单一 source of truth**：把目标版本（如 `0.0.4-alpha.0`）同步到以下位置：

| 位置 | 字段 | 说明 |
|---|---|---|
| `packages/cli/package.json` | `version` | 发布包 |
| `packages/core/package.json` | `version` | 发布包（CLI 已 bundle，单独发以备未来复用） |
| `packages/runtime/package.json` | `version` | 发布包 |
| `packages/vite-plugin/package.json` | `version` | 发布包 |
| `packages/generator/package.json` | `version` | private，**不发布**但版本号一起 bump 保持一致 |

> CLI 不再 hardcode 版本字面量 — `bin.ts` 在运行时从 `cli/package.json` 读取并传给 `cli.version(...)`。**只需改 `package.json`，无需改 `bin.ts`**。
>
> `examples/playground` 是 workspace 内部应用，不参与发布。

`@adux/cli` 的 `dependencies` 在源码里**不**显式声明 `@adux/core` —— tsup 配置用 `noExternal: ["@adux/core"]` 把 core 全部 inline 进 `dist/bin.js`。最终 tgz 里的 `package.json` 不含 `@adux/core` 依赖，CLI 单 tgz 自洽。

---

## 2. 验证

按顺序跑（任何一步失败，stop 修复后重来）：

- [ ] `pnpm install` — 确认 lockfile 同步
- [ ] `pnpm -r build` — 全包产出 `dist/`
- [ ] `pnpm -r typecheck` — 类型干净
- [ ] `pnpm -r test` — 全单测绿
- [ ] `node packages/cli/dist/bin.js --version` — 输出与 `cli/package.json.version` 一致
- [ ] **冷启动 smoke**（在仓库外的临时目录）：
  ```bash
  pnpm pack:smoke    # 入口在仓库根，调用 scripts/pack-smoke.mjs
  ```
  脚本会做：`pnpm -r build` → 各发布包 `pnpm pack` 到 mkdtemp → 临时项目 mkdtemp → `pnpm add` 仅装 `adux-cli` tgz → 校验 `adux --version` 包含目标版本 → 跑 `adux init . --yes` / `adux skill init` / `adux skill import` / `adux audit . --yes` → 然后单独 install `core / runtime / vite-plugin` tgz 验证 import 不报错。**所有临时目录在脚本成功时自动清理**，不会留下 `/tmp/adux-release-*`。

---

## 3. 打 tarball（用于 GitHub Release 上传）

`pack:smoke` 用 mkdtemp 清理式跑，不留产物。**正式发布要手工 pack 到稳定路径**：

```bash
RELEASE_DIR=/tmp/adux-release-v0.0.4-alpha.0
mkdir -p "$RELEASE_DIR"
cd packages/cli         && pnpm pack --pack-destination "$RELEASE_DIR" && cd -
cd packages/core        && pnpm pack --pack-destination "$RELEASE_DIR" && cd -
cd packages/runtime     && pnpm pack --pack-destination "$RELEASE_DIR" && cd -
cd packages/vite-plugin && pnpm pack --pack-destination "$RELEASE_DIR" && cd -

ls "$RELEASE_DIR"
# 期望（pnpm pack 把 @adux 前缀转成 adux-）：
#   adux-cli-0.0.4-alpha.0.tgz          (~55 KB, 已 bundle core)
#   adux-core-0.0.4-alpha.0.tgz         (~32 KB)
#   adux-runtime-0.0.4-alpha.0.tgz      (~15 KB)
#   adux-vite-plugin-0.0.4-alpha.0.tgz  (~4 KB)
```

> **不要**手动 `npm pack`：pnpm pack 会正确改写 `workspace:*` 依赖；npm pack 在 monorepo 里行为不一致。

---

## 4. Tag + GitHub Release

```bash
# tag
git tag -a v0.0.4-alpha.0 -m "v0.0.4-alpha.0 — first installable release tarball"
git push origin v0.0.4-alpha.0

# 发 release（可附简要 changelog）
RELEASE_DIR=/tmp/adux-release-v0.0.4-alpha.0
gh release create v0.0.4-alpha.0 \
  --title "v0.0.4-alpha.0" \
  --notes "First installable release. See README Install / Try it for usage." \
  --prerelease \
  "$RELEASE_DIR"/adux-cli-0.0.4-alpha.0.tgz \
  "$RELEASE_DIR"/adux-core-0.0.4-alpha.0.tgz \
  "$RELEASE_DIR"/adux-runtime-0.0.4-alpha.0.tgz \
  "$RELEASE_DIR"/adux-vite-plugin-0.0.4-alpha.0.tgz
```

---

## 5. 发布后验证（fresh user 视角）

- [ ] 在另一台机器或全新临时目录（无 ADUX 仓库 / 无 link）：
  ```bash
  mkdir /tmp/adux-fresh && cd /tmp/adux-fresh
  pnpm init -y
  pnpm add -D https://github.com/hxppk/adux/releases/download/v0.0.4-alpha.0/adux-cli-0.0.4-alpha.0.tgz
  ./node_modules/.bin/adux --version    # → 0.0.4-alpha.0
  ./node_modules/.bin/adux audit . --yes
  ```
- [ ] 至少在一个真实业务项目（`recommend-admin-prototype` 或类似）跑 audit 不出错
- [ ] vite-plugin 安装样板（如要验证 overlay）：
  ```bash
  pnpm add -D https://github.com/hxppk/adux/releases/download/v0.0.4-alpha.0/adux-vite-plugin-0.0.4-alpha.0.tgz \
              https://github.com/hxppk/adux/releases/download/v0.0.4-alpha.0/adux-runtime-0.0.4-alpha.0.tgz
  ```

---

## 6. 发布后文档更新

- [ ] README「Install / Try it」章节链接更新到本次 tag 的 URL
- [ ] `docs/roadmap.md` 标 R10（npm publish）当前进度（首次 GitHub tarball ✅；npm 公开 registry pending）
- [ ] 飞书《ADUX 用户操作指南》补充安装方式（先用 pnpm add tgz 命令；`adux audit .` 流程不变）

---

## 7. Rollback / 修复

如果发布后发现 critical bug：

1. **不要** `git tag -d` 已 push 的 tag（会让用户拿到旧 tgz 失败）。让旧 tag 保留作历史。
2. 修代码 → bump 到下一个 alpha（`0.0.4-alpha.1`）→ 走完整 checklist 重新发
3. 在 GitHub release 页面把旧 release 标记为 "deprecated" + 写 release note 引导用户用新 tag
4. 如果 tarball 本身有泄露/安全问题（非功能 bug），用 `gh release delete <tag> --yes` 从 release 页面下架（tag 仍在 git）

---

## 8. v0.1 正式版迁移路径（npm public 切换）

> 锚定承诺（飞书 wiki + README + roadmap 三处同句）：「找最新版本：[GitHub Releases](https://github.com/hxppk/adux/releases)。**v0.1 正式版会切到 npm registry**，那时只需 `pnpm add -D @adux/cli`。」
>
> v0.1.0 cut 全量标准见 [`roadmap.md` 「🎯 v0.1.0 cut 标准」](roadmap.md#-v010-cut-标准首个-npm-public-版)。本节是发布操作侧 checklist。

### 8.1 一次性基建（cut v0.1.0 之前完成）

- [ ] 注册 `@adux` npm 组织 / scope，或换不带 scope 的包名
- [ ] 在 npm 生成 publish-only token，加入 GitHub repo secret `NPM_TOKEN`
- [ ] 4 个 public 包 `package.json` 全部加：
  - `publishConfig.access: "public"`
  - `publishConfig.tag: "alpha"`（v0.1.0-rc/alpha 时段；切 stable 后改默认 `latest`）
  - `repository: { type: "git", url: "https://github.com/hxppk/adux.git", directory: "packages/<name>" }`
  - `bugs: { url: "https://github.com/hxppk/adux/issues" }`
  - `homepage: "https://github.com/hxppk/adux#readme"`
  - `license: "MIT"`（或确认采用的协议）
  - `author`、`keywords`（antd / lint / design-system / vite / runtime 等）
- [ ] 仓库根加 `LICENSE` 文件，与各包 `license` 字段一致
- [ ] 引入 changesets：
  - `pnpm add -Dw @changesets/cli && pnpm changeset init`
  - PR 模板要求附 `pnpm changeset add`（CI 缺 changeset 时给 warning）
  - 配置只对 4 个 public 包发版（`generator` / `playground` 进 ignore）
- [ ] `generator` / `playground` 在 `package.json` 显式 `"private": true`，避免误发

### 8.2 切换发布流（v0.1.0 起）

- [ ] 新 GitHub Actions workflow `release.yml`：
  - Trigger：tag `v*` push（或 changesets PR merge）
  - Steps：checkout → setup node + pnpm → install → typecheck → test → `pnpm pack:smoke` → `pnpm publish -r --access public --no-git-checks` → `gh release create` 收尾（CHANGELOG 内容 + 4 个 tgz 备份）
- [ ] 验证 dry-run：在 fork / 临时 tag 上跑一次 workflow，确认 publish 步前自动 stop（用 `--dry-run` 或缺 token）
- [ ] 文档化「npm 走通后 GitHub Release tarball 仍发」决策（用作 npm-down 兜底）

### 8.3 npm install smoke（v0.1.0-rc 阶段）

发 rc 后，在仓库外的临时目录验证 fresh user 视角：

```bash
mkdir /tmp/adux-npm-smoke && cd /tmp/adux-npm-smoke
pnpm init -y
pnpm add -D @adux/cli@<rc-version>
./node_modules/.bin/adux --version    # → 0.1.0-rc.X
./node_modules/.bin/adux audit . --yes
```

vite-plugin overlay（R6 零配置活体证明 — **故意不显式装 `@adux/runtime`**，跑通才算 R6 没退）：

```bash
pnpm create vite@latest sample -- --template react-ts && cd sample
pnpm install

# 关键：只装 vite-plugin，不装 runtime（验证 R6 零配置承诺）
pnpm add -D @adux/vite-plugin@<rc-version>
# ⚠️ 不要 pnpm add @adux/runtime —— 任何手动 devDep 装 runtime 的指令都不能写进用户文档

# 在 vite.config.ts 加 plugin
cat > vite.config.ts <<'EOF'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import adux from "@adux/vite-plugin";
export default defineConfig({ plugins: [react(), adux({ runtime: { debug: true } })] });
EOF

# 写一个最小违规 App，保证 overlay 一定有命中可显示
cat > src/App.tsx <<'EOF'
export default function App() {
  return (
    <div style={{ display: "flex", color: "#ff0000", padding: 16 }}>
      <button>Bare button — should trigger require-antd-component</button>
    </div>
  );
}
EOF

# 固定 host/port，便于 CI 抓 console / 截图
pnpm dev --host 127.0.0.1 --port 5173 &
sleep 5

# 三选一确认 runtime 模块成功加载（任一通过即 smoke 绿）
# (a) 最轻量：curl 命中 vite virtual module（说明 transformIndexHtml 注入成功）
curl -sf http://127.0.0.1:5173/ | grep -q "adux-runtime" && echo "[smoke] script tag injected"

# (b) 抓 console：用 Playwright/Puppeteer 打开页面，期望 console 出现 "adux runtime init"（debug=true 时）
# (c) 抓 panel DOM：document.querySelector('div[data-adux-overlay]') 不为 null
```

**失败通路诊断**：如果 (a)~(c) 任一失败，**不要**在用户文档里加「请补 `pnpm add -D @adux/runtime`」；这会破坏 R6 承诺。正确动作是 v0.1 前修代码侧——把 `@adux/runtime` 从 vite-plugin 的 `peerDependencies` 改成 `dependencies`，或在 vite-plugin 构建时 `noExternal` bundle 进自身 `dist/`。详见 `roadmap.md` R6 段。

### 8.4 切换后回滚策略

- [ ] 不要 `npm unpublish`（24h 内可，但会破坏已 install 的下游）
- [ ] 用 `npm deprecate @adux/cli@<bad-version> "use @adux/cli@<next>"` 标 deprecated
- [ ] 立即发 patch 版本（`pnpm changeset add` → release flow）
- [ ] GitHub Release tarball 永远保留，作为 npm-down 时的二级安装路径
