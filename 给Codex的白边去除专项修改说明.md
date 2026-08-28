# 给 Codex 的白边去除专项修改说明

## 1. 目标

针对 `zaoyou-Virtual_Employee_Generation_Factory` 当前角色抠图后的白边、灰边、半透明脏边问题，专项优化背景去除与边缘清理流程。

本次只处理：

- 白边
- 灰边
- 半透明脏边
- 背景色污染
- 像素角色边缘发虚
- 角色浅色区域误删

不改：

- 角色切片
- Pivot
- Canonical Canvas
- Clip Offset
- Frame Offset
- 动作整理逻辑
- Sprite Sheet 打包结构

---

# 2. 默认处理顺序

统一调整为：

```text
背景色采样
↓
边缘连通区域删除
↓
内部区域保护
↓
边缘色污染去除
↓
弱透明像素删除
↓
可选 1px 边缘收缩
↓
Pixel Edge 二值化
↓
QA 检查
```

禁止把“羽化”放进像素角色默认流程。

---

# 3. 像素角色默认预设

新增预设：

```text
Pixel Sprite / 像素角色
```

默认参数：

```text
启用抠像：开

背景色：
自动四角采样

颜色容差：
10

羽化半径：
0

边缘平滑：
关

保护角色内部：
开

边缘连通删除：
开

溢色移除：
开

彻底去白边：
开

边缘收缩：
1 px

弱透明删除：
28

封闭区域扣除阈值：
200

Pixel Edge：
开
```

允许用户手动调整。

---

# 4. 背景色采样

支持：

- 四角自动取样
- 点击取色
- 设为白色
- 设为黑色
- 自定义 HEX / RGB

四角自动取样：

```text
top-left
top-right
bottom-left
bottom-right
```

使用四角中最接近的一组颜色计算背景代表色。

若四角差异过大：

```text
⚠ Background Sample Inconsistent
```

提示用户手动取色。

---

# 5. 边缘连通区域删除

默认启用：

```text
Edge Connected Only
```

实现要求：

- 从图像四周边界开始 flood fill
- 只删除与边缘连通、且颜色差在 tolerance 内的像素
- 不对全图直接执行“接近白色即删除”

必须保护：

- 白头发
- 白衣服
- 眼白
- 浅色皮肤
- 浅色配饰
- 高光
- 角色内部封闭白色区域

---

# 6. 颜色距离

背景删除不要只用：

```text
abs(R-bgR)
abs(G-bgG)
abs(B-bgB)
```

建议统一封装：

```ts
colorDistance(pixel, background)
```

MVP 可使用 RGB Euclidean Distance：

```text
sqrt(
  (R-bgR)^2 +
  (G-bgG)^2 +
  (B-bgB)^2
)
```

由：

```text
colorTolerance
```

控制。

默认：

```text
10
```

---

# 7. 边缘色污染去除

保留并强化：

```text
Spill Removal / 溢色移除
```

新增内部处理阶段：

```text
Edge Decontaminate
```

处理对象：

- 已保留角色边缘
- 半透明像素
- RGB 接近背景色
- Alpha 未完全归零

---

## 7.1 去污染逻辑

对符合以下条件的像素：

```text
0 < alpha < 255
```

且：

```text
colorDistance(pixelRGB, backgroundRGB)
```

低于边缘污染阈值时：

查找附近不透明角色像素：

```text
alpha >= opaqueThreshold
```

采样范围建议：

```text
radius 1～3 px
```

使用邻近角色颜色替换 / 混合当前 RGB。

优先：

```text
最近的不透明角色像素
```

或：

```text
附近非背景角色像素平均色
```

不要简单把 RGB 拉黑。

---

# 8. Spill Strength

新增可调参数：

```text
溢色移除强度
Spill Strength
```

范围：

```text
0 ～ 100
```

默认：

```text
70
```

意义：

```text
0
= 不修改边缘 RGB

100
= 最大程度使用邻近角色颜色替换背景污染色
```

像素角色预设：

```text
70
```

---

# 9. 弱透明删除

保留：

```text
Weak Alpha Removal
```

范围：

```text
0 ～ 255
```

默认：

```text
28
```

规则：

```text
alpha < weakAlphaThreshold
→ alpha = 0
```

推荐 UI：

```text
弱透明删除
[ 28 ]
```

预设建议：

```text
轻：
18

标准：
28

强：
36
```

---

# 10. 边缘收缩

保留：

```text
Edge Erode
```

范围建议：

```text
0 ～ 3 px
```

默认：

```text
1 px
```

像素角色不允许默认超过：

```text
1 px
```

用户手动可调到：

```text
2 px
```

`3 px` 只作为极端修复。

---

# 11. 收缩算法

不要直接裁 Bounding Box。

只对 Alpha Mask 做 erosion。

流程：

```text
角色 Alpha Mask
↓
1px Erode
↓
应用回原 RGB
```

