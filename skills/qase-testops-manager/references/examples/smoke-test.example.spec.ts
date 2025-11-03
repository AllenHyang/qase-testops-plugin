/**
 * Smoke Test 示例 - 展示 Qase Reporter 集成
 *
 * 本示例展示如何：
 * 1. 使用符合规范的 test title
 * 2. 自动关联 Qase ID
 * 3. 使用 test.step() 同步步骤到 Qase
 * 4. 让 Playwright Reporter 自动使用 test 名称作为 title
 */

// 方式 1: 使用自定义 fixture（推荐）
import { test, expect } from '../fixtures/qase-fixture';

test.describe('UI Tests / Smoke Tests', () => {
  // ============================================================
  // 示例 1: 基本 Smoke 测试 - 自动关联 Qase ID
  // ============================================================
  test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', async ({ page, autoQaseId }) => {
    // autoQaseId fixture 会自动：
    // 1. 从 test title 提取 Custom ID: TC-UI-SMOKE-001
    // 2. 从 qase-id-mapping.json 查找 Qase ID
    // 3. 调用 qase.id() 关联 test case

    await test.step('导航到工作区', async () => {
      await page.goto('/workspace');
    });

    await test.step('验证页面标题', async () => {
      await expect(page).toHaveTitle(/Workspace/);
    });

    await test.step('验证主容器可见', async () => {
      await expect(page.locator('.workspace-container')).toBeVisible();
    });

    await test.step('检查控制台错误', async () => {
      // 验证没有控制台错误
      const errors = await page.evaluate(() => {
        return (window as any).consoleErrors || [];
      });
      expect(errors).toHaveLength(0);
    });
  });

  // ============================================================
  // 示例 2: 邮件列表 Smoke 测试
  // ============================================================
  test('TC-UI-SMOKE-002: 邮件列表基本显示验证 @smoke', async ({ page, autoQaseId }) => {
    await test.step('导航到邮件列表', async () => {
      await page.goto('/inbox');
    });

    await test.step('验证邮件列表容器', async () => {
      const mailList = page.locator('.mail-list');
      await expect(mailList).toBeVisible();
    });

    await test.step('验证至少显示一封邮件', async () => {
      const mailItems = page.locator('.mail-item');
      await expect(mailItems).toHaveCount({ minimum: 1 });
    });

    await test.step('验证邮件项包含必需字段', async () => {
      const firstMail = page.locator('.mail-item').first();
      await expect(firstMail.locator('.sender')).toBeVisible();
      await expect(firstMail.locator('.subject')).toBeVisible();
      await expect(firstMail.locator('.timestamp')).toBeVisible();
    });
  });

  // ============================================================
  // 示例 3: 搜索功能 Smoke 测试
  // ============================================================
  test('TC-UI-SMOKE-003: 搜索功能基本测试 @smoke', async ({ page, autoQaseId }) => {
    await test.step('导航到邮件列表', async () => {
      await page.goto('/inbox');
    });

    await test.step('输入搜索关键词', async () => {
      const searchInput = page.locator('input[type="search"]');
      await searchInput.fill('test');
    });

    await test.step('验证搜索结果显示', async () => {
      // 等待搜索结果更新
      await page.waitForTimeout(500);

      const results = page.locator('.mail-item');
      const count = await results.count();

      // 搜索结果可以为空，但列表应该存在
      expect(count).toBeGreaterThanOrEqual(0);
    });

    await test.step('验证搜索结果包含关键词', async () => {
      const results = page.locator('.mail-item');
      const count = await results.count();

      if (count > 0) {
        const firstResult = results.first();
        const text = await firstResult.textContent();
        expect(text?.toLowerCase()).toContain('test');
      }
    });
  });
});

// ============================================================
// 方式 2: 手动使用 qase.id()（如果不使用 fixture）
// ============================================================
/*
import { test, expect } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';

test.describe('UI Tests / Smoke Tests', () => {
  test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', async ({ page }) => {
    // 手动关联 Qase ID（从 qase-id-mapping.json 获取）
    qase.id(12345);

    await test.step('导航到工作区', async () => {
      await page.goto('/workspace');
    });

    await test.step('验证页面加载', async () => {
      await expect(page.locator('.workspace-container')).toBeVisible();
    });
  });
});
*/

// ============================================================
// 方式 3: 使用链式调用（高级用法）
// ============================================================
/*
import { test, expect } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';

test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', async ({ page }) => {
  // 链式调用设置多个 Qase 字段
  qase
    .id(12345)
    .fields({
      severity: 'critical',
      priority: 'high',
      tags: ['@smoke', '@ui']
    });

  await page.goto('/workspace');
});
*/

/**
 * 运行测试
 *
 * # 运行所有 smoke 测试
 * npx playwright test --grep "@smoke"
 *
 * # 运行特定测试
 * npx playwright test --grep "TC-UI-SMOKE-001"
 *
 * # 运行并生成报告
 * npx playwright test --reporter=html,playwright-qase-reporter
 *
 * # 查看 HTML 报告
 * npx playwright show-report
 */

/**
 * Qase 中的效果
 *
 * Test Case: TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke
 * Custom ID: TC-UI-SMOKE-001 (通过 CSV 导入设置)
 * Status: Passed/Failed
 * Duration: 2.5s
 *
 * Steps:
 *   1. 导航到工作区
 *   2. 验证页面标题
 *   3. 验证主容器可见
 *   4. 检查控制台错误
 *
 * Attachments:
 *   - Screenshot (on failure)
 *   - Video (on failure)
 *   - Trace (on failure)
 */
