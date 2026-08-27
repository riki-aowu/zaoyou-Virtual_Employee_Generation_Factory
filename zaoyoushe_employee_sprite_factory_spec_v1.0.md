# 造游社｜员工 Sprite 工厂实施规格 v1.0

> Employee Sprite Factory / Pixel Character Asset Pipeline

## 0. 文档定位

本工具用于《造游社》的员工像素角色资产生产，不负责游戏核心玩法，也不负责 AI 生成模型本身。

目标：把 AI 生成的角色动作图、动作序列或动作视频，稳定加工成可直接进入游戏的标准化 Sprite 资产。

核心流程：

```text
角色参考 / AI 动作图 / 视频
        ↓
导入
        ↓
角色识别 / 分格
        ↓
自动抠图
        ↓
统一尺寸 / 统一比例
        ↓
脚底锚点 / 坐姿锚点
        ↓
去抖动 / 像素边缘清理
        ↓
动作时间轴编辑
        ↓
预览
        ↓
导出 PNG Sprite Sheet + JSON Metadata
```

本工具是资产加工工具，不调用 Game Core，不修改 SQLite，不依赖 MCP，不承担员工属性、招聘、工资、职业成长等业务逻辑。

---

# 1. 本次视觉方向调整

《造游社》正式角色表现从原 2.5D / 3D 方案切换为：

> **俯视 / 斜俯视像素经营游戏风格，参考《星露谷物语》的角色可读性、比例稳定性与温暖像素质感，同时结合《游戏发展国》的员工经营动画需求。**

重要：

- 参考的是像素角色的阅读性、体型比例、动画简洁度和游戏内辨识度。
- 不复制《星露谷物语》的具体角色、服装、地图、美术素材或原始调色板。
- 所有员工必须遵循统一的人体比例规范，避免不同批次出现“大头娃娃 / 小头长身 / 身高突然变化 / 肩宽差异巨大”。
- 角色差异应主要来自：发型、发色、肤色、服装、配饰、职业细节、轮廓，而不是随意改变骨架比例。

---

# 2. 员工资产分级策略

本项目员工视觉资产分两套生产策略。

## 2.1 普通 / 优秀员工：随机内容员工

普通、优秀员工不绑定固定名字。

运行时由内容系统随机生成或抽取：

- 姓名
- 性别 / 外观标签
- 发型
- 发色
- 肤色
- 基础服装
- 少量配饰
- 职业倾向
- 数值
- 潜力
- 工资

Sprite 工厂不需要为普通 / 优秀员工建立“角色名 → 固定外观”的强绑定。

建议实现：

```text
random_staff_visual_id
例如：staff_pool_f_023
```

游戏运行时：

```text
随机姓名
+ 随机数值
+ 一个标准化视觉模板
```

同一视觉模板可以在不同存档对应不同名字和属性。

### 好处

- 不需要为几十 / 上百名普通员工逐个维护角色设定。
- 避免玩家形成“看脸认攻略”的固定最优解。
- 可以持续扩充普通员工视觉池，而不改业务结构。

---

## 2.2 精英 / 传奇员工：固定角色 + 视觉锚点

精英与传奇员工采用固定身份。

每个角色必须具有：

- 固定 `character_id`
- 固定名字
- 固定性别
- 固定角色定位
- 固定基础外观
- 固定主色 / 标志配饰
- 固定 Prompt Anchor
- 可选 Reference Image
- 独立 Sprite Asset Set

例如：

```text
elite_gg
legend_xingye_mio
```

这类角色必须保证：

> 不同动作、不同批次、后续新增动画时，看起来仍然是同一个人。

因此 Sprite 工厂需要为精英 / 传奇员工提供“角色锚点”字段。

---

# 3. Prompt Anchor 角色锚点

精英 / 传奇角色在工具中增加：

```text
Character Anchor
```

内容包含：

