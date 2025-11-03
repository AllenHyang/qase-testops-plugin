# Title 格式更新示例

## 更新内容

现在测试用例的 title 会自动包含 Custom ID 和相关 tags，格式如下：

```
TC-{LAYER}-{MODULE}-{NUMBER}: 标题 @tag1 @tag2
```

## 示例

### 1. Smoke 测试

**代码：**
```typescript
test('TC-UI-SMOKE-001: Workspace 加载无错误验证', async ({ page }) => {
  await test.step('导航到工作区', async () => {
    // ...
  });
});
```

**生成的 Title：**
```
TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke
```

**说明：**
- Custom ID 包含 `SMOKE` → 自动添加 `@smoke` tag
- Title 包含完整的 Custom ID

### 2. 高优先级测试

**代码：**
```typescript
test('TC-API-CONTRACT-001: 核心API契约验证', async ({ request }) => {
  await test.step('验证API响应', async () => {
    // ...
  });
});
```

**生成的 Title：**
```
TC-API-CONTRACT-001: 核心API契约验证 @critical
```

**说明：**
- 标题包含 `核心` → 识别为高优先级 → 添加 `@critical` tag

### 3. Regression 测试

**代码：**
```typescript
test('TC-E2E-REGRESSION-001: 用户流程回归测试', async ({ page }) => {
  await test.step('执行完整流程', async () => {
    // ...
  });
});
```

**生成的 Title：**
```
TC-E2E-REGRESSION-001: 用户流程回归测试 @regression
```

**说明：**
- Custom ID 包含 `REGRESSION` → 自动添加 `@regression` tag

### 4. 多个 Tags

**代码：**
```typescript
test('TC-UI-SMOKE-002: 核心功能基本验证', async ({ page }) => {
  await test.step('验证核心功能', async () => {
    // ...
  });
});
```

**生成的 Title：**
```
TC-UI-SMOKE-002: 核心功能基本验证 @smoke
```

**说明：**
- Custom ID 包含 `SMOKE` → 添加 `@smoke` tag
- 即使标题包含 `核心`，smoke 测试不会添加 `@critical` tag（避免重复）

## Tag 规则

| 条件 | Tag | 说明 |
|------|-----|------|
| Custom ID 或标题包含 `smoke`、`基本` | `@smoke` | Smoke 测试 |
| Custom ID 或标题包含 `regression`、`回归` | `@regression` | 回归测试 |
| 标题包含 `核心`、`关键` 且非 smoke 测试 | `@critical` | 高优先级测试 |

## 在 Qase 中的展示

上传到 Qase 后，测试用例会显示为：

**Title:**
```
TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke
```

**Custom ID:**
```
TC-UI-SMOKE-001
```

**Tags:**
```
@smoke
```

## 使用方式

### 1. 提取测试用例

```bash
node ~/.claude/skills/qase-testops-manager/scripts/generate-csv.js
```

输出示例：
```
📦 UI Tests / Smoke Tests (2 个测试)
   - TC-UI-SMOKE-001: Workspace 加载无错误验证
     Title: TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke
     Tags: @smoke

   - TC-UI-SMOKE-002: 核心功能基本验证
     Title: TC-UI-SMOKE-002: 核心功能基本验证 @smoke
     Tags: @smoke
```

### 2. 上传到 Qase

```bash
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js
```

### 3. 验证结果

```bash
node ~/.claude/skills/qase-testops-manager/scripts/query-cases.js
```

## 向后兼容

- ✅ 现有测试代码无需修改
- ✅ Custom ID 保持不变
- ✅ 仅 title 格式自动增强
- ✅ 原始 title 保留在 `originalTitle` 字段中

## 注意事项

1. **Title 长度限制**
   - Qase 对 title 可能有长度限制
   - 建议保持标题简洁
   - 必要时可以调整 tags

2. **Custom ID 格式**
   - 必须符合标准格式：`TC-{LAYER}-{MODULE}-{NUMBER}`
   - 使用验证工具确保格式正确：
     ```bash
     node ~/.claude/skills/qase-testops-manager/scripts/validate-test-ids.js
     ```

3. **Tag 自动识别**
   - 基于 Custom ID 和标题内容
   - 可以在代码中手动调整识别规则

## 自定义 Tag 规则

如果需要自定义 tag 规则，编辑 `extract-tests.js` 中的这部分代码：

```javascript
// 根据测试类型和优先级添加tag
const tags = [];
if (testType === 'smoke') tags.push('@smoke');
if (testType === 'regression') tags.push('@regression');
if (priority === 'high' && testType !== 'smoke') tags.push('@critical');

// 添加自定义规则
if (testId.includes('PERFORMANCE')) tags.push('@performance');
if (title.includes('安全')) tags.push('@security');
```

## 完整示例流程

```bash
# 1. 编写测试代码
cat > e2e/specs/example.spec.ts << 'EOF'
import { test } from '@playwright/test';

test('TC-UI-SMOKE-001: Workspace 加载无错误验证', async ({ page }) => {
  await test.step('导航到工作区', async () => {
    await page.goto('/workspace');
  });

  await test.step('验证页面加载', async () => {
    await page.waitForSelector('.workspace-container');
  });
});
EOF

# 2. 提取测试用例
node ~/.claude/skills/qase-testops-manager/scripts/generate-csv.js --update

# 3. 查看生成的 JSON
cat e2e/qase/qase-test-cases.json | jq '.[] | {id, title, tags}'

# 输出：
# {
#   "id": "TC-UI-SMOKE-001",
#   "title": "TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke",
#   "tags": ["@smoke"]
# }

# 4. 上传到 Qase
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js

# 5. 回写 Qase ID
node ~/.claude/skills/qase-testops-manager/scripts/sync-from-qase.js
```

## 总结

通过这次更新：

✅ **自动化**：Title 自动包含 Custom ID 和 tags
✅ **一致性**：所有测试用例遵循统一格式
✅ **可见性**：在 Qase 中一目了然
✅ **可维护性**：减少手动维护 title 的工作

现在你的测试用例在 Qase 中会显示为：

```
TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke
TC-API-CONTRACT-001: 核心API契约验证 @critical
TC-E2E-REGRESSION-001: 用户流程回归测试 @regression
```

清晰、规范、易于管理！
