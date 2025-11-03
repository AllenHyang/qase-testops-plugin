# Qase 工作流完整指南

## 🎯 核心理念

**Code First - test.describe() 嵌套是 Suite 层级的唯一定义来源**

代码 → CSV → Qase Repository 的单向数据流。

---

## 📖 核心原则

### 代码是唯一的真实数据源（Single Source of Truth）

所有测试用例信息都定义在测试代码中：
- Custom ID: `test('TC-E2E-XXX-001: ...')`
- Suite 路径: `test.describe()` 嵌套结构
- 测试步骤: `test.step()`
- 描述信息: JSDoc 注解
- Qase ID: `qase.id(933)` （由 Qase 分配后回写）

### CSV 的定位

CSV 文件（`e2e/qase/qase-test-cases.csv`）**不是数据源**，而是：

1. **记录/快照**：记录当前代码中测试用例的状态
2. **版本控制**：通过 Git 跟踪测试用例的变化
3. **审计工具**：在 PR 中通过 CSV diff 查看测试用例的增删改
4. **Qase 导入格式**：用于导入 Qase 的中间格式

### 数据流向图

```
┌─────────────────────────────────────────────────────────┐
│  代码（唯一真实来源）                                      │
│  - Custom ID (TC-E2E-XXX-001)                           │
│  - Suite 路径 (test.describe() 嵌套)                     │
│  - 测试步骤 (test.step())                                │
│  - JSDoc 描述                                           │
└──────────────┬──────────────────────────────────────────┘
               │ 扫描提取
               ↓
       ┌──────────────┐
       │  CSV（快照）  │ ← 用于版本控制和审计
       └──────┬───────┘
              │ 导入
              ↓
        ┌─────────┐
        │  Qase   │ ← 分配 Qase ID
        └────┬────┘
             │ 回写
             ↓
┌─────────────────────────────────────────────────────────┐
│  代码（更新后）                                            │
│  + qase.id(933) ← Qase 分配的 ID                        │
└──────────────┬──────────────────────────────────────────┘
               │ 重新生成
               ↓
       ┌──────────────┐
       │CSV（最终快照）│ ← 包含 Qase ID，用于提交
       └──────────────┘
```

---

## 📚 场景化工作流

### 场景 1: 🆕 首次设置（一次性）

**目标**: 配置环境并同步现有测试到 Qase

```bash
# Step 1: 配置 Qase
# 确保 .qase-config.json 存在且配置正确
cat .qase-config.json

# Step 2: 审核现有测试代码
node ~/.claude/skills/qase-testops-manager/scripts/review-test-standards.js
# 📊 查看报告,记录需要修复的问题

# Step 3: （可选）批量修复严重问题
# 至少修复：缺少 import { qase } 的文件

# Step 4: 运行首次同步
node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js
# ⏱️ 首次同步可能需要 20-30 秒
# ✅ 会创建所有 suite 和 test cases
# ✅ 自动添加 qase.id() 到代码

# Step 5: 清理空 suite
node ~/.claude/skills/qase-testops-manager/scripts/cleanup-empty-suites.js --yes

# Step 6: 验证结果
# 运行测试，检查 Qase Test Run 中是否正确关联测试
```

**检查清单**：
- [ ] `.qase-config.json` 配置正确
- [ ] 至少有一个测试文件通过审核（80分以上）
- [ ] CSV 文件已生成（`e2e/qase/qase-test-cases.csv`）
- [ ] Qase Repository 中能看到测试用例
- [ ] 代码中已自动添加 `qase.id()`

---

### 场景 2: ✍️ 新增测试用例

**目标**: 添加新测试并同步到 Qase

```bash
# Step 1: 编写测试代码（遵循 Code First 规范）
# 必须包含：
# - import { qase }
# - test.describe() 嵌套
# - Custom ID 格式正确
# - test.step() 定义步骤

# Step 2: 审核新测试
node ~/.claude/skills/qase-testops-manager/scripts/review-test-standards.js path/to/new-test.spec.ts
# ✅ 确保评分 >= 80 分（允许缺少 qase.id()）

# Step 3: 同步到 Qase
node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js
# ✅ 自动创建 suite 和 test case
# ✅ 自动添加 qase.id() 到代码

# Step 4: 验证代码更新
# 检查是否新增了 qase.id(xxx)

# Step 5: 清理空 suite（如果有）
node ~/.claude/skills/qase-testops-manager/scripts/cleanup-empty-suites.js --dry-run
# 如果有空 suite，执行清理
node ~/.claude/skills/qase-testops-manager/scripts/cleanup-empty-suites.js --yes
```

