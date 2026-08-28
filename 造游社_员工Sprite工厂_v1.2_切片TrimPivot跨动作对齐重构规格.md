# 造游社｜员工 Sprite 工厂 v1.2
## 切片 / Trim / Pivot / 跨动作对齐重构规格

> 目标仓库：`zaoyou-Virtual_Employee_Generation_Factory`
>
> 本文用于指导 Codex 在现有员工 Sprite 工厂基础上进行 v1.2 重构。
>
> 本次重点不是重新生图，也不是替代外部 AI 视频生成，而是把现有工具升级为一套真正适合像素角色生产的资产流水线。

---

# 1. 项目目标

当前《造游社》不再走 3D / 等距 2.5D 办公室路线，改为：

- 正交 3/4 俯视像素 TileMap
- 像素角色视觉语言参考《星露谷物语》的角色可读性和温暖像素感
- 经营信息密度、员工工作反馈、办公室主舞台结构参考《游戏发展国》

员工 Sprite 工厂的职责是：

```text
外部 AI 生图 / 生视频
        ↓
Sprite 工厂
        ↓
切片
        ↓
抠图
        ↓
统一角色坐标
        ↓
动作对齐
        ↓
Trim / 打包
        ↓
Sprite Sheet + JSON
```

工具不负责：

- AI 文生图
- AI 视频生成
- 员工稀有度判断
- 员工身份绑定
- 办公室场景摆放
- 最终游戏运行逻辑

---

# 2. 当前问题

现有工具已经具备：

- 18 人批次
- 固定 Slot
- 6×3 等布局
- 视频 / PNG 导入
- 抠图
- Bounding Box
- 自动缩放
- 自动居中
- Anchor
- Sprite Sheet 导出

但目前角色动画坐标体系还不够稳。

---

## 2.1 不同动作裁框不一致

例如同一个角色：

```text
walk_down.mp4
walk_up.mp4
walk_left.mp4
typing.mp4
celebrate.mp4
```

来自不同 AI 视频。

即使都是 18 人，人物在不同视频中的：

- 位置
- 留白
- 尺寸
- 角色中心
- 动作幅度

都可能不同。

如果直接把每次切片框的左上角当成动画原点：

> 方向切换时人物会瞬移。

---

## 2.2 每帧 Bounding Box 自动缩放会导致 Scale Pumping

例如走路动画：

```text
Frame 1：腿伸直 → bbox 高 74
Frame 2：腿弯曲 → bbox 高 68
Frame 3：身体回弹 → bbox 高 72
```

如果每帧都自动缩放到同一个目标高度：

```text
78 / 74
78 / 68
78 / 72
```

本来第 2 帧只是人物屈膝，程序却会把人物放大。

结果：

- 人物忽大忽小
- 转身时体型变化
- 动画产生“呼吸缩放”感

因此：

> **禁止按每帧 Bounding Box 自动重新缩放。**

---

## 2.3 每帧自动居中会破坏自然动作

走路本来就会：

- 左右摆动
- 重心移动
- 肩膀晃动
- 手臂伸出

如果程序每帧都强行 Center X：

> 会把自然动画摆动抹掉。

因此：

> **禁止把每帧独立 Center 当成正式对齐机制。**

---

# 3. 核心设计原则

本次 v1.2 必须明确区分以下几个概念：

```text
Slice Rect
Source Canvas
Pivot
Canonical Scale
Clip Offset
Frame Offset
Trim
```

它们不能混在一起。

---

# 4. Slice Rect —— 只负责“从哪里取人”

Slice Rect 表示：

> 从 AI 视频 / 图片中的哪个区域切出这个角色。

例如：

```json
{
  "sliceRect": {
    "x": 108,
    "y": 72,
    "w": 220,
    "h": 298
  }
}
```

Slice Rect 只负责：

- 找人
- 裁素材
- 不负责游戏中的最终坐标

因此同一个角色不同动作可以拥有完全不同的 Slice：

