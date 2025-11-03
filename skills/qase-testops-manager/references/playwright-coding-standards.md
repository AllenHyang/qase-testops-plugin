# Playwright 测试编写规范

## 📋 规范总览

本文档定义了项目中 Playwright 测试的编写规范，确保测试代码的一致性、可维护性和与 Qase 的完整集成。

---

## 🔄 双流程设计原则

### 核心设计：分离创建和上报

项目采用**双流程设计**，将测试用例的创建和测试结果的上报分离：

#### 1️⃣ 创建 Test Case 流程（CSV Manager Skill）

**职责**：从 `test.describe()` 提取 Suite 层级 → 创建/更新 Qase 测试用例

```bash
# 完整流程
node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js

# 单个测试用例
node ~/.claude/skills/qase-testops-manager/scripts/sync-single-case.js TC-UI-SYNC-001
```

**工作原理**：
```
代码中的 test.describe() 嵌套
    ↓ 提取
CSV 文件（包含 Suite 路径）
    ↓ 同步
Qase Repository（创建 Suite + Test Case）
    ↓ 回写
qase.id() 注解到代码
```

**关键特性**：
- ✅ **Code First** - test.describe() 是 Suite 层级的唯一数据源
- ✅ 支持完整的测试元数据（title, steps, description, preconditions, etc.）
- ✅ 生成并维护 Custom ID（TC-{LAYER}-{MODULE}-{NUMBER}）
- ✅ 自动更新代码中的 qase.id()

#### 2️⃣ 上报测试结果流程（Playwright Reporter）

**职责**：运行测试 → 上报结果到已存在的 Qase 测试用例

```bash
# 运行测试，自动上报结果
npx playwright test
```

**配置**：
```typescript
// playwright.config.ts
{
  mode: 'testops',
  testops: {
    createCase: false,  // 🔑 关键：不创建新用例，只上报结果
    run: {
      complete: true,
      title: generateRunTitle(),
    },
  },
}
```

**工作原理**：
```
运行 Playwright 测试
    ↓ 通过 qase.id() 关联
查找已存在的 Test Case
    ↓ 上报
测试结果（passed/failed）+ 截图/视频
    ↓ 更新
Qase Test Run
```

**关键特性**：
- ✅ 只上报结果，不创建/修改测试用例
- ✅ 自动上传失败时的截图和视频
- ✅ 动态生成 Test Run 标题（时间、分支、执行者等）
- ✅ 支持环境标签（browser, environment, etc.）

### 为什么要分离？

| 方面 | CSV Manager（创建） | Playwright Reporter（上报） |
|------|-------------------|---------------------------|
| **职责** | 管理测试用例结构 | 记录测试执行结果 |
| **数据源** | test.describe() 嵌套 | qase.id() 关联 |
| **时机** | 代码变更时 | 测试运行时 |
| **创建 Case** | ✅ 是 | ❌ 否（createCase: false） |
| **Suite 管理** | ✅ 完整的层级管理 | ❌ 不管理 |
| **Custom ID** | ✅ 生成和维护 | ❌ 不涉及 |
| **测试结果** | ❌ 不涉及 | ✅ 上报结果 |
| **附件上传** | ❌ 不涉及 | ✅ 截图/视频 |

### 工作流示例

**场景 1：添加新测试**

```bash
# Step 1: 编写测试代码（包含 test.describe() 嵌套）
vim e2e/specs/new-feature.spec.ts

# Step 2: 通过 CSV Manager 创建 Test Case
node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js

# Step 3: 运行测试，Reporter 自动上报结果
npx playwright test e2e/specs/new-feature.spec.ts
```

**场景 2：修改测试标题或步骤**

```bash
# Step 1: 修改代码中的测试标题或 test.step()
vim e2e/specs/existing-test.spec.ts

# Step 2: 同步单个测试用例到 Qase（快速更新）
node ~/.claude/skills/qase-testops-manager/scripts/sync-single-case.js TC-UI-SYNC-001

# Step 3: 运行测试，验证更新
npx playwright test --grep TC-UI-SYNC-001
```

**场景 3：只运行测试（不修改用例）**

```bash
# 直接运行，Reporter 自动上报结果
npx playwright test
```

### 关键原则总结