**关键点**：
- ✅ 先写代码，后同步（Code First）
- ✅ 必须有 `test.describe()` 嵌套
- ✅ 必须有 `import { qase }`
- ✅ `qase.id()` 会自动添加，无需手动

---

### 场景 3: 🔧 修改现有测试

**目标**: 更新测试内容或步骤

#### 3.1 修改 Test Steps

**情况**: 需要添加/修改/删除测试步骤

```typescript
// 修改前
test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', async ({ page }) => {
  qase.id(12345);

  await test.step('导航到工作区', async () => {
    await page.goto('/workspace');
  });
});

// 修改后 - 添加新步骤
test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', async ({ page }) => {
  qase.id(12345);

  await test.step('导航到工作区', async () => {
    await page.goto('/workspace');
  });

  await test.step('验证页面标题', async () => {
    await expect(page).toHaveTitle(/Workspace/);
  });

  await test.step('检查控制台错误', async () => {
    const errors = await page.evaluate(() => (window as any).consoleErrors || []);
    expect(errors).toHaveLength(0);
  });
});
```

**更新流程：**

```bash
# 1. 修改测试代码

# 2. 审核修改
node ~/.claude/skills/qase-testops-manager/scripts/review-test-standards.js path/to/test.spec.ts

# 3. 同步更新
node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js
# ✅ 会更新 Qase 中的测试用例内容
# ✅ 如果调整了 suite，会移动到新 suite

# 4. 验证更新
grep "TC-XXX-XXX-XXX" e2e/qase/qase-test-cases.csv
# ✅ 检查 suite 路径是否正确
```

#### 3.2 修改 Title

**情况**: 需要更改测试标题（但保持 Custom ID）

```typescript
// 修改前
test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', ...)

// 修改后
test('TC-UI-SMOKE-001: Workspace 页面加载完整性验证 @smoke', ...)
```

**更新流程**：

```bash
# 1. 修改代码中的 test title

# 2. 更新 CSV
node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js

# 3. 验证更新
node ~/.claude/skills/qase-testops-manager/scripts/query-cases.js | grep "TC-UI-SMOKE-001"
```

**重要提醒**：
- ⚠️ **Custom ID 必须保持不变**（`TC-UI-SMOKE-001`）
- ⚠️ 只修改冒号后面的标题部分
- ✅ 这样可以基于 Custom ID 或 Qase ID 更新，而不是创建新的 test case

#### 3.3 修改 Description

**情况**: 更新测试描述

```typescript
/**
 * Workspace 加载测试
 *
 * 验证目标：
 * - 页面能正常加载
 * - 没有控制台错误
 * - 主要元素可见
 *
 * 更新历史：
 * - 2025-11-01: 添加控制台错误检查
 */
test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', async ({ page }) => {
  // ...
})
```

**注意**：
- 描述应该放在**文件顶部的 `/** */` 注释块**中
- 每个文件的顶部注释会作为该文件所有测试的共同描述

#### 3.4 修改 Tags

**情况**: 更改测试的 tags

```typescript
// 修改前
test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', ...)

// 修改后 - 添加 @critical tag
test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke @critical', ...)
```

#### 3.5 批量更新多个 Test Cases

**情况**: 同时修改多个测试

```bash
# 1. 修改多个测试文件
vim e2e/specs/smoke-test.spec.ts
vim e2e/specs/api-test.spec.ts
vim e2e/specs/ui-test.spec.ts

# 2. 批量同步
node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js

# 输出：
# ✅ 找到 50 个测试用例
# 📦 UI Tests / Smoke Tests (3 个测试)
#    - TC-UI-SMOKE-001: Workspace 加载验证 (已更新)
#    - TC-UI-SMOKE-002: 邮件列表显示验证 (已更新)
#    - TC-UI-SMOKE-003: 搜索功能基本测试 (已更新)
```