```text
Walk Down：
x=101 y=76 w=214 h=290

Walk Up：
x=113 y=68 w=226 h=305

Walk Left：
x=95 y=81 w=205 h=287
```

这完全允许。

---

# 5. PS 式 18 人切片编辑器

现有 `Custom Regions` 需要升级为真正可编辑的 Slice Tool。

---

## 5.1 支持模式

默认预设：

- 6×3
- 9×2
- 3×6
- 18×1
- 2×9

推荐默认：

```text
6 × 3
```

---

## 5.2 每个 Slice 必须支持

- 显示 `01～18`
- 拖动位置
- 四角缩放
- 四边缩放
- 数值输入 X / Y / W / H
- 锁定
- 解锁
- 删除 / 重建
- 重置为 6×3
- 不要求铺满整个输入视频
- Slice 之间可以留空

---

## 5.3 保存模板

支持：

```text
保存为批次 Slice Template
```

例如：

```text
Batch Template
├ 01
├ 02
├ 03
...
└ 18
```

后续动作默认复用。

---

## 5.4 动作 Override

某个动作如果 AI 构图发生变化：

```text
Celebrate
→ Custom Slice Override
```

其他动作继续使用 Batch Template。

数据关系：

```text
Batch Slice Template
        ↓
默认所有动作继承
        ↓
Action Override（可选）
```

---

# 6. Source Canvas —— 固定逻辑画布

切片之后，每个角色必须重新映射到一个固定逻辑画布。

例如：

```json
{
  "sourceCanvas": {
    "w": 96,
    "h": 112
  }
}
```

同一个角色所有动作：

```text
idle
walk_down
walk_up
walk_left
walk_right
typing
celebrate
tired
```

全部使用同一个 Source Canvas。

---

## 6.1 推荐默认值

初版建议做成 Preset：

```text
96 × 112
```

以及：

```text
80 × 96
```

默认推荐：

```text
96 × 112
```

但必须可配置，不要写死。

---

# 7. Pivot —— 游戏中的真正站位原点

裁切框左上角不能作为游戏原点。

真正的角色坐标必须使用 Pivot。

站立角色默认：

```text
Bottom Center / 脚底中心
```

例如：

```json
{
  "pivotPx": {
    "x": 48,
    "y": 104
  },
  "pivotNormalized": {
    "x": 0.5,
    "y": 0.9286
  }
}
```

对应：

```text
Source Canvas：96×112
Pivot：48,104
```

示意：

```text
        96
┌─────────────────┐
│                 │
│       👤        │
│      /│\        │
│      / \        │
│       ×         │
└─────────────────┘
        112

× = Pivot
```

角色所有站立动作都对齐这个点。

---

# 8. Standing Pivot 与 Seat Pivot

建议角色至少支持两类 Anchor：

---

## 8.1 Standing Pivot

适用于：

- Idle
- Walk Down
- Walk Up
- Walk Left
- Walk Right
- Celebrate
- Tired

默认：

```text
脚底中心
```

---

## 8.2 Seat Pivot

适用于：

- Typing
- 其他坐姿工作动作

Seat Pivot 与 Standing Pivot 分离。

例如：

```json
{
  "standingPivot": {
    "x": 48,
    "y": 104
  },
  "seatPivot": {
    "x": 48,
    "y": 84
  }
}
```

Typing Sprite 不包含：

- 桌子
- 电脑
- 键盘
- 椅子

人物只做：

- 坐姿
- 身体略前倾
- 双手向前
- 模拟打字动作

家具在游戏场景中独立叠加。

---

# 9. Canonical Scale —— 一个角色只允许一个基础尺寸

每个角色保存一个：

```json
{
  "canonicalScale": 0.42
}
```

同一角色所有动作共享。

禁止：

```text
Frame 01 自动 scale
Frame 02 自动 scale
Frame 03 自动 scale
```

---

## 9.1 推荐设置流程

第一次为角色选择基准动作：