1. ✅ **创建用例**：使用 CSV Manager Skill（从 test.describe() 提取 Suite）
2. ✅ **上报结果**：使用 Playwright Reporter（createCase: false）
3. ✅ **Code First**：test.describe() 是 Suite 层级的唯一数据源
4. ✅ **职责分离**：创建和上报分离，各司其职
5. ✅ **自动化**：qase.id() 由工具自动添加和维护

---

## 🏗️ 测试分层架构

### 层级定义

所有测试必须明确归属于以下层级之一：

| 层级 | 用途 | 测试框架 | 测试位置 |
|-----|------|---------|---------|
| **API 层** | 后端 API 接口测试 | Jest + Supertest | `backend/test/*.e2e.spec.ts` |
| **UI 层** | 前端界面交互测试 | Playwright | `e2e/specs/*.spec.ts` |
| **E2E 层** | 端到端业务流程测试 | Playwright | `e2e/specs/*.spec.ts` |
| **INT 层** | 集成测试 | Playwright / Jest | 根据需要 |

### 分层原则

**✅ 推荐做法**

```typescript
// API 层测试 - 使用 Jest + Supertest
// 文件: backend/test/mail-sync-api.e2e.spec.ts
describe('TC-API-SYNC-001: 邮件同步 API 验证', () => {
  it('should return 202 and jobId', async () => {
    const response = await request(app)
      .post('/api/mail-accounts/123/sync/progressive')
      .send({ target: 300 });

    expect(response.status).toBe(202);
    expect(response.body).toHaveProperty('jobId');
  });
});
```

```typescript
// UI 层测试 - 使用 Playwright
// 文件: e2e/specs/sync-ui.spec.ts
import { test, expect } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';

test.describe('UI Tests', () => {
  test.describe('Sync Display', () => {
    test('TC-UI-SYNC-001: 邮件同步 UI 显示验证', async ({ page }) => {
      qase.id(599);

      await page.goto('/workspace');
      await expect(page.locator('.mail-list')).toBeVisible();
    });
  });
});
```

**❌ 避免混合层级**

```typescript
// ❌ 错误：在同一个测试中混合 API 和 UI 操作
test('混合测试', async ({ page, request }) => {
  // API 调用
  await request.post('/api/sync');

  // UI 验证
  await page.goto('/workspace');
  await expect(page.locator('.mail-list')).toBeVisible();
});
```

**理由**：
- Qase 会提示 "Non-browser action" 警告
- 无法准确统计各层测试通过率
- 测试职责不清晰，难以维护

---

## 📝 测试命名规范

### Custom ID 格式

**标准格式**: `TC-{LAYER}-{MODULE}-{NUMBER}`

- **LAYER**: 测试层级（API, UI, E2E, INT, PERF）
- **MODULE**: 功能模块（SYNC, INBOX, ACCOUNT, SEARCH, TAG, ARCHIVE, AI, etc.）
- **NUMBER**: 三位数字编号（001-999）

### 测试标题格式

**完整格式**: `{CUSTOM_ID}: {中文描述} @{tags}`

```typescript
// ✅ 正确示例
test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', async ({ page }) => {
  qase.id(599);
  // ...
});

test('TC-API-SYNC-001: 渐进式同步 API 响应验证 @critical', async ({ request }) => {
  qase.id(545);
  // ...
});

test('TC-E2E-WORKFLOW-001: 完整邮件处理流程 @e2e @critical', async ({ page }) => {
  qase.id(700);
  // ...
});
```

**❌ 错误示例**

```typescript
// ❌ NUMBER 必须是 3 位
test('TC-API-SYNC-01: 测试', async () => {});

// ❌ 缺少 LAYER
test('TC-SYNC-001: 测试', async () => {});

// ❌ MODULE 必须大写
test('TC-API-sync-001: 测试', async () => {});

// ❌ 缺少 Custom ID
test('邮件同步测试', async () => {});
```

### 标签使用规范

```typescript
// 单个标签
test('TC-UI-SMOKE-001: 基础功能验证 @smoke', async ({ page }) => {});

// 多个标签
test('TC-E2E-WORKFLOW-001: 核心流程测试 @e2e @critical', async ({ page }) => {});

// 推荐的标签
// @smoke       - 冒烟测试
// @critical    - 关键功能
// @regression  - 回归测试
// @e2e         - 端到端测试
// @flaky       - 不稳定测试（需修复）
```