**注意**：
- ⚠️ 不要修改 Custom ID（TC-XXX-XXX-XXX）
- ⚠️ 不要手动修改 qase.id()
- ✅ 可以自由调整 test.describe() 层级
- ✅ 清理旧 suite（如果调整了层级）

---

### 场景 4: 🧹 定期维护清理

**目标**: 清理空 suite 和无效测试

```bash
# Step 1: 检查空 suite（预览）
node ~/.claude/skills/qase-testops-manager/scripts/cleanup-empty-suites.js --dry-run
# 📊 查看会删除哪些 suite

# Step 2: 执行清理
node ~/.claude/skills/qase-testops-manager/scripts/cleanup-empty-suites.js --yes

# Step 3: 审核所有测试
node ~/.claude/skills/qase-testops-manager/scripts/review-test-standards.js
# 📊 查看整体质量

# Step 4: 重新同步（如果有代码修改）
node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js
```

**建议频率**：
- 🗓️ 每周一次：清理空 suite
- 🗓️ 每月一次：全面审核测试质量

---

### 场景 5: 🐛 问题排查

#### 问题 A: 测试结果未上报到 Qase

```bash
# Step 1: 检查配置
cat .env.local | grep QASE
# ✅ QASE_TESTOPS_API_TOKEN
# ✅ QASE_TESTOPS_PROJECT

# Step 2: 检查测试代码
node ~/.claude/skills/qase-testops-manager/scripts/review-test-standards.js path/to/test.spec.ts
# ❌ 如果缺少 qase.id()

# Step 3: 检查 CSV
grep "TC-YOUR-TEST-001" e2e/qase/qase-test-cases.csv
# ✅ 应该有 Qase ID 在第一列

# Step 4: 重新同步（如果需要）
node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js
```

#### 问题 B: Suite 层级不对

```bash
# Step 1: 检查代码中的 test.describe() 嵌套
# Step 2: 调整 test.describe()
# Step 3: 重新同步
node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js
# Step 4: 清理旧 suite
node ~/.claude/skills/qase-testops-manager/scripts/cleanup-empty-suites.js --yes
```

#### 问题 B-1: Playwright Reporter 自动创建了文件路径 Suite

**症状**: 运行测试后，Qase Repository 中出现了类似 `default > specs/xxx.spec.ts > UI Tests` 的 Suite 层级

**原因**:
- Playwright Qase Reporter 默认会根据文件路径自动创建 Suite 层级
- 配置 `createCase: false` 只能阻止创建新测试用例，但不能阻止创建 Suite
- 这些 Suite 是在上报测试结果时自动创建的

**解决方案**:

1. **在 Qase UI 中清理** (推荐):
   - 打开 Qase → Repository
   - 找到冗余的 Suite（如 `default` 或 `specs/xxx.spec.ts`）
   - 点击 Suite → 设置 → 更新
   - 取消 Suite 关联或删除空 Suite

2. **配置优化** (预防):
   ```typescript
   // playwright.config.ts
   projects: [
     {
       // 不设置 name，避免创建 'default' 前缀
       use: { ...devices['Desktop Chrome'] },
     },
   ]
   ```

3. **定期清理**:
   ```bash
   # 清理空的 Suite
   node ~/.claude/skills/qase-testops-manager/scripts/cleanup-empty-suites.js --yes
   ```

**注意**:
- 这些冗余 Suite 不会影响测试用例的正确组织
- CSV Manager 创建的测试用例仍然在正确的 Suite 下（由 test.describe() 定义）
- 只是在 Test Run 结果展示时可能会看到文件路径前缀

#### 问题 C: CSV 和代码不一致

```bash
# Step 1: 删除 CSV 和 JSON
rm e2e/qase/qase-test-cases.csv
rm e2e/qase/qase-test-cases.json

# Step 2: 从代码重新生成
node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js
```

#### 问题 D: 更新后 Qase 中没有变化

**症状**: 运行同步后，Qase 中的内容没有更新

**可能原因**:
1. CSV 中没有 `v2.id`
2. Custom ID 不匹配

**解决方案**:

```bash
# 检查 CSV 中的 v2.id
cat e2e/qase/qase-test-cases.csv | grep "TC-UI-SMOKE-001"

# 如果 v2.id 为空，重新同步
node ~/.claude/skills/qase-testops-manager/scripts/sync-from-qase.js

# 再次尝试更新
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js
```

