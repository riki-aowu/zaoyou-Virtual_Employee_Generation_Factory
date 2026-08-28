# 给 Codex｜切片自动应用与标准化裁顶问题整合说明

## 1. 本次要处理的两个问题

### A. 切片编辑交互太繁琐
当前流程中，用户拖动或修改切片后，还需要额外点击：

```text
应用切片到当前动作
```

才会看到标准化结果。

需要改为：

> **切片一改，当前动作自动更新。**

---

### B. 标准化视图会把角色头顶裁掉
当前在：

```text
原始切片视图
```

中，切片框并没有碰到角色。

但在点击：

```text
应用切片到当前动作
```

之后的：

```text
标准化画布视图
```

里，角色头顶会被削掉。

这说明问题不在原始切片，而在：

```text
Raw Slice → Canonical Canvas
```

这一段标准化映射流程。

---

# 2. 结论

## 2.1 切片问题的结论

需要把当前：

```text
切片修改
↓
手动点击“应用切片到当前动作”
↓
刷新结果
```

改为：

```text
切片修改
↓
自动应用到当前动作
↓
自动刷新 Raw Slice / 标准化视图 / 帧预览
```

但不要在拖动过程中每 1px 都重建整条动作，避免卡顿。

---

## 2.2 裁顶问题的结论

当前“头顶被削掉”不是切片框太小导致的，而是：

> **标准化画布阶段使用了不安全的 Canonical Scale / Source Pivot / 映射结果，导致角色绘制到固定画布时发生越界裁损。**

要修的是：

- Canonical Scale 建立方式
- Canonical Canvas 安全边距
- Overflow 检查
- 建立角色基准时的 bounds 来源

---

# 3. 切片自动应用的改动要求

## 3.1 新增默认开启的自动应用开关

新增选项：

```text
☑ 自动应用切片
```

默认：

```text
开启
```

---

## 3.2 自动应用行为

### 拖动 / 缩放切片时
- 仅实时更新切片框显示
- 仅实时更新 Raw Slice 预览
- 不要在拖动过程中整条动作实时重建

### 鼠标松开（pointerup）时
自动执行：

```text
将当前切片应用到当前动作
```

并刷新：

- 当前动作当前角色的 Raw Slice
- 当前动作当前角色的标准化画布
- 当前动作当前角色的帧预览

---

### X / Y / W / H 数值修改时
在：

- `change`
- `blur`

后自动应用。

如果是连续输入，增加：

```text
debounce 约 200ms
```

避免反复重算。

---

## 3.3 局部重算原则

普通修改切片时，不要每次都重算整个动作的全部 18 个角色。

默认只重算：

```text
当前动作
+
当前 Character Slot
+
该动作的全部 Raw Frames
```

即：

> **单 Slice 修改 → 只重建当前动作下当前角色。**

只有以下情况才允许重建整个当前动作：

- 重置 6×3
- 加载切片模板
- 删除切片
- 新建切片
- 会影响整体布局的操作

---

## 3.4 保留手动按钮
现有：

```text
应用切片到当前动作
```

保留，但改名为：

```text
重新应用当前动作
```

作为手动兜底。

---

# 4. 标准化裁顶问题的改动要求

## 4.1 问题确认

当前问题表现为：

- Raw Slice 中角色完整
- 标准化画布视图中头顶被裁掉

因此：

> **问题发生在标准化映射阶段，不发生在切片阶段。**

---

## 4.2 不要只用第一帧建立 Canonical Scale

当前建立角色基准时，不应只根据某一帧的 Bounds 计算 Canonical Scale。

改为：

> **扫描当前角色所有已导入帧 / 动作，计算最大 Motion Envelope，再计算一个角色级 Canonical Scale。**

推荐最少支持：

### 方案 A（最低可行）
对当前动作的所有帧做扫描：

```text
Frame 01
Frame 02
Frame 03
...
Frame N
```

收集：

- 最高头顶位置
- 最低鞋底位置
- 最左轮廓
- 最右轮廓

形成当前动作的最大包络范围，再据此计算当前动作安全映射。

---

### 方案 B（更推荐）
对该角色所有已导入站立动作扫描：

- idle
- walk_down
- walk_up
- walk_left
- walk_right
- celebrate
- tired

形成角色级最大 Motion Envelope。

再计算：

```text
character-level canonicalScale
```

所有这些动作共享同一个 Canonical Scale。

---

## 4.3 建立角色基准时不要用 raw bounds

当前“从当前动作建立角色基准”时，Bounds 不能直接从：

```text
f.raw
```

获取。

应该改为基于：

- `f.cleaned`
- 或 cleaned 后的有效人物 bounds

