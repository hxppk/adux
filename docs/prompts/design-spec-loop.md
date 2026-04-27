# Image Prompt — ADUX 设计规范闭环（Design-Spec Loop）

> 用途：嵌入飞书 wiki `TwvGwtaFkiRcz1kBfNxcgvDXnge` 「设计规范闭环」段顶部 + 仓库 README「Vision」段（待补） + `docs/usage-guide.md`（待重写时）。
>
> 目标产物：单张 hero 圆环 / 闭环示意，1672×941，与 usage-guide 现有 5 张图 + v0.1-release-path 1 张图风格一致（gpt-image-2 出图）。
>
> 配图责任人：codex（gpt-image-2）。本文件由 claude-code 维护文案；codex 出图后上传飞书云空间拿稳定 image_token，由 claude-code 用 lark-cli 替换 wiki 中的占位句。

---

## 立意（图要传达的）

ADUX 把**设计规范从生成到验收的闭环**串起来：

- 设计师维护两类规范资产：**Generation Skill**（给 agent / PM 用）+ **Review Skill**（给 ADUX CLI 用）
- 整个闭环 5 阶段绕一圈：维护规范 → 生成原型 → 审查验收 → 修复合规 → 反哺规范

图必须让看的人**一眼意识到「闭环」而非「流水线」**——结尾要回到起点，不是到此为止。

---

## Style guardrails（与 usage-guide 现有图 + v0.1-release-path 图风一致）

- 风格：**flat illustration + 浅 isometric / 极轻景深**，柔和 vector 描边
- 背景：**off-white #FAFAFA → 浅蓝灰 #F0F4FA 的极轻渐变**，留白充足
- 主色板：
  - 主色 `#1677FF`（Ant Design 蓝）
  - 阶段块底色（5 个阶段每个一种相近暖/冷色）：`#E6F4FF` `#F6FFED` `#FFF7E6` `#FFF1F0` `#F9F0FF`
  - 文字深灰 `#262626`，副文字 `#8C8C8C`
  - 闭环箭头 `#1677FF` 50% 透明
- 字体：sans-serif（Inter / PingFang SC 视觉感），加粗用于阶段标题
- 图标风格：**rounded square outline + 1.5px stroke + 极简 fill**，与 antd 官方插图一致
- **必须避免**：AI 拟物风、照片合成、中文模糊渲染——所有标签清晰可读
- **必须避免**：把闭环画成"5 个独立卡片用直箭头串成一行"——那是流水线不是闭环

---

## Composition

**整体形状**：5 阶段沿一个**圆环 / 椭圆**排列，箭头**顺时针流动**，结尾⑤ 反哺规范用粗实线箭头明确指回 ①，闭环视觉强烈。中央留白即可（不画节点）。

**5 个节点**（圆形 / 圆角矩形卡片，每个 ~280×180）：

### ① 维护规范

- 位置：**12 点钟方向（顶端）**
- 图标：设计师人像 + 两份 markdown 文档叠在桌面（标签 `Generation` 和 `Review`）
- 标题：**维护规范**
- 副文案（控制 2 行）：设计师维护两份 skill · 同一团队规范的两种用法
- 底部小药丸（2 个）：`Generation Skill`（蓝） / `Review Skill`（绿）
- 状态色：`#E6F4FF`

### ② 生成原型

- 位置：**右上 ~2 点钟**
- 图标：PM / 工程师 + 一只 robot agent 头像 + Vite logo + antd 主色按钮预览
- 标题：**生成原型**
- 副文案（2 行）：PM/agent 用 Generation Skill · 一句话需求 → 高保真 antd 原型代码
- 底部小药丸：`Claude Code agent` `pnpm create vite`
- 状态色：`#FFF7E6`

### ③ 审查验收

- 位置：**右下 ~5 点钟**
- 图标：放大镜 + ADUX logo（如有）+ 三角色报告产物文件叠（`index.html` / `frontend.md` / `developer.md`）
- 标题：**审查验收**
- 副文案（2 行）：ADUX CLI 用 Review Skill · 自动出三角色报告
- 底部命令栏（mono、灰底）：`adux audit . --yes`
- 状态色：`#F6FFED`

### ④ 修复合规

- 位置：**左下 ~7 点钟**
- 图标：前端工程师 + VS Code 窗口截图缩略 + cmd+click 跳转高亮线条
- 标题：**修复合规**
- 副文案（2 行）：FE 看 frontend.md 改代码 · cmd+click 跳到行号 · 重跑 audit 直到 error=0
- 底部小药丸：`error: 0 → ship`
- 状态色：`#FFF1F0`

### ⑤ 反哺规范

- 位置：**左上 ~10 点钟**
- 图标：折线图（向下趋势 = 错误数下降）+ 双向箭头回到设计师
- 标题：**反哺规范**
- 副文案（2 行）：发现普遍违反项 · Designer + Tech Lead 复盘 · 更新两份 skill 资产
- 底部小药丸：`PR 复盘` `error trend ↓`
- 状态色：`#F9F0FF`

---

## 顶部条幅（标题区）

横幅主标题：**ADUX 设计规范闭环 · Design-Spec Loop**
副标题（小字）：「Generation Skill 决定代码长什么样，Review Skill 决定代码达不达标——同一团队规范的两种用法」

---

## 图后 caption（嵌入文档时使用）

> *图：ADUX 设计规范从生成到验收的闭环。设计师维护 Generation Skill（agent 用）+ Review Skill（CLI 用）两份资产；PM/agent 用 Generation Skill 生成原型；ADUX 用 Review Skill 自动审查；前端按报告修到合规；趋势数据反哺 Designer 迭代规范。*

---

## 出图后操作（codex 责任）

1. 用本 prompt 直接喂 gpt-image-2，输出 `1672×941` PNG
2. PNG 落到 `docs/assets/design-spec-loop.png`，commit 到 `feat/skill-ux-v0.1` 分支（或 codex 觉得合适的分支）
3. 用 `lark-cli docs +media-insert --as user --doc ZXM7defbMo063Zx1mlwcJf4Cnrh` 上传 PNG 到飞书 docx，拿到稳定 image_token（注意：直接 drive upload 拿到的 token 我用 user identity 下载会 403——参考 v0.1-release-path 那次的经验，必须走 `docs +media-insert` 路径）
4. 把 image_token 通过 a2a 发回 claude-code
5. claude-code 用 `lark-cli docs +update --mode replace_range` 把 wiki 「设计规范闭环」段中的「配图待补」占位句替换为：
   ```
   <image token="<TOKEN>" width="1672" height="941" align="center"/>
   ```
   并清理 media-insert 末尾的临时 trailing image block

---

## 修订历史

- 2026-04-27 claude-code 初稿（与 codex T1-T5 product-positioning 对齐：5 阶段闭环 + Generation Skill / Review Skill 两轨命名）
- 2026-04-27 claude-code 修订：依用户「如无必要，勿增实体」原则，删除中央节点与远期路线引用；图只画当前要的 5 阶段闭环
