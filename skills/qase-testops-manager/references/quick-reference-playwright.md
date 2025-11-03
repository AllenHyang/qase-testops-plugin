# Playwright Qase Reporter - 快速参考

## 🎯 核心要点

### ✅ Playwright Qase Reporter 的默认行为

**Playwright Qase Reporter 默认使用 test 名称作为 title！**

```typescript
// ✅ Reporter 自动使用完整的 test 名称
test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', async ({ page }) => {
  // 无需调用 qase.title()，Reporter 会自动使用 test 名称
  await page.goto('/workspace');
});
```

**Qase 中的显示：**
```
Title: TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke
```

### 🔄 与 CSV 导入的配合

```bash
# 1. CSV 导入创建 test case（包含 Custom ID）
generate-csv.js → sync-to-qase.js → sync-from-qase.js

# 2. 代码中关联 Qase ID
test('TC-UI-SMOKE-001: ...', async ({ page }) => {
  qase.id(12345); // 关联到 CSV 创建的 test case
  // ...
})

# 3. 执行测试，Reporter 自动上报结果
npx playwright test
```

## 📝 推荐用法

### 方式 1: 使用自动 Fixture（最推荐）

```typescript
// fixtures/qase-fixture.ts
import { test as base } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';
import qaseIdMapping from '../e2e/qase/qase-id-mapping.json';

export const test = base.extend({
  autoQaseId: async ({}, use, testInfo) => {
    const match = testInfo.title.match(/(TC-[A-Z]+-[A-Z]+-\d+):/);
    if (match) {
      const customId = match[1];
      const qaseId = qaseIdMapping[customId];
      if (qaseId) qase.id(qaseId);
    }
    await use();
  },
});
```

```typescript
// 测试文件
import { test, expect } from '../fixtures/qase-fixture';

// 自动关联 Qase ID，无需手动调用
test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', async ({ page, autoQaseId }) => {
  await page.goto('/workspace');
});
```

### 方式 2: 手动关联（简单直接）

```typescript
import { test, expect } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';

// @qase-id 12345
test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', async ({ page }) => {
  qase.id(12345); // 手动关联

  await page.goto('/workspace');
});
```

### 方式 3: 使用 test.step()（推荐）

```typescript
test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', async ({ page }) => {
  qase.id(12345);

  // test.step() 会自动同步到 Qase
  await test.step('导航到工作区', async () => {
    await page.goto('/workspace');
  });

  await test.step('验证页面加载', async () => {
    await expect(page.locator('.workspace-container')).toBeVisible();
  });
});
```

## ⚙️ 配置清单

### 1. 安装 Reporter

```bash
npm install -D playwright-qase-reporter
```

### 2. 配置 playwright.config.ts

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['list'],
    ['html'],
    [
      'playwright-qase-reporter',
      {
        apiToken: process.env.QASE_API_TOKEN,
        projectCode: process.env.QASE_PROJECT_CODE,
        runComplete: true,
        uploadAttachments: true,
      },
    ],
  ],
});
```

### 3. 配置环境变量

```bash
# .env
QASE_API_TOKEN=your_token_here
QASE_PROJECT_CODE=YOUR_CODE
```

### 4. 创建 Fixture（可选）

```bash
# 复制示例文件
cp ~/.claude/skills/qase-testops-manager/examples/playwright-qase-fixture.ts \
   e2e/fixtures/qase-fixture.ts
```

## 🚀 完整工作流

```bash
# 步骤 1: 编写测试代码
cat > e2e/specs/smoke.spec.ts << 'EOF'
import { test, expect } from '../fixtures/qase-fixture';

test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', async ({ page, autoQaseId }) => {
  await page.goto('/workspace');
  await expect(page.locator('.workspace-container')).toBeVisible();
});
EOF

# 步骤 2: 通过 CSV 创建 test case
node ~/.claude/skills/qase-testops-manager/scripts/generate-csv.js --update
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js
node ~/.claude/skills/qase-testops-manager/scripts/sync-from-qase.js

# 步骤 3: 执行测试
npx playwright test

# 步骤 4: 查看报告
npx playwright show-report
```

## 📊 对比表格

| 特性 | CSV 导入 | Playwright Reporter |
|------|----------|---------------------|
| 创建 Test Case | ✅ | ✅ |
| Custom ID | ✅ | ❌ |
| Title 格式 | ✅ 完全控制 | ✅ 使用 test 名称 |
| Tags | ✅ 自动 | 需手动设置 |
| Test Steps | ✅ | ✅ test.step() |
| 执行结果 | ❌ | ✅ |
| 附件（截图/视频） | ❌ | ✅ |

**推荐组合：CSV 导入 + Playwright Reporter**

## ❌ 常见误区

### 误区 1: 认为必须使用 qase.title()

```typescript
// ❌ 不需要！Reporter 会自动使用 test 名称
test('TC-UI-SMOKE-001: ...', async ({ page }) => {
  qase.title('TC-UI-SMOKE-001: ...'); // 冗余
})

// ✅ 正确做法
test('TC-UI-SMOKE-001: ...', async ({ page }) => {
  // Reporter 自动使用 test 名称作为 title
})
```

### 误区 2: 省略 test 名称中的 Custom ID

```typescript
// ❌ 不推荐
test('Workspace 加载测试', async ({ page }) => {
  qase.title('TC-UI-SMOKE-001: Workspace 加载测试');
})

// ✅ 推荐
test('TC-UI-SMOKE-001: Workspace 加载测试 @smoke', async ({ page }) => {
  // test 名称已包含完整信息
})
```

### 误区 3: 只依赖 Playwright Reporter 创建 test case

```typescript
// ❌ 问题：没有 Custom ID，无法与 CSV 导入对接
test('Workspace 加载测试', async ({ page }) => {
  // Reporter 会创建 test case，但没有 Custom ID
})

// ✅ 推荐：先通过 CSV 导入，再用 Reporter 上报结果
```

## 🎓 最佳实践总结

### ✅ 推荐

1. **Test 名称包含完整 title**
   ```typescript
   test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', ...)
   ```

2. **CSV 导入创建 test case**
   - 包含 Custom ID
   - 自动生成 tags
   - 统一管理

3. **使用 qase.id() 关联结果**
   - 通过 fixture 自动关联
   - 或手动添加

4. **使用 test.step() 同步步骤**
   ```typescript
   await test.step('步骤名称', async () => {
     // ...
   })
   ```

### ❌ 避免

1. **不要使用 qase.title() 重复设置**
2. **不要省略 test 名称中的 Custom ID**
3. **不要只依赖 Reporter 创建 test case**

## 📚 完整示例

查看完整示例：
- `~/.claude/skills/qase-testops-manager/examples/smoke-test.example.spec.ts`
- `~/.claude/skills/qase-testops-manager/examples/playwright-qase-fixture.ts`
- `~/.claude/skills/qase-testops-manager/examples/playwright.config.example.ts`

## 🔗 相关文档

- [详细说明](PLAYWRIGHT_QASE_REPORTER.md)
- [双向同步](BIDIRECTIONAL_SYNC.md)
- [Title 格式](TITLE_FORMAT_UPDATE.md)
- [快速开始](QUICK_START_BIDIRECTIONAL.md)

---

**记住：Playwright Qase Reporter 会自动使用 test 名称作为 title，无需额外配置！** 🎉