```text
Reference Action：
Idle
或 Walk Down
```

选择一帧作为 Canonical Reference。

然后确定：

- 基础角色高度
- Canonical Scale
- Standing Pivot

后续动作全部继承。

---

# 10. Clip Offset —— 跨动作整体对齐

AI 生成的不同动作可能整体偏移。

例如：

```text
Walk Down 正常
Walk Up 整体偏右 3px
```

不要逐帧修。

应该给整个动作设置：

```json
{
  "clipOffset": {
    "x": -3,
    "y": 0
  }
}
```

即：

```text
Character Canonical Transform
        ↓
Clip Offset
```

---

# 11. Frame Offset —— 只修异常帧

如果某个 AI 视频只有一帧漂了：

```text
Walk Left

Frame 01 ✓
Frame 02 ✓
Frame 03 偏右 2px
Frame 04 ✓
```

允许：

```json
{
  "frameOffset": {
    "x": -2,
    "y": 0
  }
}
```

但 Frame Offset 必须是：

> **最后手段。**

正常流程优先：

1. Character Canonical Scale
2. Pivot
3. Clip Offset
4. Frame Offset

---

# 12. Onion Skin / 跨动作叠加预览

必须新增：

```text
Cross-Action Alignment Preview
```

例如当前调整：

```text
Walk Up
```

背景半透明显示：

```text
Idle Reference
```

或：

```text
Walk Down Reference
```

前景显示当前 Walk Up。

用户可以立刻看到：

- 有没有横向漂移
- 有没有高度变化
- 有没有转身变胖 / 变瘦
- 脚底是否对齐

---

# 13. Canonical Canvas View

中间预览区增加两种查看方式：

---

## 13.1 Raw Slice View

显示：

> 从 AI 视频直接裁出来的原始区域。

用于调整 Slice。

---

## 13.2 Canonical Canvas View

显示：

> 经过抠图、Canonical Scale、Pivot、Clip Offset 后真正进入游戏的效果。

显示：

- Source Canvas 边界
- Pivot
- Standing Baseline
- Seat Pivot
- Bounding Box
- Clip Offset
- Frame Offset

---

# 14. 抠图逻辑

保留现有纯色背景去背能力。

需要继续支持：

- Pick Background Color
- Auto Corner Sample
- Tolerance
- Edge Connected Only
- Protect Internal Regions
- Alpha Threshold
- Pixel Edge

---

## 14.1 Edge Connected Only

只删除与画面边缘连通的背景区域。

避免误删：

- 白头发
- 白衣服
- 眼白
- 浅色饰品
- 高光

---

## 14.2 Pixel Edge

最终像素素材建议：

- 无羽化
- 无半透明灰边
- 可选择 Alpha 二值化
- 避免白边 / 黑边污染

---

# 15. Bounding Box 的新职责

Bounding Box 仍然保留。

但它只用于：

- 检测有效人物范围
- QA
- Trim
- 检测出框
- 辅助初次 Canonical Scale

不得再用于：

> 每帧自动决定最终缩放和站位。

---

# 16. Stabilize 的正确含义

Stabilize 不应该等于：

```text
每帧自动 Center
```

真正应该分两层：

---

## 16.1 Clip Stabilize

分析整个 Clip 的非动作性漂移。

输出：

```text
clipOffset
```

优先建议用户整段修正。

---

## 16.2 Frame Outlier

检测个别异常帧：

- 突然位移
- 人物尺度突变
- 身体出框
- 空帧
- AI 崩坏帧

标记：

```text
Outlier
```

由用户决定：

- 删除
- 微调
- 保留

---

# 17. Trim —— 可选存储优化

最终逻辑画布可能是：

```text
96 × 112
```

但人物实际只占：

```text
42 × 83
```

允许导出时 Trim。

---

## 17.1 Trim 后必须保留