- 年龄层：adult
- 性别
- 发型
- 发色
- 瞳色
- 肤色
- 身材轮廓
- 服装主元素
- 标志性配饰
- 角色主色
- 不可改变特征

示例结构：

```text
角色：GG
adult male employee,
short white hair,
pink eyes,
soft white drooping animal-like ears,
slim office-worker build,
dark casual techwear jacket,
light inner shirt,
small pink accent,
calm expression,
consistent hairstyle and facial proportions in every frame
```

Prompt Anchor 只负责“谁是这个人”。

动作 Prompt 单独描述：

```text
walking left
sitting and typing
celebrating
idle
```

禁止每个动作重新自由描述角色长相。

---

# 4. 全局像素角色风格锚点

所有角色，无论普通、优秀、精英还是传奇，都必须附加同一套全局 Style Anchor。

推荐写死为模板配置，而不是每次人工输入。

## 4.1 Style Anchor

```text
warm cozy pixel-art management game character,
Stardew-Valley-like readability and compact proportions,
original character design, not copying any existing character,
small full-body game sprite,
consistent adult human proportions,
slightly oversized head but not chibi,
head-to-body ratio approximately 1:3.2 to 1:3.6,
compact torso,
short readable limbs,
clear silhouette,
front/side/back views must preserve the same body scale,
soft warm color palette,
clean pixel clusters,
limited anti-aliasing,
no painterly texture,
no high-detail anime illustration,
no super-deformed chibi,
no realistic long legs,
no drastic body-height variation between animation frames,
transparent or flat removable background,
centered character,
full body visible,
feet fully visible,
consistent camera angle,
consistent scale,
consistent lighting,
consistent pixel density
```

## 4.2 强制比例规则

建议工具内建立角色人体标准：

```text
标准成人员工：
总高：1.00
头部高度：0.28～0.31
躯干：0.30～0.33
腿部：0.34～0.39
肩宽：0.28～0.34 × 总高
```

视觉上保持：

> 微 Q，但不是大头娃娃。

不要允许某个角色突然变成：

- 2 头身
- 5～6 头身
- 超长腿
- 写实人体
- 日系立绘式细腰长腿

## 4.3 身高差策略

普通员工不要通过真实骨架缩放制造大量身高差。

建议：

### 普通 / 优秀

统一基础高度：

```text
100% ± 3%
```

主要靠头发、鞋、耳朵、帽子产生视觉高度差。

### 精英 / 传奇

允许有限角色身高差：

```text
94% ～ 106%
```

仍必须保持同一头身比例。

禁止：

> 身高差靠把一个人整体拉成长条。

---

# 5. Sprite 标准尺寸

## 5.1 工作帧尺寸

AI / 原图加工阶段：

```text
128 × 160 px / frame
```

用途：

- 方便抠图
- 方便自动对齐
- 保留发型 / 配饰细节
- 方便后续缩像素

## 5.2 游戏标准帧尺寸

推荐正式规格：

```text
80 × 96 px / frame
```

统一透明画布。

角色实际身体不强制填满整个画布。

建议站姿脚底统一在：

```text
anchorY = 88～92 px
```

头顶保留少量安全空间。

## 5.3 游戏显示

游戏内按整数倍缩放：

```text
1× / 2× / 3×
```

必须使用像素最近邻缩放。

禁止双线性模糊。

---

# 6. MVP 动作集合

Sprite 工厂第一版只支持员工经营游戏真正需要的动作。

## 6.1 必做动作

| ID | 中文 | 帧数建议 | Loop |
|---|---|---:|---|
| idle | 待机 | 4 | 是 |
| walk_down | 向下走 | 6 | 是 |
| walk_up | 向上走 | 6 | 是 |
| walk_left | 向左走 | 6 | 是 |
| typing | 坐着打字 | 6 | 是 |
| celebrate | 庆祝 | 8 | 否 / 可循环 |
| tired | 疲劳 | 4 | 是 |

## 6.2 镜像动作

