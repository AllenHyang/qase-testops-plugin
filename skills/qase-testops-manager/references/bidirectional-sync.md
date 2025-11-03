# Qase 双向同步详解

## 概述

本文档详细说明 Qase CSV Manager 的双向同步机制，确保 **Custom ID** 和 **Qase ID** 在代码、CSV 和 Qase 平台之间保持一致性。

## 核心概念

### 两种 ID 的作用

| ID 类型 | 格式 | 来源 | 用途 |
|---------|------|------|------|
| **Custom ID** | `TC-API-SYNC-001` | 手动定义（代码中） | 业务唯一标识，用于代码、CSV、Qase之间的映射 |
| **Qase ID** | `12345` (数字) | Qase自动生成 | Qase平台内部ID，用于更新操作和引用 |

### 数据流向

```
代码 (Custom ID)
  ↓ generate-csv.js
CSV (Custom ID)
  ↓ sync-to-qase.js
Qase (Custom ID + Qase ID)
  ↓ sync-from-qase.js
CSV (Custom ID + Qase ID)
  ↓ update-test-code.js
代码 (Custom ID + @qase-id注解)
```

## 详细工作流程

### 阶段 1: 初始上传 (首次同步)

**目标**: 将本地测试用例首次上传到 Qase

```bash
# 1. 从代码提取测试用例
node ~/.claude/skills/qase-testops-manager/scripts/generate-csv.js

# 2. 上传到 Qase
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js
```

**发生了什么**:
1. `generate-csv.js` 扫描测试文件，提取 Custom ID、标题、步骤等
2. 生成 `qase-test-cases.csv`（此时 `v2.id` 列为空）
3. `sync-to-qase.js` 调用 Qase API 创建测试用例
4. Qase 返回新创建的 Qase ID
5. 生成 `qase-id-mapping.json`，记录 `custom_id → qase_id` 映射

**生成的文件**:
- `e2e/qase/qase-test-cases.csv` - CSV文件（`v2.id` 列仍为空）
- `e2e/qase/qase-id-mapping.json` - ID映射文件

### 阶段 2: 回写 Qase ID 到 CSV

**目标**: 将 Qase 生成的 ID 更新到本地 CSV

```bash
node ~/.claude/skills/qase-testops-manager/scripts/sync-from-qase.js
```

**发生了什么**:
1. 调用 Qase API 获取所有测试用例
2. 提取每个测试用例的 `custom_id` 和 `qase_id`
3. 匹配 CSV 中的 `custom_id` 列
4. 更新 CSV 的 `v2.id` 列
5. 备份原 CSV 为 `.backup` 文件

**CSV 变化**:
```csv
# 之前
v2.id,custom_id,title,...
,TC-API-SYNC-001,Workspace API Contract,...

# 之后
v2.id,custom_id,title,...
12345,TC-API-SYNC-001,Workspace API Contract,...
```

### 阶段 3: 可选 - 回写到测试代码

**目标**: 在测试代码中添加 Qase ID 引用

```bash
node ~/.claude/skills/qase-testops-manager/scripts/update-test-code.js
```

**发生了什么**:
1. 从 `qase-id-mapping.json` 加载 ID 映射
2. 扫描所有测试文件，查找 Custom ID
3. 在测试函数前添加 `@qase-id` 注解
4. 备份原文件为 `.backup` 文件

**代码变化**:
```typescript
// 之前
test('TC-API-SYNC-001: Workspace API Contract', async ({ request }) => {
  // ...
})

// 之后
// @qase-id 12345
test('TC-API-SYNC-001: Workspace API Contract', async ({ request }) => {
  // ...
})
```

**优势**:
- 在代码中直接看到 Qase ID，方便查询
- 可用于 Playwright Reporter 集成
- 可选步骤，不影响核心功能

## 后续更新流程

### 场景 1: 修改现有测试用例

```bash
# 1. 修改测试代码
# 2. 更新 CSV
node ~/.claude/skills/qase-testops-manager/scripts/generate-csv.js --update

# 3. 同步到 Qase（基于 v2.id 更新）
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js
```

**关键点**:
- CSV 已有 `v2.id`，`sync-to-qase.js` 会执行**更新**而非创建
- 无需再次运行 `sync-from-qase.js`（ID 不变）

### 场景 2: 添加新测试用例

```bash
# 1. 编写新测试代码（带 Custom ID）
# 2. 更新 CSV
node ~/.claude/skills/qase-testops-manager/scripts/generate-csv.js --update

# 3. 同步到 Qase
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js

# 4. 回写新的 Qase ID
node ~/.claude/skills/qase-testops-manager/scripts/sync-from-qase.js

# 5. (可选) 更新代码注解
node ~/.claude/skills/qase-testops-manager/scripts/update-test-code.js
```

