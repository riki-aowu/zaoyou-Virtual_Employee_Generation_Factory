# 造游社｜员工 Sprite 工厂 v1.1 修改说明
## 给 Codex 的修改指令
### AI Video → Sprite Asset Processor / Anonymous Character Asset Pipeline

> 本文用于修改现有《造游社｜员工 Sprite 工厂实施规格 v1.0》。
>
> **不要另起一套工具，不要扩展业务系统。**
> 请直接在现有 `Employee Sprite Factory v1.0` 基础上修订为 v1.1。

---

# 0. 本次修改的核心结论

本次需要纠正 v1.0 中两个过度设计：

1. **Sprite 工厂不负责生成角色动画。**
2. **Sprite 工厂不负责判断员工身份、稀有度、固定角色绑定关系。**

正确边界：

```text
外部 AI 生图 / 生视频
        ↓
Sprite 工厂做资产后处理
        ↓
输出可进入游戏的 Sprite Sheet + Metadata
```

外部 AI 可以是：

- 即梦
- 豆包
- 其他 AI 生图工具
- 其他 AI 生视频工具

Sprite 工厂本身：

- 不调用文生图模型
- 不调用图生视频模型
- 不生成角色动作
- 不决定角色是谁
- 不决定角色属于普通 / 优秀 / 精英 / 传奇
- 不绑定 GG / 鱼头 / 甜心 / 其他名字
- 不写入 Staff Catalog
- 不修改 Game Core

它只负责：

> **把外部 AI 已经生成好的多人角色图 / 多人动作视频，拆成单角色资产，清理后再按角色合并。**

---

# 1. 删除「员工资产分级策略」

现有 v1.0 中：

- 普通 / 优秀员工：随机内容员工
- 精英 / 传奇员工：固定角色 + 视觉锚点
- Character Anchor
- Prompt Anchor
- 精英 / 传奇一致性检查
- `elite_gg`
- `legend_xxx`
- `random_staff_visual_id`

以上逻辑全部从 Sprite 工厂规格中删除。

原因：

> Sprite 工厂不应该知道游戏业务层的员工稀有度和身份。

未来哪些视觉资产：

- 进入普通员工随机池
- 进入优秀员工随机池
- 被设定为精英
- 被设定为传奇
- 固定绑定某个名字
- 继续保持匿名

全部由内容制作阶段人工决定。

Sprite 工厂不参与。

---

# 2. 资产层统一改为匿名角色

Sprite 工厂只管理匿名 Visual Asset。

推荐 ID：

```text
staff_visual_0001
staff_visual_0002
staff_visual_0003
...
```

批次导入时：

```text
batch_001
├ character_01
├ character_02
├ character_03
├ character_04
├ character_05
└ character_18
```

处理完成后可转换为：

```text
staff_visual_0001
staff_visual_0002
staff_visual_0003
staff_visual_0004
staff_visual_0005
staff_visual_0018
```

Sprite 工厂不保存：

```text
rarity
employee_name
career
stats
potential
salary
elite
legend
fixed_character
```

允许保留一个纯人工备注字段：

```text
asset_note
```

例如：

```text
“这个我喜欢”
“以后可能做固定角色”
“蓝头发候选”
```

`asset_note` 只用于资产管理，不参与导出业务逻辑。

---

# 3. 正确的角色生产流程

## 3.1 第一步：外部 AI 生成一批角色

角色生成不属于 Sprite 工厂。

制作人员在外部 AI 工具中一次生成：

> **18 个角色**

例如：

```text
角色 01
角色 02
角色 03
角色 04
角色 05
角色 06
```

此时角色不需要名字，也不需要稀有度。

只需要：

- 风格统一
- 人体比例统一
- 镜头统一
- 角色完整可见
- 十八个角色互不遮挡
- 十八个角色位置固定、可明确分区

Sprite 工厂只接收结果。

---

# 4. 正确的动画生产流程

## 4.1 动作由外部 AI 视频工具完成

例如：

- 即梦
- 豆包
- 其他图生视频工具

制作人员把同一批 18 个角色送入外部 AI 视频工具，分别生成：

```text
idle.mp4
walk_down.mp4
walk_up.mp4
walk_left.mp4
walk_right.mp4（可选）
typing.mp4
celebrate.mp4
tired.mp4
```

Sprite 工厂：

> **绝对不负责把静态角色“做成动画”。**