---

## 🎯 测试结构规范

### 必需元素清单

每个测试文件必须包含：

#### 1. Import 声明 ✅

```typescript
import { test, expect } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';  // ✅ 必需
```

#### 2. test.describe() 嵌套 ✅

使用嵌套的 `test.describe()` 创建清晰的层级结构：

```typescript
test.describe('API Tests', () => {              // Layer 1: 顶层分类
  test.describe('Mail Sync Endpoints', () => {  // Layer 2: 功能模块
    test('TC-API-SYNC-001: 测试标题', async ({ request }) => {
      qase.id(545);
      // 测试逻辑...
    });
  });
});
```

**对应的 Suite 层级**：
```
API Tests
└── Mail Sync Endpoints
    └── TC-API-SYNC-001: 测试标题
```

#### 3. qase.id() 注解 ✅

每个测试必须关联 Qase ID：

```typescript
test('TC-UI-SMOKE-001: 测试标题', async ({ page }) => {
  qase.id(599);  // ✅ 必需：关联到 Qase 测试用例
  // 测试逻辑...
});
```

**如何获取 Qase ID**：

```bash
# 运行同步流水线（会自动更新 qase.id()）
node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js
```

#### 4. test.step() 定义步骤 ⚠️（强烈推荐）

使用 `test.step()` 将测试分解为清晰的步骤：

```typescript
test('TC-API-SYNC-001: 渐进式同步验证', async ({ request }) => {
  qase.id(545);

  await test.step('Step 1: 触发同步任务', async () => {
    const response = await request.post('/api/sync');
    expect(response.status()).toBe(202);
  });

  await test.step('Step 2: 验证任务状态', async () => {
    const status = await request.get('/api/sync/status');
    expect(status.body.state).toBe('completed');
  });

  await test.step('Step 3: 验证数据完整性', async () => {
    const data = await request.get('/api/mails');
    expect(data.body.length).toBeGreaterThan(0);
  });
});
```

**在 Qase 中的显示**：

测试步骤会自动同步到 Qase 的 Steps 表格。

---

## 📚 JSDoc 元数据规范

### 基本格式

为每个测试添加 JSDoc 注释，提供完整的测试说明：

```typescript
/**
 * @description
 * [测试目的和范围的详细说明]
 * [可以使用多段落描述测试策略]
 *
 * @preconditions
 * - [前置条件 1]
 * - [前置条件 2]
 *
 * @postconditions
 * - [后置条件 1]
 * - [后置条件 2]
 *
 * @severity [critical|major|normal|minor|trivial]
 * @behavior [positive|negative|destructive]
 * @flaky [yes|no]
 */
test('TC-XXX-XXX-XXX: 测试标题', async () => {
  qase.id(XXX);
  // 测试逻辑...
});
```

### JSDoc 最佳实践

#### 1. @description（描述） - 必需

描述应该包含：
- **测试目的**：为什么要做这个测试？验证什么？
- **测试范围**：覆盖哪些功能点？
- **测试策略**：如何验证（分阶段说明）

**示例**：

```typescript
/**
 * @description
 * 验证渐进式邮件同步的完整流程，从触发同步到数据落库的全链路测试。
 *
 * 测试策略：
 * - Phase 1: 触发 Quick Phase 同步，验证快速返回
 * - Phase 2: 等待 Standard Phase 完成，验证完整数据
 * - Phase 3: 验证数据完整性、去重、增量准确性
 */
```

#### 2. @preconditions（前置条件） - 强烈推荐

列出测试执行前必须满足的条件：

```typescript
/**
 * @preconditions
 * - 后端服务已启动并运行在 http://localhost:3000
 * - 数据库已初始化且可访问（Prisma migrations 已执行）
 * - 测试邮箱账户凭证已配置在 .env.test 文件中
 *   - TEST_EMAIL: QQ 邮箱地址
 *   - TEST_PASSWORD: IMAP 授权码
 * - IMAP 服务器 (imap.qq.com:993) 网络可达
 * - pg-boss 队列服务正常运行
 */
```

#### 3. @postconditions（后置条件） - 强烈推荐

列出测试执行后期望达到的状态：

