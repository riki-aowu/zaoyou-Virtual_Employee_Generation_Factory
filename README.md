# 造游社 · 员工 Sprite 工厂

独立的像素员工资产加工工具。当前 MVP 支持：

- PNG / GIF / WebP 单图或序列导入
- 按行列拆分 Sprite Sheet
- 四角背景取色、容差与边缘连通抠图
- Pixel Edge Alpha 量化
- 80×96 标准画布、角色高度归一与脚底 / 坐姿锚点
- 动作时间轴播放、删帧、复制、镜像
- 帧尺寸、透明边、空帧、尺度与裁切 QA
- 固定网格 Sprite Sheet PNG + JSON Metadata 导出
- 含处理后帧的项目 JSON 保存 / 恢复

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

浏览器内生成的 Sprite Sheet 和 JSON 默认下载到本地。静态 GitHub Pages 不持有仓库写权限，因此不会自动提交文件。

推荐流程：

1. 在网站处理并导出资产。
2. 将导出文件放入仓库的 `assets/staff/<character_id>/`。
3. 由 GitHub 网页上传、Git 客户端或 Codex 提交。

若未来需要网页一键写回仓库，应增加 GitHub OAuth / GitHub App 后端，令牌不得写入前端代码。

## 当前边界

- 第一版专注浏览器端 PNG 处理；MP4 / WebM + ffmpeg 拆帧放在后续 P7。
- 重新处理按钮暂不保留原始高分辨率帧；修改抠图参数后需重新导入原素材。
- 单次导出生成 PNG 和 JSON 两个下载文件，批量 ZIP 待后续补齐。
- 不修改 Game Core、SQLite、Staff Catalog 或 MCP。