Sprite 工厂从视频已经生成完毕以后才开始工作。

---

# 5. Sprite 工厂的真正核心流程

修改 v1.0 的总流程为：

```text
外部 AI 生成 18 个角色
        ↓
外部 AI 为同一批角色生成动作视频
        ↓
导入 Sprite 工厂
        ↓
视频拆帧
        ↓
按固定角色区域切出 18 个角色
        ↓
抠图 / 去背景
        ↓
帧筛选
        ↓
统一尺度
        ↓
脚底 / 坐姿锚点对齐
        ↓
去抖动
        ↓
像素边缘清理
        ↓
按角色重新合并全部动作
        ↓
导出 Sprite Sheet + JSON Metadata
```

核心关键词：

> **拆帧、分人、清理、对齐、按人合并。**

---

# 6. 十八角色批次必须成为第一优先级

本项目的真实生产方式是：

> **一次生成 18 个角色，再为这 18 个角色生成动作。**

所以工具不能只围绕“单角色导入”设计。

MVP 必须优先支持：

```text
1 个动作视频
×
18 个角色
```

以及：

```text
多个动作视频
×
同一批 18 个角色
```

最终输出：

```text
character_01
├ idle
├ walk_down
├ walk_up
├ walk_left
├ walk_right（如有）
├ typing
├ celebrate
└ tired

character_02
├ idle
├ walk_down
├ walk_up
├ walk_left
├ walk_right（如有）
├ typing
├ celebrate
└ tired

...

character_18
```

---

# 7. 角色区域匹配方式：不要做 AI 身份识别

工具不需要“认人”。

不要加入：

- 人脸识别
- AI 角色识别
- 发型识别
- 身份比对
- 稀有度判断
- 自动判断“这是 GG”

第一版采用：

> **固定 Slot / 固定区域对应。**

例如一批 18 个角色固定为：

```text
6 列 × 3 行
```

则：

```text
第 1 行从左到右 = character_01～character_06
第 2 行从左到右 = character_07～character_12
第 3 行从左到右 = character_13～character_18
```

所有动作视频沿用同一布局。

只要 AI 视频阶段保持角色位置不变：

```text
typing.mp4 左上角色
=
celebrate.mp4 左上角色
=
walk.mp4 左上角色
=
character_01
```

然后 Sprite 工厂按 Slot 自动归档。

---

# 8. 支持手动角色区域模板

除了：

```text
6 × 3
18 × 1
3 × 6
```

还需要支持：

> **用户手动画 18 个裁切区域。**

流程：

```text
打开第一条视频 / 第一张角色图
↓
手动框选角色 01～18
↓
保存为 Batch Layout Template
↓
后续所有动作视频复用同一组区域
```

建议保存：

```json
{
  "layoutId": "batch_001",
  "slots": [
    {"id": "character_01", "x": 0, "y": 0, "w": 300, "h": 400},
    {"id": "character_02", "x": 300, "y": 0, "w": 300, "h": 400}
  ]
}
```

这样即使 AI 输出不是严格等分网格，也能使用。

---

# 9. 「动画时间轴」改名

v1.0 的：

> Animation Timeline / 动画时间轴

容易误解为动画制作工具。

统一改名为：

> **Frame Review / 拆帧检查**

它只用于检查外部 AI 视频拆出来的帧。

功能保留：

- 播放 / 暂停
- 设置有效区间
- FPS 预览
- 删除坏帧
- 拖动换序
- 去重复帧
- 单帧停留时间
- 镜像帧（人工选择）
- 查看抠图结果
- 查看锚点
- 查看 Bounding Box

不增加：

- 骨骼动画
- 自动动作生成
- 插值动画生成
- AI 补帧
- 关键帧动画制作
- 姿态编辑器

---

# 10. 帧数只作为推荐，不作为固定要求

v1.0 中：

```text
idle = 4
walk = 6
typing = 6
celebrate = 8
```

全部改为：

> **推荐最终采样范围。**

例如：

```text
AI 视频：
60 帧

用户选择有效区间：
第 8～46 帧

工具建议：
均匀采样 6 帧

用户最终：
保留 6 帧
```

工具不能假设：

> “我要生成一个 6 帧动画。”

正确逻辑是：

> “用户给了我一段视频，我帮用户选择适合进入游戏的少量关键帧。”

推荐值可以是：