```typescript
/**
 * @postconditions
 * - 测试账号成功创建，状态为 'active'
 * - 邮件同步达到目标数量（300封）
 * - 所有邮件数据无重复（ID 和 messageId 唯一性验证）
 * - 增量同步数据准确性验证通过
 * - 测试账号保留在数据库中（可用于后续测试）
 */
```

#### 4. @severity（严重程度） - 推荐

定义测试失败的影响程度：

**可用值**：
- `blocker` - 阻塞性问题，核心功能完全无法使用
- `critical` - 严重问题，影响核心功能
- `major` - 主要问题，影响重要功能
- `normal` - 普通问题（默认值）
- `minor` - 轻微问题，影响次要功能
- `trivial` - 微不足道的问题

```typescript
/**
 * @severity critical
 */
test('TC-API-AUTH-001: 用户登录验证', async () => {
  // 登录是核心功能，失败会严重影响系统
});
```

#### 5. @behavior（行为类型） - 可选

```typescript
/**
 * @behavior positive   - 正向测试（验证正常流程）
 * @behavior negative   - 负向测试（验证异常处理）
 * @behavior destructive - 破坏性测试（验证系统恢复能力）
 */
```

#### 6. @flaky（不稳定标志） - 可选

```typescript
/**
 * @flaky yes  - 测试不稳定（时快时慢或偶尔失败）
 * @flaky no   - 测试稳定（默认值）
 */
```

### 何时应该添加 JSDoc

**强烈推荐添加**（解决 Qase AI 审查问题）：
- ✅ API 集成测试（需要明确环境依赖和数据状态）
- ✅ 端到端流程测试（需要说明完整的业务流程）
- ✅ 复杂的测试场景（多步骤、多依赖、长时运行）
- ✅ 需要特殊环境配置的测试

**可选添加**：
- ⚠️ 简单的 UI 单元测试
- ⚠️ 冒烟测试（逻辑简单明了）
- ⚠️ 边界条件测试（测试意图清晰）

---

## 📂 文件组织规范

### 目录结构

```
project-root/
├── backend/
│   └── test/
│       └── *.e2e.spec.ts           # API 层测试 (Jest)
├── e2e/
│   ├── specs/
│   │   ├── smoke-ui.spec.ts        # UI 冒烟测试
│   │   ├── core-workflow.spec.ts   # 核心流程测试
│   │   ├── sync-*.spec.ts          # 同步功能测试
│   │   └── *.spec.ts               # 其他 UI/E2E 测试
│   ├── helpers/
│   │   ├── test-setup.ts           # 公共设置
│   │   ├── data-validators.ts      # 数据验证
│   │   └── test-helpers.ts         # 工具函数
│   ├── pages/
│   │   └── *.ts                    # Page Object Models
│   └── qase/
│       └── qase-id-mapping.json    # Qase ID 映射
└── playwright.config.ts            # Playwright 配置
```

### 文件命名规范

```bash
# API 层测试 (Jest)
backend/test/mail-accounts.e2e.spec.ts
backend/test/mail-sync-api.e2e.spec.ts

# UI 层测试 (Playwright)
e2e/specs/smoke-ui.spec.ts
e2e/specs/sync-ui.spec.ts
e2e/specs/inbox-display.spec.ts

# E2E 流程测试
e2e/specs/core-workflow.spec.ts
e2e/specs/sync-progressive.spec.ts
```

---

## 🎨 完整示例

### API 层测试（完整版）