### 场景 3: 在 Qase 中手动修改

```bash
# 1. 在 Qase 平台修改测试用例
# 2. 拉取最新数据到 CSV
node ~/.claude/skills/qase-testops-manager/scripts/sync-from-qase.js

# 3. (可选) 如果要将 Qase 的修改反映到代码，需要手动更新
```

**注意**:
- 当前不支持从 Qase → CSV → 代码的完全自动同步
- Qase 中的修改需要手动反映到代码中
- 建议以代码为主要修改源

## 文件说明

### qase-test-cases.csv
**用途**: 单一数据源（Single Source of Truth）

**关键列**:
- `v2.id`: Qase ID（Qase 平台的内部 ID）
- `custom_id`: Custom ID（业务定义的唯一标识）
- `title`, `description`, `steps_actions` 等: 测试用例详情

**生命周期**:
1. 首次生成：`v2.id` 为空
2. 上传后：通过 `sync-from-qase.js` 填充 `v2.id`
3. 后续更新：保持 `v2.id` 不变

### qase-id-mapping.json
**用途**: 临时 ID 映射文件

**格式**:
```json
{
  "TC-API-SYNC-001": 12345,
  "TC-API-SYNC-002": 12346,
  "TC-UI-INBOX-001": 12347
}
```

**生成时机**:
- 每次运行 `sync-to-qase.js` 时更新
- 记录本次上传/更新的所有 ID 映射

**是否需要版本控制**:
- **可选**: 可以加入 `.gitignore`
- CSV 已经包含了所有必需的 ID 信息
- 该文件主要用于 `update-test-code.js` 的便利性

## 最佳实践

### 1. 版本控制

**推荐提交**:
- ✅ `qase-test-cases.csv` - 必须提交
- ✅ 测试代码（带 `@qase-id` 注解）- 推荐提交
- ❌ `qase-id-mapping.json` - 可选，建议忽略
- ❌ `*.backup` 文件 - 不提交

### 2. 团队协作

**情况 1: 团队成员 A 添加新测试**
```bash
# A 的操作
1. 写代码 → generate-csv.js --update → sync-to-qase.js → sync-from-qase.js
2. 提交 CSV（包含新的 Qase ID）

# 团队成员 B 拉取后
1. git pull
2. 本地 CSV 自动包含新的 Qase ID
3. 无需额外操作
```

**情况 2: 冲突处理**
- CSV 冲突：以最新的 `v2.id` 为准
- Custom ID 冲突：需要协调，重新分配 Custom ID

### 3. CI/CD 集成

**推荐流程**:
```yaml
test:
  steps:
    - name: Generate CSV
      run: node ~/.claude/skills/qase-testops-manager/scripts/generate-csv.js

    - name: Sync to Qase
      run: node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js

    - name: Sync from Qase
      run: node ~/.claude/skills/qase-testops-manager/scripts/sync-from-qase.js

    - name: Commit updated CSV
      run: |
        git add e2e/qase/qase-test-cases.csv
        git commit -m "chore: update Qase IDs"
        git push
```

## 故障排查

### 问题 1: CSV 中没有 Qase ID

**症状**: 运行 `sync-from-qase.js` 后，`v2.id` 列仍为空

**原因**:
1. Qase 中没有对应的测试用例
2. Custom ID 不匹配

**解决**:
```bash
# 检查 Qase 中是否有数据
node ~/.claude/skills/qase-testops-manager/scripts/query-cases.js

# 如果没有，先上传
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js

# 再次同步
node ~/.claude/skills/qase-testops-manager/scripts/sync-from-qase.js
```

### 问题 2: update-test-code.js 找不到 ID 映射

**症状**: `❌ 错误: 找不到 ID 映射文件`

**原因**: `qase-id-mapping.json` 不存在

**解决**:
```bash
# 重新生成映射文件
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js
```

### 问题 3: Custom ID 重复

**症状**: Qase 拒绝创建，提示 Custom ID 已存在

**原因**: Custom ID 重复

**解决**:
1. 检查代码中的 Custom ID 是否唯一
2. 运行验证脚本：
```bash
node ~/.claude/skills/qase-testops-manager/scripts/validate-test-ids.js
```

## 总结

双向同步的核心是：

1. **Custom ID** 是永久的业务标识
2. **Qase ID** 是 Qase 平台的技术标识
3. **CSV** 是单一数据源，同时维护两种 ID
4. **代码注解** 是可选的便利功能

通过这套机制，可以确保：
- ✅ 代码、CSV、Qase 三者的数据一致性
- ✅ 支持增量更新，不会重复创建
- ✅ 团队协作时避免 ID 冲突
- ✅ 可追溯每个测试用例的完整历史