| 动作 | 推荐最终帧数 |
|---|---:|
| idle | 4～6 |
| walk | 6～8 |
| typing | 6～8 |
| celebrate | 6～10 |
| tired | 4～6 |

允许人工修改。

---

# 11. Walk Right 镜像改为可选功能

v1.0 中：

```text
walk_right = walk_left + flipX
```

不要再作为默认强规则。

改为：

```text
如果存在独立 walk_right 素材
→ 使用独立素材

如果没有
→ 用户可选择：
   使用 walk_left 镜像生成 walk_right
```

原因：

部分角色可能存在左右不对称设计。

Sprite 工厂不替用户做视觉判断。

---

# 12. 保留并强化自动抠图

自动抠图仍然是核心功能。

保留：

```text
Auto Corner Sample
Pick Background Color
Color Tolerance
Edge Connected Only
Protect Internal Regions
Alpha Threshold
Pixel Edge Mode
```

特别要求继续保留：

## Edge Connected Only

只删除与画布边缘连通的背景区域。

防止误删：

- 白头发
- 白衣服
- 眼白
- 浅色饰品
- 高光

## Pixel Edge Mode

用于最终像素资产：

- 禁止羽化
- 禁止半透明脏边
- Alpha 可量化为 0 / 255
- 避免白边 / 灰边

---

# 13. 保留自动对齐和 Stabilize

外部 AI 视频常见问题：

- 人物左右漂
- 人物上下漂
- 角色忽大忽小
- 头部尺寸变化
- 脚底位置跳
- 坐姿位置变化

Sprite 工厂必须处理：

```text
Bounding Box Detection
Feet Anchor
Seat Anchor
Normalize Scale
Center Alignment
Auto Stabilize
Outlier Detection
```

注意：

> 工具负责稳定已有动作，不负责创造动作。

---

# 14. Typing 动作仍然不包含办公家具

此规则不变。

AI 生视频阶段，建议人物只表现：

- 坐姿
- 身体略前倾
- 双手向前伸
- 手部有打字动作
- 头 / 肩轻微活动

不把以下内容烘焙进人物 Sprite：

- 桌子
- 电脑
- 键盘
- 办公家具

游戏场景独立组合：

```text
Desk
Computer
Chair
Character Typing Sprite
```

Sprite 工厂只处理人物。

---

# 15. 全局角色视觉规范继续保留

虽然 Sprite 工厂不负责生人，但项目必须继续保留一份：

> **角色生成规范 / Style Guide**

原因：

不同批次外部 AI 生成角色时，必须保持同一个游戏世界里的比例。

视觉方向：

> **正交 3/4 俯视像素经营游戏角色，参考《星露谷物语》的角色可读性、紧凑比例和温暖像素感，不复制具体角色；结合《游戏发展国》式经营游戏的小人信息反馈。**

建议统一：

```text
adult pixel game character
orthographic 3/4 top-down view
compact game sprite proportions
slightly oversized head
not super-deformed chibi
consistent head-to-body ratio
consistent camera angle
consistent pixel density
consistent body scale
full body visible
feet visible
clear silhouette
```

推荐头身范围继续保留：

```text
约 1 : 3.2 ～ 1 : 3.6
```

目的：

避免不同批次出现：

- 第一批两头身
- 第二批五头身
- 有人大头
- 有人小头
- 有人腿特别长
- 有人突然接近写实人体

### 注意

这套 Style Guide：

> 供制作人员去即梦 / 豆包 / 其他 AI 使用。

不是 Sprite 工厂的 AI Prompt 功能。

工具最多把它做成：

```text
[查看角色生产规范]
```

只读说明页。

不需要 Prompt Anchor 系统。

---

# 16. 角色身高策略修改

不要再按：

```text
普通 / 优秀 ±3%
精英 / 传奇 94%～106%
```

区分。

Sprite 工厂不知道稀有度。

统一规则：

> 所有角色必须符合统一基础人体体系。

允许角色有有限自然身高差，但：

- 不改变整体画风
- 不靠乱改头身制造身高
- 不让同一批角色比例差异过大

QA 主要检查：

```text
同一角色跨动作尺度一致
```

而不是：

```text
不同角色必须完全一样高
```

---

# 17. Sprite 尺寸继续作为默认值，但必须可配置

保留推荐：

```text
工作帧：
128 × 160 px

游戏帧：
80 × 96 px
```

