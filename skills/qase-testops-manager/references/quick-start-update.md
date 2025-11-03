# 快速开始 - 更新工作流

## 🎯 最常见场景：修改测试步骤

### 3 步完成更新

```bash
# 1️⃣ 修改代码
vim e2e/specs/your-test.spec.ts

# 2️⃣ 更新 CSV 并同步
node ~/.claude/skills/qase-testops-manager/scripts/generate-csv.js --update && \
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js

# 3️⃣ 验证
node ~/.claude/skills/qase-testops-manager/scripts/query-cases.js | grep "YOUR-TEST-ID"
```

## 📝 代码修改示例

```typescript
// 添加新的测试步骤
test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', async ({ page }) => {
  qase.id(12345);

  await test.step('导航到工作区', async () => {
    await page.goto('/workspace');
  });

  // ✨ 新增步骤
  await test.step('验证页面标题', async () => {
    await expect(page).toHaveTitle(/Workspace/);
  });

  // ✨ 新增步骤
  await test.step('检查控制台错误', async () => {
    const errors = await page.evaluate(() => (window as any).consoleErrors || []);
    expect(errors).toHaveLength(0);
  });
});
```

## ⚠️ 重要提醒

### ✅ 正确做法

- **保持 Custom ID 不变** (`TC-UI-SMOKE-001`)
- **使用 test.step()** 定义所有步骤
- **代码优先** - 所有修改在代码中进行

### ❌ 避免做法

- ❌ 不要直接修改 CSV 文件
- ❌ 不要在 Qase 平台手动修改
- ❌ 不要修改 Custom ID（会创建新的 test case）

## 🔄 其他更新场景

| 场景 | 修改位置 | 注意事项 |
|------|----------|----------|
| **修改 Steps** | `test.step()` | 使用 `test.step()` 包裹每个步骤 |
| **修改 Title** | test 名称 | 保持 Custom ID 不变 |
| **修改 Description** | 文件顶部 `/** */` 注释 | 整个文件共享一个描述 |
| **修改 Tags** | test 名称末尾 | 添加/删除 `@tag` |

## 📚 完整文档

- **详细指南**: `UPDATE_WORKFLOW_GUIDE.md` - 7 种场景的详细说明
- **Skill 文档**: `skill.md` - 完整功能说明
- **双向同步**: `BIDIRECTIONAL_SYNC.md` - ID 同步机制
- **Playwright 集成**: `PLAYWRIGHT_QASE_REPORTER.md` - Reporter 配置

## 🆘 常见问题

### Q: 更新后 Qase 中没有变化？

```bash
# 检查 CSV 中是否有 v2.id (Qase ID)
cat e2e/qase/qase-test-cases.csv | grep "YOUR-TEST-ID"

# 如果 v2.id 为空，重新同步
node ~/.claude/skills/qase-testops-manager/scripts/sync-from-qase.js
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js
```

### Q: 创建了重复的 Test Case？

**原因**: Custom ID 被修改或 v2.id 丢失

**解决**:
```bash
# 删除重复项
node ~/.claude/skills/qase-testops-manager/scripts/delete-test-case.js <duplicate-id>

# 重新同步
node ~/.claude/skills/qase-testops-manager/scripts/sync-from-qase.js
```

### Q: Steps 没有更新？

**检查清单**:
```bash
# 1. 确认使用了 test.step()
grep -A 5 "YOUR-TEST-ID" e2e/specs/your-test.spec.ts

# 2. 重新生成 CSV
node ~/.claude/skills/qase-testops-manager/scripts/generate-csv.js --update

# 3. 查看 CSV 差异
git diff e2e/qase/qase-test-cases.csv

# 4. 同步到 Qase
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js
```

## 🎓 记住这个流程

```
代码修改 → generate-csv.js --update → sync-to-qase.js → 验证
```

**核心原则：代码是 Single Source of Truth** 🎯