```json
{
  "trimmed": true,

  "frame": {
    "x": 0,
    "y": 0,
    "w": 42,
    "h": 83
  },

  "spriteSourceSize": {
    "x": 27,
    "y": 21,
    "w": 42,
    "h": 83
  },

  "sourceSize": {
    "w": 96,
    "h": 112
  }
}
```

核心：

> PNG 可以裁小，但游戏必须知道人物原来在完整逻辑画布的哪个位置。

---

# 18. 数据模型

建议正式改为：

```text
Character
  ↓
Clip
  ↓
Frame
```

---

## 18.1 Character

```json
{
  "characterId": "staff_visual_0001",

  "sourceCanvas": {
    "w": 96,
    "h": 112
  },

  "standingPivot": {
    "x": 48,
    "y": 104
  },

  "seatPivot": {
    "x": 48,
    "y": 84
  },

  "canonicalScale": 0.42,

  "trimEnabled": true
}
```

---

## 18.2 Clip

```json
{
  "action": "walk_up",
  "frameCount": 8,
  "fps": 8,

  "clipOffset": {
    "x": -2,
    "y": 1
  },

  "sliceMode": "batch_template"
}
```

---

## 18.3 Frame

```json
{
  "index": 0,

  "sliceRect": {
    "x": 120,
    "y": 80,
    "w": 210,
    "h": 286
  },

  "alphaCropRect": {
    "x": 14,
    "y": 18,
    "w": 52,
    "h": 80
  },

  "frameOffset": {
    "x": 0,
    "y": 0
  },

  "spriteSourceSize": {
    "x": 24,
    "y": 20,
    "w": 52,
    "h": 80
  },

  "sourceSize": {
    "w": 96,
    "h": 112
  },

  "duration": 125
}
```

---

# 19. UI 调整

建议左侧结构：

```text
01 / BATCH

02 / SOURCE & SLICE

03 / BACKGROUND REMOVAL

04 / CHARACTER CANONICAL

05 / ACTION ALIGNMENT

06 / PIXEL

07 / EXPORT
```

---

# 20. Character Canonical 面板

新增：

```text
角色基准

Source Canvas
W [96]
H [112]

Reference Action
[ Idle ▼ ]

Canonical Scale
[ 0.420 ]

Standing Pivot
X [48]
Y [104]

Seat Pivot
X [48]
Y [84]

[从当前帧建立基准]
[恢复默认]
```

---

# 21. Action Alignment 面板

每个 Action：

```text
Walk Up

Clip Offset X [-2]
Clip Offset Y [ 1]

[叠加 Idle]
[叠加 Walk Down]

[应用到全部帧]
[重置当前动作]
```

---

# 22. Frame Fine Tune

Frame Review 里新增：

```text
Frame Offset

X [0]
Y [0]

[Reset]
```

只有异常帧才使用。

---

# 23. Slice 安全范围 QA

工具可检测：

```text
Slot 01
Frame 14
触碰 Slice 右边缘
```

标记：

```text
⚠ Clip Boundary
```

用户可：

- 拉宽 Slice
- 调整 Slice
- 删除坏帧

---

# 24. QA

保留并增强：

```text
Empty Frame
Duplicate Frame
Frame Size
Alpha Edge
Cropping
Color Explosion
Outlier Frame
Scale Drift
Pivot Drift
Clip Boundary
```

---

## 24.1 新增 Scale Drift

检查：

> 同一角色是否因为某个动作整体尺度异常。

但只报警，不逐帧自动缩放。

---

## 24.2 新增 Pivot Drift

检查：

> 各动作经 Canonical Transform 后脚底是否出现明显偏移。

---

# 25. 动作定义

保留：

```text
idle
walk_down
walk_up
walk_left
walk_right
typing
celebrate
tired
```

---

## 25.1 Walk Right

如果用户有独立素材：

```text
使用独立 walk_right
```

如果没有：

```text
允许人工选择：
Mirror Walk Left → Walk Right
```

不默认强制镜像。

---

# 26. Frame Review

Frame Review 负责：

