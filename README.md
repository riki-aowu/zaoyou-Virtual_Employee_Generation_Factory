# 造游社 · 员工 Sprite 工厂

独立的匿名像素员工资产批量后处理工具。当前版本以 **18 个固定 Character Slot** 为核心，不负责生成角色或判断员工身份。

当前支持：

- MP4 / WebM 浏览器拆帧，支持有效时间区间与采样 FPS
- 导入视频时完整保留候选 Raw Frames，但时间轴自动只显示动作推荐帧：待机 4、行走 8、打字 6、庆祝 8、疲劳 5
- 支持按动作填写自定义最终帧数；18 个角色严格共用同一组均匀采样索引和时间点
- 调整切片或重新应用动作时继续复用 Selected Frame Index，不会恢复成全部候选帧
- “重新推荐采样”可随时从当前浏览器内存中的候选 Raw Frames 生成一套新最终帧
- PNG / GIF / WebP 图片或序列导入
- 18 人 `6×3`、`9×2`、`3×6`、`18×1`、`2×9` 固定布局
- Photoshop Slice Tool 式 18 切片系统：创建、选中、拖动、八方向缩放、编号、单独锁定与删除
- 一键重置为 `6×3`，随后每个切片都可独立调整，不要求等分或铺满输入画面
- 切片默认自动应用：拖动或缩放时只更新框，松手后仅重算当前动作的当前角色；数值修改采用 200ms 防抖
- 保留“重新应用当前动作”作为整条动作手动重算兜底
- 基础批次 Slice Template 可保存 / 加载并跨动作复用
- 任一动作可以复制基础模板建立独立 Slice Override，也可随时移除 Override 回退到基础模板
- 导入时在当前浏览器会话保留每个动作的原始拆帧；调整切片后点击“应用切片到当前动作”，会替换旧裁剪结果并立即刷新 Frame Review
- 点击 Batch View 中的切片会同步选中同编号 Character Slot，不再出现调整 08、底部却仍显示 01 的错位
- 同一动作素材按 Slot 切人，并自动归入 18 个匿名 Visual Asset
- 四角背景取色、容差与边缘连通抠图
- 左侧 Batch、Slice、导入、抠像、画布分类均可折叠，展开状态保存在浏览器
- 每动作独立背景参数；支持四角最接近色组采样、点击取色、白/黑/自定义背景色
- 像素角色 / 白底插画 / 黑底素材快速预设，以及一键去白边
- 角色内部浅色保护、RGB Euclidean 颜色距离、边缘溢色去污染、弱透明清理、保守 Alpha 收缩
- Pixel Edge / Binary Alpha 硬边输出，羽化与 Pixel Edge 互斥
- Original、Mask、Transparent、Black/White/Checkerboard 预览及 4× Edge Inspection
- White Fringe、Weak Alpha Halo、Over-Eroded QA
- 96×112 默认 Source Canvas（可切换 80×96 或自定义）
- Character → Clip → Frame 三级对齐：角色固定 Canonical Scale、站立 / 坐姿 Pivot、动作 Clip Offset、单帧 Frame Offset
- 固定尺度管线：只在建立角色基准时计算一次 Scale，不再逐帧按 bbox 缩放或自动居中
- 建立角色固定缩放后默认锁定；后续导入动作不会重新计算角色级比例
- 每个动作拥有全帧共用的 Action Scale；按参考动作与当前动作 cleaned bbox 中位高度自动估算
- 最终绘制缩放固定为 `canonicalScale × actionScale`，既统一角色比例，又消化不同视频的源尺寸差异
- 角色基准扫描全部已导入站立动作的 cleaned Motion Envelope，并按上下左右安全边距计算统一比例
- 分离检查源切片四边接边与标准画布四边越界，不再静默裁掉头发、兽耳、手部或鞋底
- Raw Slice View / Canonical Canvas View 双视图，以及跨动作 Onion Skin 对齐预览
- Frame Review 播放、删坏帧、复制、镜像、推荐采样
- Canonical Scale、Pivot Drift、Clip Boundary、透明边与空帧 QA
- 18 人批量 ZIP：`game/` 内 Trim Sprite Sheet + 可还原 Canonical 坐标的 JSON；可选输出 Original / Mask / Clean Debug
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
- Scale、Pivot、Clip Offset 与 Frame Offset 修改后会立即重建当前角色画布；Slice Rect 修改后点击“应用切片到当前动作”重裁。
- 去白边算法参数按动作保存；“应用到整个 Batch”只复制算法参数，保留每个动作自己的背景色。
- 图片与视频拆帧始终读取目标动作当前生效的 Slice Rect；动作 Override 优先于基础模板。
- 开始拆帧时必须正好有 18 个切片，但切片可以留边距、重叠或使用不同尺寸。
- 完整视频源帧只保留在当前浏览器内存中；批次 JSON 保存每个 Slot 已裁出的 Raw Slice、Canonical 帧和对齐参数。重新打开批次后可继续对齐，但要再次修改 Slice Rect 仍需重新导入视频源。
- 不保存姓名、稀有度、职业、数值、Prompt Anchor 或固定角色绑定。
- 不修改 Game Core、SQLite、Staff Catalog 或 MCP。