不得：

- 改变角色整体尺寸
- 改变 Pivot
- 改变 Canonical Scale
- 改变 Source Canvas
- 改变 Clip Offset

---

# 12. Pixel Edge

新增 / 强化：

```text
Pixel Edge Mode
```

开启时：

- 禁止羽化
- 禁止抗锯齿式软边
- 禁止 Gaussian Blur
- 禁止 Smooth Mask
- 禁止半透明 feather
- 允许 Alpha 二值化
- 保留硬像素边缘

---

## 12.1 Alpha 二值化

新增选项：

```text
Binary Alpha
```

默认：

```text
开
```

规则：

```text
alpha >= binaryThreshold
→ 255

alpha < binaryThreshold
→ 0
```

默认阈值：

```text
128
```

允许关闭。

---

# 13. Pixel Edge 处理顺序

如果开启：

```text
Pixel Edge
```

最终阶段执行：

```text
Weak Alpha Removal
↓
Edge Erode
↓
Binary Alpha
```

不要在 Binary Alpha 后再 Feather。

---

# 14. 羽化与边缘平滑

像素角色预设中：

```text
Feather Radius = 0
Edge Smooth = Off
```

如果用户手动开启羽化：

```text
Pixel Edge 自动关闭
```

如果用户开启 Pixel Edge：

```text
Feather Radius 自动归 0
Edge Smooth 自动关闭
```

避免互相冲突。

---

# 15. 内部区域保护

保留：

```text
Protect Internal Regions
```

默认：

```text
开
```

处理原则：

- 与画布边缘不连通的浅色区域，不因接近背景色被直接删除
- 仅在用户明确关闭保护时，允许全局颜色删除

---

# 16. 封闭区域阈值

保留：

```text
Closed Region Threshold
```

默认：

```text
200
```

范围：

```text
0 ～ 255
```

本次不增加更复杂自动逻辑。

---

# 17. 预览模式

在背景去除区域增加：

```text
Preview Mode
```

支持：

```text
Original
Mask
Transparent
Black BG
White BG
Checkerboard
```

重点加入：

```text
Black BG
```

因为白边在黑底最容易被发现。

---

# 18. 边缘检查模式

新增：

```text
Edge Inspection
```

开启后：

- 预览放大 4x / 8x
- 自动显示人物外轮廓
- 可切换黑 / 白 / 紫背景
- 不做插值缩放
- 使用 nearest-neighbor

---

# 19. 快速预设

新增三个按钮：

```text
像素角色
白底插画
黑底素材
```

其中：

## 像素角色

```text
Tolerance 10
Feather 0
Smooth Off
Protect Internal On
Spill Removal On
Spill Strength 70
Weak Alpha 28
Erode 1
Binary Alpha On
Binary Threshold 128
Pixel Edge On
```

---

# 20. 一键修复按钮

新增：

```text
[ 一键去白边 ]
```

执行：

```text
Auto Background Sample
↓
Edge Connected Removal
↓
Internal Protect
↓
Spill Removal
↓
Weak Alpha Removal
↓
1px Erode
↓
Binary Alpha
```

只使用当前 UI 参数。

不得偷偷修改：

- Slice
- Scale
- Pivot
- Frame Offset
- Clip Offset

---

# 21. 参数面板建议

建议 UI 调整为：

```text
② 抠像 / 去背景

[✓] 启用抠像

背景色
[#FFFFFF]
[四角自动取样]
[设为白色]
[设为黑色]

颜色容差
[10]

[✓] 仅删除边缘连通区域
[✓] 保护角色内部

—— 边缘清理 ——

[✓] 溢色移除
溢色强度
[70]

弱透明删除
[28]

边缘收缩
[1]

[✓] Pixel Edge
[✓] Binary Alpha
二值阈值
[128]

羽化半径
[0]

[ ] 边缘平滑

封闭区域扣除阈值
[200]

[一键去白边]
```

---

# 22. 处理函数拆分

不要继续把所有逻辑堆进一个函数。

建议拆为：

```ts
sampleBackgroundColor()

buildConnectedBackgroundMask()

protectInternalRegions()

removeBackground()

decontaminateEdgeColors()

removeWeakAlpha()

erodeAlphaMask()

applyBinaryAlpha()

runWhiteFringeQA()
```

---

# 23. 白边 QA

新增：

```text
White Fringe QA
```

检测对象：

- 已透明化角色外轮廓附近 1～2 px
- 半透明像素
- 与背景色高度接近的 RGB

如果发现：

```text
edge pixel alpha > 0
AND
colorDistance(edgeRGB, bgRGB) < threshold
```

标记：

```text
⚠ White Fringe
```

---

# 24. QA 显示

每个 Frame 支持：

```text
✓ Clean Edge
⚠ White Fringe
⚠ Weak Alpha Halo
⚠ Over-Eroded
```