#### 问题 E: 创建了重复的 Test Case

**症状**: 同步后 Qase 中出现重复的 test case

**可能原因**:
1. Custom ID 被修改了
2. CSV 中 `v2.id` 丢失了

**解决方案**:

```bash
# 1. 查询 Qase 中的重复项
node ~/.claude/skills/qase-testops-manager/scripts/query-cases.js | grep "Workspace 加载"

# 2. 删除重复的 test case（保留正确的那个）
node ~/.claude/skills/qase-testops-manager/scripts/delete-test-case.js <duplicate-id>

# 3. 重新同步 ID 映射
node ~/.claude/skills/qase-testops-manager/scripts/sync-from-qase.js
```

#### 问题 F: Steps 没有更新

**症状**: 修改了 `test.step()`，但 Qase 中的步骤没有变化

**检查清单**:

```bash
# 1. 确认代码中使用了 test.step()
grep -A 5 "TC-UI-SMOKE-001" e2e/specs/smoke-test.spec.ts

# 2. 确认 CSV 已更新
cat e2e/qase/qase-test-cases.csv | grep "TC-UI-SMOKE-001" | cut -d',' -f20

# 3. 重新生成 CSV
node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js

# 4. 同步到 Qase
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js
```

---

## 🔄 同步流水线内部流程

**`full-sync.js` 执行的 5 个步骤**：

```
┌─────────────────────────────────────────────────────┐
│ Step 1: extract-tests.js                            │
│ ✓ 扫描测试文件                                      │
│ ✓ 提取 test.describe() 嵌套路径                    │
│ ✓ 提取测试信息                                      │
│ ✓ 输出: qase-test-cases.json                       │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│ Step 2: generate-csv.js                             │
│ ✓ 读取 JSON                                         │
│ ✓ 合并已有 CSV（保留 Qase ID）                     │
│ ✓ 输出: qase-test-cases.csv                        │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│ Step 3: sync-to-qase.js                             │
│ ✓ 创建/更新 Suite（从路径）                        │
│ ✓ 创建/更新 Test Case                              │
│ ✓ 输出: qase-id-mapping.json                       │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│ Step 4: sync-from-qase.js                           │
│ ✓ 更新 CSV 的 v2.id 列                             │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│ Step 5: update-qase-annotations.js                  │
│ ✓ 自动添加/更新 qase.id() 到代码                   │
└─────────────────────────────────────────────────────┘
```

**耗时**: 约 20-30 秒（取决于测试数量）

---

## 📊 质量门禁建议

### 提交前检查清单

```bash
# 1. 代码规范审核
node ~/.claude/skills/qase-testops-manager/scripts/review-test-standards.js
# ✅ 平均分 >= 80

# 2. 同步验证
node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js
# ✅ 无错误

# 3. 清理检查
node ~/.claude/skills/qase-testops-manager/scripts/cleanup-empty-suites.js --dry-run
# ✅ 无空 suite 或已清理

# 4. 测试运行
# ✅ 测试通过
# ✅ Qase 中有 Test Run 记录
```

### 完整更新检查清单

#### 修改前

- [ ] 确认 CSV 中已有该 test case 的 `v2.id`（Qase ID）
- [ ] 备份当前代码（可选）
- [ ] 确认要修改的内容（title/steps/description/tags）

#### 修改中

- [ ] 修改测试代码
  - [ ] 保持 Custom ID 不变（除非有特殊原因）
  - [ ] 使用 `test.step()` 定义步骤
  - [ ] 在文件顶部添加 `/** */` 注释块作为描述

#### 修改后

```bash
# 1. 验证代码语法
npx tsc --noEmit

# 2. 本地执行测试（可选但推荐）
npx playwright test TC-UI-SMOKE-001

# 3. 同步更新
node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js

# 4. 查看 CSV 差异（推荐）
git diff e2e/qase/qase-test-cases.csv

# 5. 验证更新
node ~/.claude/skills/qase-testops-manager/scripts/query-cases.js | grep "TC-UI-SMOKE-001"

# 6. 提交代码
git add e2e/specs/smoke-test.spec.ts e2e/qase/qase-test-cases.csv
git commit -m "chore: update TC-UI-SMOKE-001 test steps"
```

#### 验证清单

