# 造游社 · 员工 Sprite 工厂

独立的匿名像素员工资产批量后处理工具。v1.1 以 **18 个固定 Character Slot** 为核心，不负责生成角色或判断员工身份。

当前支持：

- MP4 / WebM 浏览器拆帧，支持有效时间区间与采样 FPS
- PNG / GIF / WebP 图片或序列导入
- 18 人 `6×3`、`9×2`、`3×6`、`18×1`、`2×9` 固定布局
- Photoshop Slice Tool 式 18 切片系统：创建、选中、拖动、八方向缩放、编号、单独锁定与删除
- 一键重置为 `6×3`，随后每个切片都可独立调整，不要求等分或铺满输入画面
- 基础批次 Slice Template 可保存 / 加载并跨动作复用
- 任一动作可以复制基础模板建立独立 Slice Override，也可随时移除 Override 回退到基础模板
- 同一动作素材按 Slot 切人，并自动归入 18 个匿名 Visual Asset
- 四角背景取色、容差与边缘连通抠图
- Pixel Edge Alpha 量化
- 80×96 标准画布、角色高度归一与脚底 / 坐姿锚点
- Frame Review 播放、删坏帧、复制、镜像、推荐采样
- 帧尺寸、透明边、空帧、尺度与裁切 QA
- 18 人批量 ZIP：每人独立 Sprite Sheet PNG + JSON Metadata
- 含处理后帧的批次 JSON 保存 / 恢复
- 独立 Walk Right；没有素材时可人工选择从 Walk Left 镜像
- 只读角色生产规范，允许兽耳、人外、异形、外星人、天使、恶魔、植物生命、机械生命与原创克苏鲁式奇异生物

## 启动

```powershell
npm install
npm run dev
```

浏览器打开 Vite 输出的本地地址。

## 构建

```powershell
npm run build
```

产物输出到 `dist/`。

## GitHub Pages

仓库已经包含 `.github/workflows/deploy-pages.yml`。推送到 `main` 后会自动构建并发布站点。

仓库 Settings → Pages → Build and deployment 需要选择 **GitHub Actions**。首次启用后，后续推送会自动更新网站。

## 生成图片与仓库存储

本工具不调用 AI 生图 / 生视频 API。外部 AI 负责生成 18 人角色图和动作视频，本工具负责拆帧、分人、清理、对齐、按角色合并和导出。

浏览器内生成的 Sprite Sheet 和 JSON 默认下载到本地。静态 GitHub Pages 不持有仓库写权限，因此不会自动提交文件。

推荐流程：

1. 在网站处理并导出资产。
2. 将导出文件放入仓库的 `assets/staff/<character_id>/`。
3. 由 GitHub 网页上传、Git 客户端或 Codex 提交。

若未来需要网页一键写回仓库，应增加 GitHub OAuth / GitHub App 后端，令牌不得写入前端代码。

## 当前边界

- 视频拆帧在浏览器内完成，单个视频最多采样 180 帧，避免页面失控。
- 当前参数在导入时应用；修改抠图或对齐参数后需重新导入原素材。
- 图片与视频拆帧始终读取目标动作当前生效的 Slice Rect；动作 Override 优先于基础模板。
- 开始拆帧时必须正好有 18 个切片，但切片可以留边距、重叠或使用不同尺寸。
- 不保存姓名、稀有度、职业、数值、Prompt Anchor 或固定角色绑定。
- 不修改 Game Core、SQLite、Staff Catalog 或 MCP。