总之不能让未清理背景参与 Bounding Box 计算。

---

## 4.4 增加 Canonical Canvas 安全边距

Canonical Canvas 不能让角色贴满。

必须增加安全边距，例如：

```text
Top Safe Margin    = 8 px
Bottom Safe Margin = 4 px
Left Safe Margin   = 6 px
Right Safe Margin  = 6 px
```

至少做成可配置常量。

重点保证：

- 头顶
- 手臂上抬
- 头发
- 兽耳 / 发饰
- 走路起伏

不被裁掉。

---

## 4.5 标准化绘制前必须做 Overflow 检测

在真正绘制到 Canonical Canvas 之前，先计算：

```text
destLeft
destTop
destRight
destBottom
```

如果任一越界：

```text
destTop < 0
destLeft < 0
destRight > canvasWidth
destBottom > canvasHeight
```

必须触发 QA / 警告，不允许静默裁损。

至少支持：

```text
⚠ Canonical Top Overflow
⚠ Canonical Bottom Overflow
⚠ Canonical Left Overflow
⚠ Canonical Right Overflow
```

---

## 4.6 原则：不能为了防裁损而逐帧缩放

修复裁顶问题时，仍然要保持：

> **同一角色只允许一个 Canonical Scale。**

禁止改成：

```text
这一帧快撞顶了 → 自动缩小
下一帧没撞顶 → 自动放大
```

不允许逐帧缩放。

正确机制仍然是：

```text
角色级 Canonical Scale
+
动作级 Clip Offset
+
必要时 Frame Offset
```

---

# 5. 建议补充的 QA

## 5.1 标准化溢出检测
新增：

- `Canonical Top Overflow`
- `Canonical Bottom Overflow`
- `Canonical Left Overflow`
- `Canonical Right Overflow`

---

## 5.2 原始切片接边检测
虽然这次问题不在切片阶段，但这一类 QA 仍然建议保留：

- `Slice Top Clipped`
- `Slice Bottom Clipped`
- `Slice Left Clipped`
- `Slice Right Clipped`

用于区分：

- 是源切片裁损
- 还是标准化映射裁损

---

# 6. 推荐交互流程

改造后推荐流程：

```text
选择角色
↓
拖动 / 缩放 Slice
↓
松手自动应用到当前动作
↓
自动刷新 Raw Slice
↓
自动刷新 Canonical Canvas
↓
自动刷新 Frame Review
↓
若发生 Overflow，立即显示 QA 警告
```

这样用户不需要反复：

```text
改切片
↓
点按钮
↓
看结果
↓
再改
↓
再点
```

---

# 7. 需要落地的开发项

## P0
- 新增 `自动应用切片` 开关，默认开启
- `pointerup` 自动应用当前 Slice 到当前动作
- 数值输入 `change / blur` 自动应用
- 200ms debounce

---

## P1
- 单 Slice 修改时只重算“当前动作 + 当前角色”
- 保留手动按钮，改名为 `重新应用当前动作`

---

## P2
- 建立角色基准时改为使用 cleaned bounds
- 不再仅依赖第一帧建立 Canonical Scale
- 引入 Motion Envelope 扫描

---

## P3
- 增加 Canonical Canvas Safe Margin
- 绘制前 Overflow 检测
- 在 UI 中提示 Overflow QA

---

## P4
- 保留并补充分离 QA：
  - Slice Clipped
  - Canonical Overflow

---

# 8. 最终验收标准

## 验收 A：切片自动应用
- 拖动切片并松手后，当前动作自动更新
- 不需要再点击“应用切片到当前动作”
- 数值输入修改后自动更新
- 操作不卡顿

---

## 验收 B：局部重算
- 修改 04 号角色切片时，不重算全部 18 个角色
- 只更新当前动作下 04 号角色全部帧

---

## 验收 C：裁顶修复
- Raw Slice 中头顶完整
- Canonical Canvas 中头顶也完整
- 标准化后不再削头发、削耳朵、削手部

---

## 验收 D：Overflow 报警
- 若角色在标准化画布越界，界面必须报：
  - Top / Bottom / Left / Right Overflow
- 不能默默裁掉

---

## 验收 E：统一比例原则不被破坏
- 同一角色不同动作仍共享一个 Canonical Scale
- 修复裁顶后，不出现逐帧忽大忽小

---

# 9. 一句话总结

本次需要同时修两件事：

1. **把切片编辑改成默认自动应用，减少无意义手动点击。**
2. **修复 Raw Slice → Canonical Canvas 标准化阶段的裁顶问题：用角色级 Motion Envelope + Safe Margin + Overflow QA 取代不安全的单帧建基准方式。**