```text
walk_right = walk_left + flipX
```

默认不重复生成右走资产。

但如果角色左右不对称，例如：

- 单侧机械臂
- 单肩包
- 单边刘海标志
- 单侧耳饰

可允许独立上传 `walk_right`。

---

# 7. Typing 动作规范

打字动作只包含人物，不包含：

- 桌子
- 电脑
- 椅子主体
- 键盘
- 办公室家具

角色表现：

- 坐姿
- 身体略向前
- 双手向前伸
- 手部轻微交替
- 肩膀轻微活动
- 头部可以有微小动作

游戏内由场景独立叠加：

```text
桌子
电脑
椅子
员工 typing sprite
```

这样同一员工可以复用于不同等级办公室和不同工位。

---

# 8. 输入格式

工具第一版支持：

- PNG Sprite Sheet
- 多张 PNG Sequence
- GIF
- WebM
- MP4

视频导入后：

1. 用户设置 FPS / 采样间隔
2. 自动拆帧
3. 进入统一处理流程

不要求工具负责 AI 视频生成。

---

# 9. 角色 / 动作批量导入

工具必须支持批量角色生产。

例如 AI 一次生成 6 个员工的 Typing 动作：

```text
GG
鱼头
甜心
乔乔
云兮
莉丝
```

用户指定：

```text
角色列数 = 6
角色行数 = 1
```

或：

```text
角色列数 = 3
角色行数 = 2
```

工具按角色切分后归档：

```text
GG / typing
鱼头 / typing
甜心 / typing
...
```

之后再导入 Celebrate：

```text
GG
├ idle
├ walk_down
├ walk_up
├ walk_left
├ typing
├ celebrate
└ tired
```

---

# 10. 自动抠图模块

## 10.1 支持背景取色

- 四角自动取色
- 点击画布取色
- 白色
- 黑色
- 绿色
- 自定义 RGB / HEX

## 10.2 参数

```text
Color Tolerance
Edge Connected Only
Protect Internal Regions
Alpha Threshold
Pixel Edge Mode
```

## 10.3 Edge Connected Only

默认开启。

原则：

> 只删除与画布边缘连通的背景色区域。

避免误删：

- 白头发
- 白衣服
- 眼白
- 高光
- 内部浅色区域

## 10.4 Pixel Edge Mode

默认开启。

开启后：

- 禁止羽化
- 禁止半透明边缘
- 禁止模糊抗锯齿
- Alpha 最终量化为 0 / 255

目标：避免像素角色周围出现灰边、白边或半透明脏像素。

---

# 11. 统一尺度与自动对齐

这是工具的核心功能，不可省略。

## 11.1 角色 Bounding Box

每帧自动检测非透明区域：

```text
minX
maxX
minY
maxY
```

计算角色实际高度与中心。

## 11.2 自动统一角色高度

同一角色同一动作：

```text
scale variance <= 2%
```

不同动作：

```text
standing visual height variance <= 3%
```

工具需要提示：

```text
⚠ 第 5 帧角色高度异常：+11%
```

用户可：

- 自动修正
- 忽略
- 手动缩放

---

# 12. 脚底锚点

## 12.1 Standing Anchor

站立 / 行走 / 庆祝 / 疲劳使用：

```text
anchor_type = feet
```

自动检测角色底部像素，并统一脚底 Y。

建议：

```text
pivotX = 0.5
pivotY = feet center
```

所有帧必须围绕同一个世界坐标播放。

## 12.2 Seat Anchor

Typing 使用单独锚点：

```text
anchor_type = seat
```

用于场景中的椅子 / 工位定位。

建议记录：

```text
seatAnchorX
seatAnchorY
handReachX
handReachY
```

其中 `handReach` 可选，仅用于以后更精确匹配桌面。

---

# 13. 去抖动 Stabilize

AI 视频拆帧常见问题：

- 人物左右漂移
- 头部高度抖动
- 脚底上下跳
- 整体缩放变化

