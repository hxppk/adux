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

## 8. v0.1 正式版迁移路径（未来）

发到 npm 公开 registry 时需补做：

- [ ] 注册 `@adux` npm 组织 / scope，或换不带 scope 的包名
- [ ] 各发布包 `package.json` 加 `publishConfig.access: "public"` 和 `publishConfig.tag: "alpha"`（如仍是 alpha）
- [ ] 各发布包补 `repository / license / author / bugs / homepage / keywords` 字段
- [ ] 加 `LICENSE` 文件
- [ ] `pnpm publish -r --access public` 替代 `pnpm pack` + GitHub release 上传
- [ ] CI 接入（GitHub Actions on tag push → 自动 publish）
