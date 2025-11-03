/**
 * Playwright Qase Fixture - 自动关联 Qase ID
 *
 * 用途：
 * - 从 test title 自动提取 Custom ID
 * - 从 qase-id-mapping.json 查找对应的 Qase ID
 * - 自动调用 qase.id() 关联 test case
 *
 * 使用方式：
 * 1. 将此文件放在 e2e/fixtures/ 目录
 * 2. 在测试文件中导入：import { test } from '../fixtures/qase-fixture'
 * 3. 使用 autoQaseId fixture：test('TC-UI-SMOKE-001: ...', async ({ page, autoQaseId }) => {})
 */

import { test as base } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';
import * as fs from 'fs';
import * as path from 'path';

// Qase ID 映射类型
type QaseIdMapping = Record<string, number>;

/**
 * 加载 Qase ID 映射文件
 */
function loadQaseIdMapping(): QaseIdMapping {
  const mappingPath = path.join(process.cwd(), 'e2e/qase/qase-id-mapping.json');

  if (!fs.existsSync(mappingPath)) {
    console.warn('⚠️  未找到 qase-id-mapping.json 文件');
    console.warn('   请先运行: node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js');
    return {};
  }

  try {
    const content = fs.readFileSync(mappingPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('❌ 读取 qase-id-mapping.json 失败:', error);
    return {};
  }
}

/**
 * 从 test title 提取 Custom ID
 */
function extractCustomId(testTitle: string): string | null {
  // 匹配格式：TC-{LAYER}-{MODULE}-{NUMBER}:
  const match = testTitle.match(/(TC-[A-Z]{2,8}-[A-Z]{2,12}-\d{3}):/);
  return match ? match[1] : null;
}

/**
 * 扩展的 test fixture，自动关联 Qase ID
 */
export const test = base.extend<{ autoQaseId: void }>({
  autoQaseId: async ({}, use, testInfo) => {
    // 从 test title 提取 Custom ID
    const customId = extractCustomId(testInfo.title);

    if (customId) {
      // 加载 ID 映射
      const mapping = loadQaseIdMapping();
      const qaseId = mapping[customId];

      if (qaseId) {
        // 自动关联 Qase ID
        qase.id(qaseId);
        console.log(`✅ 自动关联 Qase ID: ${customId} → ${qaseId}`);
      } else {
        console.warn(`⚠️  未找到 ${customId} 的 Qase ID 映射`);
        console.warn(`   提示：请先运行 sync-to-qase.js 和 sync-from-qase.js`);
      }
    } else {
      console.warn(`⚠️  Test title 格式不符合规范: ${testInfo.title}`);
      console.warn(`   期望格式: TC-{LAYER}-{MODULE}-{NUMBER}: 标题`);
    }

    // 使用 fixture
    await use();
  },
});

// 导出 expect 供使用
export { expect } from '@playwright/test';

/**
 * 使用示例：
 *
 * import { test, expect } from '../fixtures/qase-fixture';
 *
 * // 自动关联 Qase ID，无需手动调用 qase.id()
 * test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', async ({ page, autoQaseId }) => {
 *   await page.goto('/workspace');
 *   await expect(page.locator('.workspace-container')).toBeVisible();
 * });
 */