工具提供：

```text
Auto Stabilize
```

处理顺序：

1. 脚底对齐
2. 水平中心对齐
3. 角色高度归一
4. 检测异常位移
5. 平滑非动作性抖动

注意：

不得把真实动作位移全部抹平。

例如 walk 中腿部与身体的正常上下起伏可以保留，但世界锚点不能漂移。

---

# 14. 动画时间轴

每个动作必须提供简单时间轴编辑器。

功能：

- 播放 / 暂停
- FPS
- Loop
- Ping Pong
- 拖动换帧
- 删除帧
- 复制帧
- 镜像帧
- 单帧持续时间
- 设置首帧
- 设置预览背景

异常 AI 帧可以直接删除，不需要重新跑整套资产。

---

# 15. 自动质量检查

导出前执行 Asset QA。

## 15.1 检查项

### Frame Size

是否全部为标准画布。

### Scale Consistency

角色高度变化是否异常。

### Anchor Consistency

脚底 / 坐姿锚点是否漂移。

### Alpha Edge

是否存在大量 1～254 半透明像素。

### Empty Frame

是否存在空白帧。

### Cropping

是否有头发、鞋、手臂越出画布。

### Color Explosion

像素化后颜色数量是否异常暴涨。

### Duplicate Frame

是否存在完全重复帧。

### Outlier Frame

是否出现体型 / 头部大小明显突变。

## 15.2 QA 状态

```text
绿色：通过
黄色：可导出但建议检查
红色：默认禁止批量导出
```

---

# 16. 像素化处理

如果输入为较高分辨率 AI 图片，可以提供可选：

```text
Pixelize
```

推荐流程：

1. 先完成抠图与对齐
2. 缩小到目标内部角色尺寸
3. 最近邻放回标准画布
4. 限制色阶
5. 清理单像素噪点
6. 保持透明背景

不要使用：

- 普通照片滤镜式“马赛克”
- 模糊后锐化
- 高强度描边滤镜

目标是：

> 干净的像素块，而不是被压糊的插画。

---

# 17. 调色板策略

第一版不强制所有角色共享完全相同的固定 16 色调色板。

但建议限制：

```text
单角色单帧有效颜色：32～64 色以内
```

可配置。

全局视觉需保持：

- 低到中等饱和度
- 暖色办公室兼容
- 阴影不过黑
- 高光不过白
- 不使用荧光霓虹

精英 / 传奇可拥有明显的标志色，但仍需融入统一像素世界。

---

# 18. 导出结构

推荐：

```text
/assets/staff/
  random/
    staff_pool_f_001/
      sprite.png
      sprite.json
    staff_pool_m_001/
      sprite.png
      sprite.json

  elite/
    elite_gg/
      sprite.png
      sprite.json
      anchor.json
    elite_yutou/
      sprite.png
      sprite.json
      anchor.json

  legend/
    legend_xxx/
      sprite.png
      sprite.json
      anchor.json
```

---

# 19. Sprite Sheet 布局

不要固定使用某个大型整图尺寸。

由实际动作和帧数自动计算。

建议：

```text
每个动作一行
每帧固定 80 × 96
```

例如：

```text
row 0 idle       4
row 1 walk_down  6
row 2 walk_up    6
row 3 walk_left  6
row 4 typing     6
row 5 celebrate  8
row 6 tired      4
```

每行不足最大帧数的区域保持透明。

最大列数：

```text
8
```

最终 Sheet：

```text
宽 = 80 × 8 = 640 px
高 = 96 × 7 = 672 px
```

这是推荐默认格式。

也允许：

```text
trimmed sheet + JSON frame rect
```

但 MVP 优先固定网格，方便调试。

---

# 20. JSON Metadata

示例：