---

# 25. Over-Eroded 检测

如果 Erode 后：

```text
角色 Alpha 面积减少比例
```

超过阈值：

```text
> 8%
```

标记：

```text
⚠ Over-Eroded
```

默认只提示，不自动回滚。

---

# 26. Batch 应用

当前动作调好白边参数后支持：

```text
[应用到当前动作所有角色]
```

以及：

```text
[应用到整个 Batch]
```

但：

```text
Background Color
```

如果不同动作视频背景不同，不强制共用。

可以选择：

```text
只复制算法参数
不复制背景色
```

---

# 27. 每动作独立参数

允许：

```text
Idle
Typing
Celebrate
Walk Up
...
```

分别保存：

```text
backgroundKeySettings
```

防止不同 AI 视频颜色轻微变化。

---

# 28. 推荐数据结构

```json
{
  "backgroundRemoval": {
    "enabled": true,

    "backgroundColor": "#ffffff",

    "autoCornerSample": true,

    "colorTolerance": 10,

    "edgeConnectedOnly": true,

    "protectInternalRegions": true,

    "spillRemoval": true,

    "spillStrength": 70,

    "weakAlphaThreshold": 28,

    "edgeErodePx": 1,

    "pixelEdge": true,

    "binaryAlpha": true,

    "binaryAlphaThreshold": 128,

    "featherRadius": 0,

    "edgeSmooth": false,

    "closedRegionThreshold": 200
  }
}
```

---

# 29. Debug 导出

支持：

```text
Export Debug Mask
```

每帧可额外导出：

```text
frame_001_original.png
frame_001_mask.png
frame_001_clean.png
```

用于检查算法。

正式 Batch ZIP 默认不包含 Debug 文件。

---

# 30. 验收测试

## Test A — 白发 + 白背景

输入：

```text
白发角色
白色纯背景
```

要求：

- 背景透明
- 白发保留
- 角色内部白色不被误删
- 外轮廓无明显白边

---

## Test B — 白衬衫

要求：

- 白衬衫主体保留
- 外部白背景删除
- 衬衫内部不透明区域完整

---

## Test C — 黑底检查

处理完成后切换：

```text
Black BG Preview
```

要求：

- 无明显白色 halo
- 无大片灰边
- 无 1～2px 连续白轮廓

---

## Test D — 半透明污染

输入边缘存在：

```text
RGB 接近白色
Alpha 20～150
```

要求：

- Spill Removal 能降低白污染
- Weak Alpha 能删除极淡残影

---

## Test E — 不啃角色

默认像素预设：

```text
Erode = 1
```

要求：

- 发梢
- 手
- 鞋
- 配饰

不出现明显缺失。

---

## Test F — Pixel Edge

开启：

```text
Pixel Edge
Binary Alpha
```

要求：

- 无羽化
- 无软边
- nearest-neighbor 预览清晰
- Alpha 只包含 0 / 255

---

## Test G — 参数继承

当前动作参数可复制到：

```text
当前动作全部角色
整个 Batch
```

复制时允许：

```text
不复制 Background Color
```

---

# 31. 开发优先级

## P0

实现：

- Pixel Sprite Preset
- Feather 默认 0
- Smooth 默认 Off
- Edge Connected 默认 On
- Protect Internal 默认 On

---

## P1

实现：

```text
Edge Decontaminate
Spill Strength
```

---

## P2

实现：

```text
Weak Alpha
Erode
Binary Alpha
```

---

## P3

实现：

```text
Black BG Preview
Edge Inspection
```

---

## P4

实现：

```text
White Fringe QA
Over-Eroded QA
```

---

## P5

实现：

```text
Batch Apply
Action Settings Save
Debug Mask Export
```

---

# 32. 明确禁止

本专项禁止顺手加入：

- AI 抠图 API
- 第三方云端抠图
- SAM
- 人像识别
- 骨骼识别
- 自动角色身份判断
- 自动 Scale
- 自动 Pivot
- 动作生成
- AI 补帧

---

# 33. 最终默认效果

像素员工素材默认经过：

```text
纯色背景
↓
边缘连通删除
↓
内部白色保护
↓
边缘 RGB 去污染
↓
弱透明删除
↓
1px Erode
↓
Binary Alpha
↓
输出透明硬边 Pixel Sprite
```

---

# 34. 最终验收标准

默认“像素角色”预设处理后：

- 白底完全去除
- 黑底预览无明显白边
- 白头发 / 白衣服不被误删
- 无明显灰色半透明 halo
- 像素边缘清晰
- 不羽化
- 不模糊
- 不改变角色尺寸
- 不影响 Pivot
- 不影响 Canonical Canvas
- 不影响 Clip / Frame Offset

---

**目标版本：Employee Sprite Factory v1.2.x**

**专项：White Fringe Removal / Pixel Edge Cleanup**