但改为 Preset，而不是硬锁。

工具必须允许项目级配置：

```text
frameWidth
frameHeight
anchorSafeArea
targetCharacterHeight
```

这样后续正式像素风确定后，可以整体改规格而不用重写工具。

---

# 18. 正确的导出目录

删除：

```text
random/
elite/
legend/
```

统一：

```text
/assets/staff/
  staff_visual_0001/
    sprite.png
    sprite.json

  staff_visual_0002/
    sprite.png
    sprite.json

  staff_visual_0003/
    sprite.png
    sprite.json
```

批量导出：

```text
batch_001/
├ staff_visual_0001/
├ staff_visual_0002/
├ staff_visual_0003/
├ staff_visual_0004/
├ staff_visual_0005/
├ ...
└ staff_visual_0018/
```

---

# 19. Metadata 删除业务字段

JSON 只保存表现层需要的信息。

推荐：

```json
{
  "schemaVersion": 1,
  "visualId": "staff_visual_0001",
  "frameWidth": 80,
  "frameHeight": 96,
  "defaultFps": 8,
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
      "frames": 5,
      "fps": 6,
      "loop": true
    },
    "walk_down": {
      "row": 1,
      "frames": 7,
      "fps": 8,
      "loop": true
    },
    "typing": {
      "row": 4,
      "frames": 6,
      "fps": 8,
      "loop": true,
      "anchor": "seat"
    }
  }
}
```

不要出现：

```text
rarity
name
career
potential
elite
legend
fixedCharacter
promptAnchor
```

---

# 20. UI 修改

## 左栏

### A. Batch

- 新建批次
- 打开批次
- Batch ID
- Visual ID 起始编号
- Asset Note

### B. Character Layout

- 18 × 1
- 6 × 3
- 3 × 6
- Custom Regions
- 保存 Layout Template
- 加载 Layout Template

### C. Video / Image Import

- 导入动作视频
- 导入 PNG
- 动作类型
- 有效区间
- 拆帧 FPS

### D. Background Removal

保留现有抠图参数。

### E. Alignment

保留：

- Feet Anchor
- Seat Anchor
- Center X
- Normalize Height
- Stabilize

### F. Pixel

保留像素化 / 调色板 / 噪点处理。

---

# 21. 中央区域

中央主要显示：

> **当前动作视频 + 十八角色区域。**

支持切换：

```text
Video View
Frame View
Character View
```

### Video View

显示：

- 原视频
- 十八个 Slot 框
- 当前时间
- 有效动作区间

### Frame View

显示：

- 当前拆帧
- 背景删除效果
- Bounding Box
- Anchor

### Character View

显示某个：

```text
character_01
```

已经导入的全部动作。

---

# 22. 右栏

改为：

## Character Slots

```text
01 character_01
02 character_02
03 character_03
...
17 character_17
18 character_18
```

点击某个 Slot 后显示：

```text
已导入动作：

✓ Idle
✓ Walk Down
✓ Walk Up
✓ Typing
○ Celebrate
○ Tired
```

这里不显示：

- 姓名
- 稀有度
- 职业
- 游戏属性

---

# 23. 底部区域

统一叫：

> **Frame Review**

显示：

- 原始帧
- 保留帧
- 删除帧
- 推荐采样
- FPS
- Loop Preview

它只是后处理工具。

---

# 24. QA 修改

保留：

```text
Frame Size
Scale Consistency
Anchor Consistency
Alpha Edge
Empty Frame
Cropping
Color Explosion
Duplicate Frame
Outlier Frame
```

删除：

```text
角色身份一致性
精英 / 传奇一致性
Prompt Anchor 一致性
```

工具不负责判断：

> “是不是同一个设定角色。”

它只检查：

> 同一个 Slot 的动画素材是否存在明显尺寸 / 锚点异常。

---

# 25. MVP 开发顺序调整

建议重新排列：

## P0 — Tool Skeleton

- Vite / TS
- Batch Project
- File Import
- Canvas Preview

## P1 — Six-Character Layout

第一优先级。

- 6×1
- 3×2
- 2×3
- Custom Regions
- Layout Template

## P2 — Video Import / Frame Extraction

- MP4
- WebM
- GIF
- ffmpeg
- 有效区间
- 拆帧

## P3 — Character Slot Split

- 按 Slot 切角色
- 多动作归档
- Slot 不串人