```json
{
  "schemaVersion": 1,
  "characterId": "elite_gg",
  "frameWidth": 80,
  "frameHeight": 96,
  "sheetColumns": 8,
  "sheetRows": 7,
  "defaultFps": 8,
  "scale": 1,
  "standingAnchor": {
    "x": 0.5,
    "y": 0.94
  },
  "seatAnchor": {
    "x": 0.5,
    "y": 0.78
  },
  "animations": {
    "idle": {
      "row": 0,
      "frames": 4,
      "fps": 6,
      "loop": true
    },
    "walk_down": {
      "row": 1,
      "frames": 6,
      "fps": 8,
      "loop": true
    },
    "walk_up": {
      "row": 2,
      "frames": 6,
      "fps": 8,
      "loop": true
    },
    "walk_left": {
      "row": 3,
      "frames": 6,
      "fps": 8,
      "loop": true
    },
    "walk_right": {
      "source": "walk_left",
      "flipX": true
    },
    "typing": {
      "row": 4,
      "frames": 6,
      "fps": 8,
      "loop": true,
      "anchor": "seat"
    },
    "celebrate": {
      "row": 5,
      "frames": 8,
      "fps": 10,
      "loop": false
    },
    "tired": {
      "row": 6,
      "frames": 4,
      "fps": 5,
      "loop": true
    }
  }
}
```

---

# 21. 工具 UI

建议使用桌面网页 / Electron Renderer 风格。

## 左栏

### A. 项目

- 新建角色资产
- 打开角色资产
- 角色类型：Random / Elite / Legend
- Character ID
- Display Name（Elite / Legend）
- Prompt Anchor（Elite / Legend）

### B. Grid

- 角色列数
- 角色行数
- 动作帧数
- 单帧宽
- 单帧高

### C. 抠图

- Enable
- Auto Corner Sample
- Pick Color
- Tolerance
- Edge Connected Only
- Protect Internal
- Pixel Edge
- Alpha Threshold

### D. Alignment

- Auto Feet Anchor
- Auto Seat Anchor
- Center X
- Normalize Height
- Stabilize

### E. Pixel

- Pixelize
- Target Character Height
- Palette Limit
- Remove Single Pixel Noise

## 中央

### 大预览区

支持：

- 网格显示
- 透明棋盘格
- 黑 / 白 / 办公室背景切换
- 锚点显示
- Bounding Box
- Frame Index

## 右栏

### Animation Clips

动作列表：

- Idle
- Walk Down
- Walk Up
- Walk Left
- Typing
- Celebrate
- Tired

显示：

- 已导入
- 帧数
- QA 状态
- FPS

## 底部

### Timeline

帧缩略图 + 播放控制。

---

# 22. 普通 / 优秀员工的名字与视觉解绑

这是本次新规则，Codex 实现时需要注意。

如果当前 Staff Catalog 仍把：

```text
name + portrait + template_id
```

强绑定在同一个员工模板里，后续建议拆成：

```text
Staff Runtime
├ name
├ stats
├ career
├ rarity
└ visual_id
```

其中：

```text
普通 / 优秀：name 与 visual_id 可独立随机
精英 / 传奇：name 与 visual_id 固定绑定
```

注意：

Sprite 工厂本身只输出 `visual_id` 资产。

是否修改 Core / Content Schema 由 Codex 单独评估，不允许 Sprite 工具直接修改 Game Core。

---

# 23. 精英 / 传奇角色资产锁定

精英 / 传奇导入新动作时，工具必须加载已有角色锚点。

显示：

```text
角色一致性检查
```

检查：

- 头部比例
- 发型颜色
- 主服装色
- 身体高度
- 标志配饰
- 左右特征

第一版不要求使用复杂 CV 身份识别。

可以先做规则 / 人工确认：

```text
[通过]
[需要调整]
```

但 Prompt Anchor 必须随角色项目保存。

---

# 24. 文件工程结构建议

若独立工具放在仓库内：

```text
tools/
  sprite-factory/
    src/
    public/
    presets/
    tests/
    README.md
```

不要塞进：

```text
packages/core
packages/db
apps/mcp
```