- [ ] CSV 中的 title 已更新
- [ ] CSV 中的 steps_actions 已更新
- [ ] CSV 中的 `v2.id` 保持不变
- [ ] Qase 中的 test case 已更新
- [ ] Qase ID 保持不变（基于 `v2.id` 更新）
- [ ] 本地测试通过

---

## 🎓 最佳实践

### ✅ DO

1. **总是使用 test.describe() 嵌套**
2. **Custom ID 遵循格式**: `TC-{LAYER}-{MODULE}-{NUMBER}`
3. **使用 test.step() 定义步骤**
4. **提交前运行 full-sync.js**
5. **代码优先** - 所有修改都在代码中进行
6. **检查差异** - 查看 CSV 的变化
7. **小步提交** - 每次只修改少量 test cases
8. **验证更新** - 同步后立即验证

### ❌ DON'T

1. **不要手动编辑 CSV 的 v2.id 列**
2. **不要手动添加/修改 qase.id()**
3. **不要修改已有的 Custom ID**
4. **不要跳过审核直接同步**
5. **不要直接在 Qase 平台修改内容** - 会导致代码和 Qase 不同步
6. **不要修改 v2.id 列** - 这是 Qase ID，由系统管理

---

## 📁 核心文件说明

| 文件 | 类型 | 说明 | 版本控制 |
|------|------|------|----------|
| `.qase-config.json` | 配置 | Qase 项目配置 | ✅ 提交 |
| `e2e/qase/qase-test-cases.csv` | 数据 | Custom ID ↔ Qase ID 映射 | ✅ 提交 |
| `e2e/qase/qase-test-cases.json` | 临时 | 提取的原始数据 | ❌ .gitignore |
| `e2e/qase/qase-id-mapping.json` | 临时 | 同步时生成的映射 | ❌ .gitignore |

---

## 🔧 脚本说明

### generate-csv.js
- **输入**：测试代码（扫描）
- **输出**：CSV 文件
- **作用**：从代码生成 CSV 快照

### sync-to-qase.js
- **输入**：测试代码（扫描）
- **输出**：Qase Repository
- **作用**：同步测试用例到 Qase

### sync-from-qase.js
- **输入**：Qase Repository
- **输出**：更新代码（qase.id()）和 CSV
- **作用**：
  1. 从 Qase API 获取分配的 ID
  2. 回写 `qase.id()` 到代码
  3. 重新生成 CSV（基于更新后的代码）

### full-sync.js
- **作用**：完整同步流水线
- **步骤**：extract-tests → generate-csv → sync-to-qase → sync-from-qase → update-qase-annotations

---

## 📋 版本控制策略

### 应该提交到 Git 的文件：
- ✅ `e2e/specs/*.spec.ts` - 测试代码（唯一真实来源）
- ✅ `e2e/qase/qase-test-cases.csv` - CSV 快照（用于审计）

### 不应该提交的文件（已在 .gitignore）：
- ❌ `e2e/qase/qase-test-cases.json` - 临时调试文件
- ❌ `e2e/qase/qase-test-cases.csv.backup` - 备份文件

---

## 🎯 常见问题

### Q: 为什么还需要 CSV，不直接从代码生成？
A: CSV 提供了以下价值：
- Git diff 可视化：容易看到测试用例的宏观变化
- PR review：审查者可以快速了解测试变更
- 历史追踪：Git 历史记录测试用例的演变
- Qase 导入：提供标准的导入格式

### Q: CSV 和代码不一致怎么办？
A: 重新生成 CSV 即可：
```bash
node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js
```

### Q: qase-id-mapping.json 还需要吗？
A: 不需要。Qase ID 现在存储在代码中（`qase.id(933)`），是代码的一部分。

### Q: 如何从旧的架构迁移？
A: 旧架构的 `qase-id-mapping.json` 文件可以安全删除。运行一次 `full-sync.js` 会自动将 Qase ID 回写到代码中。

### Q: 为什么是这个顺序（代码 → CSV → Qase）？
A:
1. **代码是真实的实现** - 测试最终要执行的是代码
2. **CSV 自动提取** - 避免手动维护，减少不一致
3. **Qase 是存储** - 基于 CSV 数据更新云端

---

**最后更新**: 2025-11-03
**版本**: 2.0 (合并workflow + code-first-workflow + update-workflow-guide)