```typescript
import { test, expect } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';

test.describe('API Tests', () => {
  test.describe('Mail Sync Endpoints', () => {

    /**
     * @description
     * 验证渐进式邮件同步 API 的完整流程，从触发同步到数据落库。
     * 这是一个 API 集成测试，验证后端同步系统的正确性和性能。
     *
     * 测试策略：
     * - Phase 1: 触发同步任务，验证 202 响应和 jobId
     * - Phase 2: 轮询任务状态，等待完成
     * - Phase 3: 验证数据完整性、去重、增量准确性
     *
     * @preconditions
     * - 后端服务已启动 (http://localhost:3000)
     * - 数据库可访问且已执行 migrations
     * - 测试邮箱凭证已配置 (.env.test)
     * - IMAP 服务器网络可达
     * - pg-boss 队列服务正常运行
     *
     * @postconditions
     * - API 返回 202 状态码和有效 jobId
     * - 同步任务在 5 分钟内完成
     * - 邮件数据无重复
     * - cursor 和 unread_count 正确更新
     *
     * @severity critical
     * @behavior positive
     * @flaky no
     */
    test('TC-API-SYNC-001: 渐进式同步 API 完整流程验证', async ({ request }) => {
      qase.id(545);

      let jobId: string;

      await test.step('Step 1: 触发同步任务', async () => {
        const response = await request.post('/api/mail-accounts/123/sync/progressive', {
          data: { target: 300 }
        });

        expect(response.status()).toBe(202);
        const body = await response.json();
        expect(body).toHaveProperty('jobId');
        jobId = body.jobId;
      });

      await test.step('Step 2: 等待任务完成', async () => {
        let completed = false;
        const maxWait = 5 * 60 * 1000; // 5 分钟
        const startTime = Date.now();

        while (!completed && Date.now() - startTime < maxWait) {
          const statusResponse = await request.get(`/api/jobs/${jobId}/status`);
          const status = await statusResponse.json();

          if (status.state === 'completed') {
            completed = true;
          } else if (status.state === 'failed') {
            throw new Error(`Sync job failed: ${status.error}`);
          } else {
            await new Promise(resolve => setTimeout(resolve, 10000)); // 等待 10 秒
          }
        }

        expect(completed).toBeTruthy();
      });

      await test.step('Step 3: 验证数据完整性', async () => {
        const mailsResponse = await request.get('/api/mails?accountId=123');
        const mails = await mailsResponse.json();

        // 验证数量
        expect(mails.length).toBeGreaterThan(0);

        // 验证唯一性
        const ids = mails.map(m => m.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);

        // 验证内容质量
        const sample = mails.slice(0, 10);
        sample.forEach(mail => {
          expect(mail.subject).toBeTruthy();
          expect(mail.from).toBeTruthy();
        });
      });
    });
  });
});
```

### UI 层测试（完整版）

```typescript
import { test, expect } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';

test.describe('UI Tests', () => {
  test.describe('Smoke Tests', () => {

    /**
     * @description
     * 验证 Workspace 页面能够正常加载，无 JavaScript 错误。
     * 这是一个 UI 冒烟测试，确保基础页面功能正常。
     *
     * @preconditions
     * - 前端服务已启动 (http://localhost:5173)
     * - 后端服务正常运行
     * - Mock 数据已重置
     *
     * @postconditions
     * - 页面加载成功，无白屏
     * - 无 JavaScript 错误
     * - 主要容器元素可见
     *
     * @severity major
     * @behavior positive
     * @flaky no
     */
    test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', async ({ page }) => {
      qase.id(599);

      await test.step('导航到 Workspace 页面', async () => {
        await page.goto('/workspace');
        await page.waitForLoadState('networkidle');
      });

      await test.step('验证页面加载成功', async () => {
        await expect(page.locator('.workspace-container')).toBeVisible();
        await expect(page.locator('.mail-list-container')).toBeVisible();
      });

      await test.step('验证无 JavaScript 错误', async () => {
        const errors = [];
        page.on('pageerror', error => errors.push(error));

        await page.waitForTimeout(2000); // 等待可能的异步错误
        expect(errors).toHaveLength(0);
      });
    });
  });
});
```

---

## 🔧 常见问题修复

### 问题 1: 缺少 import { qase }

```typescript
// ✅ 在文件开头添加
import { qase } from 'playwright-qase-reporter';
```

### 问题 2: Custom ID 格式不正确

```typescript
// ❌ 错误
test('TC-E2E-AI-01: AI 功能测试', async () => {

// ✅ 正确（NUMBER 必须是 3 位）
test('TC-E2E-AI-001: AI 功能测试', async () => {
```

### 问题 3: 缺少 qase.id()

```bash
# 运行同步流水线（会自动添加 qase.id()）
node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js
```

### 问题 4: 缺少 test.describe() 包裹

```typescript
// ❌ 修复前
test('TC-UI-SMOKE-001: 测试标题', async ({ page }) => {
  qase.id(599);
  // ...
});

// ✅ 修复后
test.describe('UI Tests', () => {
  test.describe('Smoke Tests', () => {
    test('TC-UI-SMOKE-001: 测试标题', async ({ page }) => {
      qase.id(599);
      // ...
    });
  });
});
```