避免资产工具污染游戏业务代码。

如果未来工具成熟，可独立仓库。

---

# 25. 技术建议

Codex 可自行选型，但推荐：

### UI

- TypeScript
- Vite
- Canvas 2D

### 图像处理

浏览器：

- Canvas ImageData

或 Node：

- sharp

### 视频拆帧

优先：

- ffmpeg

### 导出

- PNG
- JSON
- ZIP batch export

第一版不需要 WebGL。

---

# 26. MVP 开发顺序

## P0 — 工具骨架

- Vite / TS
- 文件导入
- Canvas Preview
- 基础项目保存

## P1 — PNG 分格

- Grid 配置
- 多角色切割
- 多动作归档

## P2 — 抠图

- Pick Color
- Tolerance
- Edge Connected
- Internal Protect
- Pixel Edge

## P3 — 对齐

- Bounding Box
- Feet Anchor
- Seat Anchor
- Normalize Height
- Center X
- Stabilize

## P4 — Timeline

- 动画播放
- FPS
- Loop
- 删除 / 调序 / 镜像

## P5 — QA

- Alpha
- Scale
- Anchor
- Empty Frame
- Crop
- Outlier

## P6 — Export

- Sprite Sheet
- Metadata JSON
- Batch ZIP

## P7 — Video Import

- GIF
- WebM
- MP4
- ffmpeg split

## P8 — Pixelize / Palette

- 最近邻缩放
- 调色板限制
- 单像素噪点清理

---

# 27. MVP 验收标准

必须至少完成以下真实流程：

### Test A

导入一个角色 6 帧 Typing PNG。

结果：

- 自动抠图
- 坐姿对齐
- 动画预览稳定
- 导出 PNG + JSON

### Test B

导入 6 个角色 × 1 个动作的大图。

结果：

- 正确按角色分离
- 每个角色获得独立 clip
- 可批量导出

### Test C

同一角色导入 7 个动作。

结果：

- 不同动作比例一致
- 脚底不跳
- Typing 使用 Seat Anchor
- walk_right 可镜像

### Test D

白发 + 白衣角色在白背景。

结果：

- Edge Connected 抠图不会把人物内部白色误删

### Test E

存在异常“大头帧”。

结果：

- QA 能给出黄色 / 红色异常提示

---

# 28. 第一版明确不做

暂不做：

- AI 文生图 API
- AI 视频 API
- 自动生成角色名字
- 自动生成员工数值
- 自动写入 SQLite
- 自动改 Staff Catalog
- 复杂骨骼动画
- Live2D
- 3D
- 自动动作补帧
- AI 身份识别
- 完整角色编辑器

工具只负责：

> **把外部生成的素材稳定变成游戏可用 Sprite。**

---

# 29. 与《造游社》游戏侧的接口边界

游戏侧只应该关心：

```text
visual_id
sprite_path
metadata_path
current_animation
flip_x
world_position
```

业务逻辑例如：

```text
staff.status = WORKING
```

Renderer 决定：

```text
职业是 Programmer + assigned project
→ typing
```

例如：

```text
staff.status = TIRED
→ tired
```

```text
project event = INSPIRED
→ celebrate
```

Sprite 工厂不需要知道：

- Programming 数值
- Salary
- Project Formula
- MCP
- AI Partner

---

# 30. 最终目标

完成后，《造游社》的员工资产生产应变成：

```text
生成一批角色
↓
生成动作
↓
扔进 Sprite 工厂
↓
自动抠图
↓
自动对齐
↓
人工删两张抽风帧
↓
导出
↓
放进游戏
```

而不是每增加一个员工都需要程序员手工切图、修透明边、重新算坐标。

这个工具要解决的不是“做一张 Sprite Sheet”。

而是：

> **建立《造游社》以后可以持续扩充员工角色的标准化像素资产流水线。**

---

**文档版本：Employee Sprite Factory v1.0**
