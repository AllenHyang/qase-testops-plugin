# 更新示例集合

本文档提供常见更新场景的实际代码示例。

## 📋 目录

- [示例 1: 添加测试步骤](#示例-1-添加测试步骤)
- [示例 2: 修改测试标题](#示例-2-修改测试标题)
- [示例 3: 添加描述](#示例-3-添加描述)
- [示例 4: 修改 Tags](#示例-4-修改-tags)
- [示例 5: 批量更新](#示例-5-批量更新)

---

## 示例 1: 添加测试步骤

### 场景
原测试只有基本验证，现在需要添加更详细的检查步骤。

### 修改前

```typescript
// e2e/specs/smoke-test.spec.ts
import { test, expect } from '../fixtures/qase-fixture';

test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', async ({ page, autoQaseId }) => {
  await page.goto('/workspace');
  await expect(page.locator('.workspace-container')).toBeVisible();
});
```

### 修改后

```typescript
// e2e/specs/smoke-test.spec.ts
import { test, expect } from '../fixtures/qase-fixture';

test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', async ({ page, autoQaseId }) => {
  await test.step('导航到工作区', async () => {
    await page.goto('/workspace');
  });

  await test.step('验证页面标题', async () => {
    await expect(page).toHaveTitle(/Workspace/);
  });

  await test.step('验证主容器可见', async () => {
    await expect(page.locator('.workspace-container')).toBeVisible();
  });

  await test.step('验证邮箱列表加载', async () => {
    await expect(page.locator('.account-list')).toBeVisible();
    const accounts = page.locator('.account-item');
    await expect(accounts).toHaveCount({ minimum: 1 });
  });

  await test.step('检查控制台错误', async () => {
    const errors = await page.evaluate(() => (window as any).consoleErrors || []);
    expect(errors).toHaveLength(0);
  });
});
```

### 执行更新

```bash
# 更新 CSV 并同步
node ~/.claude/skills/qase-testops-manager/scripts/generate-csv.js --update
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js

# 验证
node ~/.claude/skills/qase-testops-manager/scripts/query-cases.js | grep "TC-UI-SMOKE-001"
```

### 结果

CSV 中的 `steps_actions` 列会更新为：

```
1. 导航到工作区
2. 验证页面标题
3. 验证主容器可见
4. 验证邮箱列表加载
5. 检查控制台错误
```

---

## 示例 2: 修改测试标题

### 场景
标题描述不够准确，需要更新为更清晰的描述。

### 修改前

```typescript
test('TC-UI-SMOKE-001: Workspace 加载测试 @smoke', async ({ page, autoQaseId }) => {
  // ...
});
```

### 修改后

```typescript
test('TC-UI-SMOKE-001: Workspace 页面完整性加载验证 @smoke', async ({ page, autoQaseId }) => {
  // ...
});
```

### ⚠️ 注意事项

- ✅ **保持 Custom ID 不变**: `TC-UI-SMOKE-001` 必须保持一致
- ✅ **只修改标题部分**: 冒号后面的描述
- ✅ **保留 Tags**: `@smoke` 标签保持不变

### 执行更新

```bash
node ~/.claude/skills/qase-testops-manager/scripts/generate-csv.js --update
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js
```

### 结果

- CSV 中的 `title` 列更新为新标题
- Qase 中的 test case title 更新
- **Qase ID 保持不变**（基于 v2.id 更新，不是创建新 case）

---

## 示例 3: 添加描述

### 场景
需要为测试添加详细的描述说明。

### 修改前

```typescript
// e2e/specs/smoke-test.spec.ts
import { test, expect } from '../fixtures/qase-fixture';

test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', async ({ page, autoQaseId }) => {
  // ...
});
```

### 修改后

```typescript
// e2e/specs/smoke-test.spec.ts

/**
 * Smoke Tests - UI 层基础验证
 *
 * 测试目标：
 * - 验证 Workspace 页面的基本加载功能
 * - 确保页面无 JavaScript 错误
 * - 验证关键 UI 元素正确显示
 *
 * 前置条件：
 * - 用户已登录
 * - 至少有一个邮箱账户
 *
 * 预期行为：
 * - 页面在 3 秒内完成加载
 * - 所有主要容器可见
 * - 控制台无错误日志
 *
 * 更新历史：
 * - 2025-11-01: 添加控制台错误检查
 * - 2025-10-15: 添加邮箱列表验证
 * - 2025-10-01: 初始版本
 */

import { test, expect } from '../fixtures/qase-fixture';

test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', async ({ page, autoQaseId }) => {
  // ...
});
```

### 执行更新

```bash
node ~/.claude/skills/qase-testops-manager/scripts/generate-csv.js --update
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js
```

### 结果

CSV 和 Qase 中的 `description` 字段会更新为文件顶部的注释内容。

### 💡 提示

- 描述应放在**文件顶部**的 `/** */` 注释块中
- 该描述会应用到文件中的**所有测试**
- 使用 Markdown 格式编写描述

---

## 示例 4: 修改 Tags

### 场景 A: 添加 Tag

```typescript
// 修改前
test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', ...)

// 修改后 - 添加 @critical
test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke @critical', ...)
```

### 场景 B: 删除 Tag

```typescript
// 修改前
test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke @critical', ...)

// 修改后 - 移除 @critical
test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', ...)
```

### 场景 C: 替换 Tag

```typescript
// 修改前
test('TC-UI-SMOKE-001: Workspace 加载测试 @smoke', ...)

// 修改后 - 从 smoke 改为 regression
test('TC-UI-REGRESSION-001: Workspace 加载回归测试 @regression', ...)
```

⚠️ **注意**: 场景 C 修改了 Custom ID，会在 Qase 中创建新的 test case！

### 执行更新

```bash
node ~/.claude/skills/qase-testops-manager/scripts/generate-csv.js --update
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js
```

---

## 示例 5: 批量更新

### 场景
需要同时更新多个测试文件的步骤。

### 修改文件

```bash
# 修改多个测试文件
vim e2e/specs/smoke-test.spec.ts
vim e2e/specs/api-contract.spec.ts
vim e2e/specs/sync-basic.spec.ts
```

### 示例修改 1: smoke-test.spec.ts

```typescript
test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', async ({ page, autoQaseId }) => {
  await test.step('导航到工作区', async () => {
    await page.goto('/workspace');
  });

  // ✨ 新增
  await test.step('等待初始化完成', async () => {
    await page.waitForLoadState('networkidle');
  });

  await test.step('验证主容器可见', async () => {
    await expect(page.locator('.workspace-container')).toBeVisible();
  });
});

test('TC-UI-SMOKE-002: 邮件列表基本显示验证 @smoke', async ({ page, autoQaseId }) => {
  // ✨ 新增步骤结构
  await test.step('导航到邮件列表', async () => {
    await page.goto('/inbox');
  });

  await test.step('验证列表容器', async () => {
    await expect(page.locator('.mail-list')).toBeVisible();
  });
});
```

### 示例修改 2: api-contract.spec.ts

```typescript
test('TC-API-CONTRACT-001: 核心API契约验证 @critical', async ({ request }) => {
  // ✨ 添加详细步骤
  await test.step('获取工作区列表', async () => {
    const response = await request.get('/api/workspaces');
    expect(response.status()).toBe(200);
  });

  await test.step('验证响应结构', async () => {
    const data = await response.json();
    expect(data).toHaveProperty('workspaces');
    expect(Array.isArray(data.workspaces)).toBeTruthy();
  });
});
```

### 批量更新命令

```bash
# 一次性更新所有修改
node ~/.claude/skills/qase-testops-manager/scripts/generate-csv.js --update
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js

# 查看更新统计
# 输出示例：
# ✅ 找到 50 个测试用例
# 📦 处理 3 个文件:
#    - smoke-test.spec.ts (2 个测试已更新)
#    - api-contract.spec.ts (1 个测试已更新)
#    - sync-basic.spec.ts (0 个测试，无变化)
#
# 📊 同步完成:
#    🔄 更新: 3 个
#    ✅ 创建: 0 个
#    ❌ 失败: 0 个
```

### 验证批量更新

```bash
# 查看所有更新的测试
node ~/.claude/skills/qase-testops-manager/scripts/query-cases.js | \
  grep -E "(TC-UI-SMOKE-001|TC-UI-SMOKE-002|TC-API-CONTRACT-001)"

# 或者查看 CSV 的 git diff
git diff e2e/qase/qase-test-cases.csv
```

---

## 📋 更新检查清单

### ✅ 修改前

- [ ] 确认 CSV 中已有该 test case 的 `v2.id`
- [ ] 备份当前代码（可选）
- [ ] 明确要修改的内容

### ✅ 修改中

- [ ] 保持 Custom ID 不变（除非有特殊原因）
- [ ] 使用 `test.step()` 定义步骤
- [ ] 在文件顶部添加描述注释

### ✅ 修改后

```bash
# 1. 验证代码语法
npx tsc --noEmit

# 2. 本地执行测试（推荐）
npx playwright test TC-UI-SMOKE-001

# 3. 更新 CSV
node ~/.claude/skills/qase-testops-manager/scripts/generate-csv.js --update

# 4. 查看差异
git diff e2e/qase/qase-test-cases.csv

# 5. 同步到 Qase
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js

# 6. 验证更新
node ~/.claude/skills/qase-testops-manager/scripts/query-cases.js | grep "TC-UI-SMOKE-001"

# 7. 提交代码
git add .
git commit -m "chore: update test cases"
```

---

## 💡 最佳实践

### ✅ 推荐

1. **小步提交** - 每次只修改少量测试，便于追踪和回滚
2. **立即验证** - 同步后立即查询 Qase 确认更新成功
3. **查看差异** - 使用 `git diff` 检查 CSV 的变化
4. **本地测试** - 修改后先本地运行测试确保代码正确

### ❌ 避免

1. **不要跳过 CSV 步骤** - 必须先 `generate-csv.js` 再 `sync-to-qase.js`
2. **不要修改 Custom ID** - 除非你确实想创建新的 test case
3. **不要手动编辑 CSV** - 所有修改都应该在代码中完成
4. **不要在 Qase 平台修改** - 会导致代码和 Qase 不同步

---

## 🔗 相关文档

- [完整更新指南](../UPDATE_WORKFLOW_GUIDE.md) - 7 种场景的详细说明
- [快速开始](../QUICK_START_UPDATE.md) - 3 步更新流程
- [双向同步](../BIDIRECTIONAL_SYNC.md) - ID 同步机制
- [Skill 文档](../skill.md) - 完整功能说明

---

**记住：代码是 Single Source of Truth！** 🎯
