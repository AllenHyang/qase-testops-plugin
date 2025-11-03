/**
 * Playwright 配置示例 - 集成 Qase Reporter
 *
 * 将此配置添加到你的 playwright.config.ts 文件中
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // 测试目录
  testDir: './e2e/specs',

  // 超时配置
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },

  // 失败重试
  retries: process.env.CI ? 2 : 0,

  // 并行执行
  workers: process.env.CI ? 1 : undefined,

  // Reporter 配置
  reporter: [
    // 1. 控制台输出
    ['list'],

    // 2. HTML 报告
    ['html', { outputFolder: 'playwright-report' }],

    // 3. Qase Reporter
    [
      'playwright-qase-reporter',
      {
        // ========== 必需配置 ==========

        // Qase API Token (从环境变量读取)
        apiToken: process.env.QASE_API_TOKEN,

        // Qase 项目代码 (从环境变量读取)
        projectCode: process.env.QASE_PROJECT_CODE,

        // ========== Test Run 配置 ==========

        // Test run 标题（默认使用时间戳）
        runComplete: true, // 自动完成 test run

        // ========== 上传配置 ==========

        // 上传截图和视频
        uploadAttachments: true,

        // 日志级别
        logging: true,

        // ========== 环境配置 ==========

        // 测试环境（可选）
        environment: process.env.QASE_ENVIRONMENT || 'production',

        // ========== Suite 配置 ==========

        // 根 Suite 标题（可选）
        rootSuiteTitle: 'E2E Tests',

        // ========== 高级配置 ==========

        // 批量上传大小
        // batch: 100,

        // 自定义 test run 描述
        // runDescription: 'Automated test run from CI/CD',

        // 计划 ID (如果要关联到特定的 test plan)
        // plan: {
        //   id: 123
        // },
      },
    ],

    // 4. (可选) JUnit Reporter - 用于 CI/CD
    // ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  // 使用配置
  use: {
    // Base URL
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // 浏览器配置
    headless: true,

    // 截图配置
    screenshot: 'only-on-failure',

    // 视频配置
    video: 'retain-on-failure',

    // Trace 配置
    trace: 'retain-on-failure',

    // 超时配置
    actionTimeout: 10 * 1000,
    navigationTimeout: 30 * 1000,
  },

  // 项目配置（多浏览器）
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // 可以添加更多浏览器
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Web Server 配置（可选）
  // webServer: {
  //   command: 'npm run start',
  //   port: 3000,
  //   reuseExistingServer: !process.env.CI,
  // },
});

/**
 * 环境变量配置
 *
 * 创建 .env 文件：
 *
 * # Qase 配置
 * QASE_API_TOKEN=your_api_token_here
 * QASE_PROJECT_CODE=YOUR_PROJECT_CODE
 * QASE_ENVIRONMENT=staging
 *
 * # 应用配置
 * BASE_URL=http://localhost:3000
 *
 * # CI/CD 配置
 * CI=true
 */

/**
 * 使用方式
 *
 * # 本地执行（带 Qase Reporter）
 * npx playwright test
 *
 * # CI/CD 执行
 * CI=true npx playwright test
 *
 * # 指定环境
 * QASE_ENVIRONMENT=staging npx playwright test
 *
 * # 查看 HTML 报告
 * npx playwright show-report
 */