- 播放
- 暂停
- FPS
- 有效区间
- 推荐采样
- 删除坏帧
- 去重复
- 调整顺序
- Frame Offset
- 查看 QA

不负责：

- AI 动画生成
- 骨骼编辑
- 插值动画
- AI 补帧

---

# 27. 推荐帧数

只是推荐，不强制：

| 动作 | 推荐最终帧数 |
|---|---:|
| Idle | 4～6 |
| Walk | 6～8 |
| Typing | 4～6 |
| Celebrate | 6～10 |
| Tired | 4～6 |

---

# 28. 角色视觉规范

Sprite 工厂本身不生人，但项目必须附带角色生产规范。

统一方向：

```text
adult pixel game character
orthographic 3/4 top-down view
warm management-game pixel art
compact proportions
consistent head-to-body ratio
consistent camera
consistent pixel density
clear silhouette
full body visible
feet visible
slightly oversized head
not super-deformed chibi
```

建议头身：

```text
约 1 : 3.2 ～ 1 : 3.6
```

目的：

避免：

- 一批两头身
- 一批五头身
- 有人大头
- 有人小头
- 有人腿特别长
- 有人突然写实

---

# 29. 匿名角色规则

Sprite 工厂不管理：

- 普通
- 优秀
- 精英
- 传奇
- 名字
- 职业
- 属性
- 固定角色绑定

资产统一：

```text
staff_visual_0001
staff_visual_0002
...
staff_visual_0018
```

以后由内容层人工决定：

> 哪个 visual_id 属于哪个员工。

---

# 30. 导出格式

至少支持：

---

## 30.1 Debug Export

每帧独立 PNG：

```text
staff_visual_0001/
├ idle/
├ walk_down/
├ walk_up/
├ walk_left/
├ walk_right/
├ typing/
├ celebrate/
└ tired/
```

附 JSON。

---

## 30.2 Game Export

输出：

```text
staff_visual_0001/
├ sprite.png
└ sprite.json
```

---

# 31. 推荐 JSON

```json
{
  "schemaVersion": 2,

  "characterId": "staff_visual_0001",

  "sourceCanvas": {
    "w": 96,
    "h": 112
  },

  "standingPivot": {
    "x": 48,
    "y": 104
  },

  "seatPivot": {
    "x": 48,
    "y": 84
  },

  "canonicalScale": 0.42,

  "animations": {
    "walk_down": {
      "fps": 8,
      "loop": true,

      "clipOffset": {
        "x": 0,
        "y": 0
      },

      "frames": [
        {
          "frame": {
            "x": 0,
            "y": 0,
            "w": 42,
            "h": 83
          },

          "trimmed": true,

          "spriteSourceSize": {
            "x": 27,
            "y": 21,
            "w": 42,
            "h": 83
          },

          "sourceSize": {
            "w": 96,
            "h": 112
          },

          "frameOffset": {
            "x": 0,
            "y": 0
          },

          "duration": 125
        }
      ]
    }
  }
}
```

---

# 32. 开发顺序

建议 Codex 按以下顺序实施。

---

## P0 — 数据结构

先加入：

```text
sourceCanvas
standingPivot
seatPivot
canonicalScale
clipOffset
frameOffset
spriteSourceSize
sourceSize
```

不要先改 UI。

---

## P1 — PS 式 Slice Tool

实现：

- 18 个可编辑 Slice
- 拖动
- 缩放
- 数值编辑
- 锁定
- Batch Template
- Action Override

---

## P2 — Canonical Canvas

实现：

- 固定逻辑画布
- Character Canonical Transform
- Standing Pivot
- Seat Pivot
- Canonical Scale

---

## P3 — Cross-Action Alignment

实现：

- Clip Offset
- Onion Skin
- Reference Action
- 跨动作叠加

---

## P4 — Frame Fine Tune

实现：

- Frame Offset
- Outlier 修正

---

## P5 — Trim Metadata

实现：