## P4 — Background Removal

- Pick Color
- Edge Connected
- Internal Protect
- Pixel Edge

## P5 — Alignment / Stabilize

- Bounding Box
- Feet Anchor
- Seat Anchor
- Normalize
- Stabilize

## P6 — Frame Review

- 删除帧
- 选帧
- 推荐采样
- FPS
- Loop Preview
- Duplicate Detection

## P7 — Character Merge

核心：

```text
多个 Action
↓
按 Character Slot 合并
```

## P8 — QA

## P9 — Export

- Sprite Sheet
- Metadata
- Batch ZIP

## P10 — Pixelize / Palette

放最后。

---

# 26. 新的核心验收测试

## Test A — 单动作十八角色

输入：

```text
typing.mp4
```

包含 18 个角色。

要求：

- 正确拆视频
- 正确切 18 个 Slot
- 每个 Slot 独立获得 typing clip
- 不串人

---

## Test B — 多动作十八角色

输入：

```text
idle.mp4
typing.mp4
celebrate.mp4
```

同一批 18 个角色。

要求最终：

```text
character_01
├ idle
├ typing
└ celebrate
```

直到：

```text
character_18
```

全部自动归档。

---

## Test C — 自定义裁切模板

第一条视频手动画 18 个区域。

第二、第三条视频：

> 自动复用 Layout Template。

---

## Test D — AI 视频漂移

某角色在视频里轻微：

- 左右移动
- 缩放
- 上下抖

要求：

- Feet Anchor 稳定
- 角色尺度波动可检测
- Stabilize 能降低非动作性抖动

---

## Test E — 白色人物 + 白背景

要求：

> Edge Connected 抠图不误删内部白色。

---

## Test F — 坏帧处理

AI 视频某一帧：

- 多手
- 变脸
- 体型突变

要求：

- QA 标记 Outlier
- 用户可以直接删除该帧
- 不影响剩余动作导出

---

## Test G — 匿名资产

从导入到导出全过程：

> 不需要输入角色姓名、稀有度、职业或身份。

最终只输出：

```text
staff_visual_xxxx
```

---

# 27. 明确禁止新增的功能

v1.1 第一版禁止增加：

- AI 文生图 API
- AI 图生视频 API
- AI 自动动作生成
- AI 补帧
- 动作姿态生成
- 骨骼动画
- Live2D
- 3D
- 自动角色命名
- 自动稀有度判断
- 自动普通 / 精英 / 传奇分类
- 人脸识别
- 角色身份识别
- Prompt Anchor 系统
- 自动绑定 Staff Catalog
- 自动写 SQLite
- 自动修改 Game Core

---

# 28. 与游戏侧的边界

Sprite 工厂只输出：

```text
visual_id
sprite_path
metadata_path
animations
anchors
```

以后游戏内容层自己决定：

```text
某个员工模板
→ 使用哪个 visual_id
```

或者：

```text
某个固定角色
→ 绑定哪个 visual_id
```

这些绑定关系不属于 Sprite 工厂。

---

# 29. v1.1 最终定义

Sprite 工厂不是：

> 角色生成器

也不是：

> AI 动画生成器

也不是：

> 员工身份编辑器

它是：

> **多人 AI 动作视频 → 单角色 Sprite 资产的批量后处理工具。**

它最重要的能力只有一句：

> **把“一批角色按动作生成”的素材，重新拆成“每个角色拥有全部动作”的游戏资产。**

---

# 30. 最终生产流水线

```text
外部 AI 一次生成 18 个角色
        ↓
外部 AI 分别生成这些角色的动作视频
        ↓
idle.mp4
walk.mp4
typing.mp4
celebrate.mp4
...
        ↓
Sprite 工厂
        ↓
视频拆帧
        ↓
按位置分成 18 个角色
        ↓
抠图
        ↓
去抖
        ↓
统一尺度
        ↓
锚点
        ↓
人工删坏帧
        ↓
按角色重新合并
        ↓
staff_visual_0001
staff_visual_0002
...
staff_visual_0018
        ↓
PNG Sprite Sheet + JSON
        ↓
以后再由内容制作阶段决定：
谁是普通、优秀、精英、传奇，
以及是否固定绑定某个角色名字。
```

---

**目标版本：Employee Sprite Factory v1.1**

**修改原则：删身份系统、删生成职责、强化十八角色视频拆分与按角色合并。**