### 问题 5: 混合 API 和 UI 操作

```typescript
// ❌ 错误：导致 Qase "Non-browser action" 警告
test('混合测试', async ({ page, request }) => {
  await request.post('/api/sync');  // API 操作
  await page.goto('/workspace');    // UI 操作
});

// ✅ 正确：拆分为两个独立测试
// API 测试
test('TC-API-SYNC-001: API 验证', async ({ request }) => {
  await request.post('/api/sync');
});

// UI 测试
test('TC-UI-SYNC-001: UI 显示验证', async ({ page }) => {
  await page.goto('/workspace');
});
```

---

## 🚀 工作流集成

### 完整工作流

```bash
# 步骤 1: 编写测试代码
vim e2e/specs/smoke-ui.spec.ts

# 步骤 2: 通过 CSV 创建 test case
node ~/.claude/skills/qase-testops-manager/scripts/generate-csv.js --update
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js
node ~/.claude/skills/qase-testops-manager/scripts/sync-from-qase.js

# 步骤 3: 审核测试代码是否符合规范
node ~/.claude/skills/qase-testops-manager/scripts/review-test-standards.js e2e/specs/smoke-ui.spec.ts

# 步骤 4: 执行测试
npx playwright test e2e/specs/smoke-ui.spec.ts

# 步骤 5: 查看报告
npx playwright show-report
```

### 运行测试

```bash
# API 层测试
cd backend
npm run test:e2e -- mail-sync-api.e2e.spec.ts

# UI 层测试
npx playwright test e2e/specs/smoke-ui.spec.ts

# 运行特定标签
npx playwright test --grep @smoke
npx playwright test --grep @critical

# 调试模式
npx playwright test --debug e2e/specs/smoke-ui.spec.ts
```

---

## 📊 评分系统

### 审核报告解读

- **100分**: 所有检查项通过 ✅
- **90-99分**: 有少量警告，建议改进 ⚠️
- **80-89分**: 有一些问题或较多警告 ⚠️
- **<80分**: 有多个必须修复的问题 ❌

### 问题级别

#### ❌ 错误（必须修复）

- 缺少 `import { qase }`
- Custom ID 格式不正确
- 缺少 `qase.id()` 注解
- 混合 API 和 UI 操作

#### ⚠️ 警告（建议改进）

- 缺少 `test.describe()` 包裹
- 未使用 `test.step()` 定义步骤
- 缺少 `@description` JSDoc 注释
- 缺少 `@preconditions` JSDoc 注释
- 缺少 `@postconditions` JSDoc 注释

---

## 🎓 最佳实践总结

### ✅ 推荐

1. **明确测试层级**
   - API 测试用 Jest
   - UI 测试用 Playwright
   - 不要混合

2. **Test 名称包含完整信息**
   ```typescript
   test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', ...)
   ```

3. **使用嵌套的 test.describe()**
   ```typescript
   test.describe('UI Tests', () => {
     test.describe('Smoke Tests', () => {
       test('...', ...)
     });
   });
   ```

4. **使用 test.step() 分解步骤**
   ```typescript
   await test.step('步骤名称', async () => {
     // ...
   })
   ```

5. **添加完整的 JSDoc**
   - @description - 说明测试目的
   - @preconditions - 列出前置条件
   - @postconditions - 列出后置条件

6. **CSV 导入 + Playwright Reporter 组合**
   - CSV 创建 test case（包含 Custom ID）
   - Reporter 上报执行结果

### ❌ 避免

1. **不要省略 Custom ID**
2. **不要使用不规范的 Custom ID 格式**
3. **不要混合 API 和 UI 操作**
4. **不要省略 qase.id() 注解**
5. **不要跳过 JSDoc（对于复杂测试）**

---

## 📚 相关文档

- [Qase 测试代码规范](test-standards.md)
- [Playwright Qase Reporter 快速参考](quick-reference-playwright.md)
- [Playwright Qase Reporter 详细说明](playwright-qase-reporter.md)
- [双向同步](bidirectional-sync.md)
- [Suite 组织规范](suite-organization-standards.md)

---

**最后更新**: 2025-11-02