```text
spriteSourceSize
sourceSize
```

---

## P6 — QA

实现：

```text
Scale Drift
Pivot Drift
Clip Boundary
Outlier
Duplicate
Empty Frame
```

---

## P7 — Export

输出：

- Debug PNG
- Sprite Sheet
- JSON
- Batch ZIP

---

# 33. 必须删除 / 调整的旧逻辑

以下逻辑不能继续作为正式默认流程：

---

## 删除

```text
每帧 bbox → 每帧重新缩放
```

---

## 删除

```text
每帧 bbox → 每帧重新水平居中
```

---

## 改为

```text
角色一个 Canonical Scale
+
动作一个 Clip Offset
+
异常帧才使用 Frame Offset
```

---

# 34. 验收测试

---

## Test A — 不同 Slice 尺寸

同一角色：

```text
Walk Down Slice：205×290
Walk Up Slice：230×310
```

要求：

> 最终 Canonical Canvas 中方向切换不明显跳动。

---

## Test B — 走路屈膝

某帧 bbox 明显变矮。

要求：

> 人物不因为 bbox 变矮而自动放大。

---

## Test C — 左右摆动

角色自然走路身体左右摆。

要求：

> 不被每帧 Center 强行拉回中间。

---

## Test D — 不同动作整体偏移

Walk Up 比 Idle 偏右 4px。

要求：

```text
Clip Offset X = -4
```

即可整体校正。

---

## Test E — 单帧 AI 漂移

Frame 05 突然向右 3px。

要求：

- QA 标记 Outlier
- 用户可以删除
- 或设置 `Frame Offset X = -3`

---

## Test F — Trim

人物逻辑画布：

```text
96×112
```

实际像素：

```text
42×83
```

要求：

- PNG 可以只保存 42×83
- JSON 正确保留 `spriteSourceSize`
- 游戏能够恢复角色逻辑位置

---

## Test G — Typing

Typing 使用 Seat Pivot。

要求：

> 与游戏中的椅子 / 桌子组合后位置稳定。

---

# 35. 非目标

v1.2 不做：

- AI 文生图 API
- AI 视频 API
- 自动动作生成
- AI 补帧
- 骨骼动画
- 3D
- Live2D
- 自动员工命名
- 稀有度分类
- 人脸识别
- 角色身份判断
- 自动绑定 Game Core

---

# 36. 最终结构

完整流水线：

```text
AI角色母图
        ↓
外部AI动作视频
        ↓
导入18人素材
        ↓
PS式Slice
        ↓
抠图
        ↓
Character Canonical Scale
        ↓
统一Source Canvas
        ↓
Standing / Seat Pivot
        ↓
Clip Offset
        ↓
必要时Frame Offset
        ↓
Trim
        ↓
Sprite Sheet + JSON
```

---

# 37. 一句话原则

## Slice 只解决：

> **“从原素材哪里把人取出来？”**

## Canonical Canvas + Pivot 解决：

> **“这个人在游戏里到底站在哪里？”**

## Canonical Scale 解决：

> **“同一个人不同动作为什么不会忽大忽小？”**

## Clip Offset 解决：

> **“不同方向、不同动作怎么对齐？”**

## Frame Offset 解决：

> **“个别 AI 抽风帧怎么修？”**

---

# 38. 最终目标

员工 Sprite 工厂最终应成为：

> **面向 AI 批量角色视频的像素人物资产生产工具。**

不是简单切图器。

真正的验收标准是：

- 切得准
- 抠得干净
- 不同动作不跳
- 转身不变胖变瘦
- 角色脚底稳定
- 打字坐姿稳定
- Trim 后仍然能恢复正确位置
- 18 个角色可以批量导出直接进入游戏资产层

---

**目标版本：Employee Sprite Factory v1.2**

**核心关键词：**

```text
Slice
Canonical Canvas
Pivot
Canonical Scale
Clip Offset
Frame Offset
Trim Metadata
Cross-Action Alignment
```
