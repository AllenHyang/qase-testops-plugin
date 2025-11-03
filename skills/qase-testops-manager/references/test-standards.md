# Qase 测试代码规范

## 📚 完整规范文档

**本文档提供快速检查清单和常见问题修复。**

**完整的 Playwright 编写规范，请参考**：
👉 [`playwright-coding-standards.md`](playwright-coding-standards.md) ⭐

**包含内容**：
- 测试分层架构（API vs UI 层）
- 文件组织规范
- 完整示例（API、UI、E2E）
- 最佳实践总结
- 问题修复指南

---

## 📋 审核工具

使用 `review-test-standards.js` 检查测试代码是否符合规范：

```bash
# 审核所有测试文件
node ~/.claude/skills/qase-testops-manager/scripts/review-test-standards.js

# 审核单个文件
node ~/.claude/skills/qase-testops-manager/scripts/review-test-standards.js path/to/test.spec.ts
```

---

## ✅ 必需元素检查清单

### 1. Import 声明 ✅

```typescript
import { test, expect } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';  // ✅ 必需
```

### 2. Custom ID 格式 ✅

**标准格式**: `TC-{LAYER}-{MODULE}-{NUMBER}`

```typescript
test('TC-API-CONTRACT-001: Workspace API 契约一致性验证', async () => {
  // ...
});
```

**有效的 Custom ID**:
- ✅ `TC-API-SYNC-001`
- ✅ `TC-UI-SMOKE-001`
- ✅ `TC-E2E-WORKFLOW-001`

**无效的 Custom ID**:
- ❌ `TC-API-01` (NUMBER 必须是 3 位)
- ❌ `TC-SYNC-001` (缺少 LAYER)
- ❌ `TC-API-sync-001` (MODULE 必须大写)

### 3. qase.id() 注解 ✅

```typescript
test('TC-UI-SMOKE-001: 测试标题', async ({ page }) => {
  qase.id(599);  // ✅ 必需：关联到 Qase 测试用例
  // 测试逻辑...
});
```

**如何获取 Qase ID**:
```bash
# 运行同步流水线（会自动更新 qase.id()）
node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js
```

### 4. test.describe() 嵌套（Code First）⚠️ 强烈推荐

**重要**：Suite 层级由 `test.describe()` 嵌套定义，**不使用** `qase.suite()`

```typescript
test.describe('API Tests', () => {              // Layer 1: 顶层分类
  test.describe('Contract Validation', () => {  // Layer 2: 功能模块
    test('TC-API-CONTRACT-001: 测试标题', async () => {
      qase.id(545);
      // 测试逻辑...
    });
  });
});
```

**对应的 Qase Suite 层级**：
```
API Tests
└── Contract Validation
    └── TC-API-CONTRACT-001
```

**为什么不用 qase.suite()？**
- ✅ Code First：代码中的 test.describe() 是唯一数据源
- ✅ CSV Manager Skill 从 test.describe() 提取 Suite 信息
- ✅ 避免代码和配置不一致
- ✅ 更简洁，减少维护成本

### 5. test.step() 使用 ⚠️（推荐）

#### 基础格式

```typescript
test('TC-API-CONTRACT-001: 测试标题', async ({ request }) => {
  qase.id(545);

  await test.step('获取 Workspace 列表', async () => {
    const response = await request.get('/api/workspaces');
    expect(response.ok()).toBeTruthy();
  });

  await test.step('验证响应结构', async () => {
    const data = await response.json();
    expect(data).toHaveProperty('workspaces');
  });
});
```

#### 详细格式（推荐用于 Qase 步骤表格）

使用 `|` 分隔符定义详细的步骤信息，包括：**Action（操作）**、**Data（数据）**、**Expected Result（期望结果）**

```typescript
test('TC-API-AUTH-001: 用户登录验证', async ({ request }) => {
  qase.id(123);

  await test.step('发送登录请求 | email=test@example.com, password=****** | 返回 200 状态码和 token', async () => {
    const response = await request.post('/api/auth/login', {
      data: { email: 'test@example.com', password: 'password123' }
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('token');
  });

  await test.step('使用 token 访问受保护资源 | Authorization: Bearer <token> | 成功获取用户信息', async () => {
    const response = await request.get('/api/user/profile', {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(response.ok()).toBeTruthy();
  });
});
```

**格式说明**：
- **简单格式**：`'操作描述'` - 只定义操作，自动同步到 Qase 的 Action 列
- **带数据**：`'操作描述 | 测试数据'` - 定义操作和数据
- **完整格式**：`'操作描述 | 测试数据 | 期望结果'` - 定义全部三个字段

**在 Qase 中显示为表格**：

| # | Action | Data | Expected Result |
|---|--------|------|-----------------|
| 1 | 发送登录请求 | email=test@example.com, password=****** | 返回 200 状态码和 token |
| 2 | 使用 token 访问受保护资源 | Authorization: Bearer <token> | 成功获取用户信息 |
```

### 6. JSDoc 元数据 ⚠️（推荐）

为测试添加 JSDoc 注释，提供详细的测试说明、前置条件和后置条件。

#### 📝 基本格式

```typescript
/**
 * @description
 * [测试目的和范围的详细说明]
 * [可以使用多段落描述测试策略]
 *
 * @preconditions
 * - [前置条件 1]
 * - [前置条件 2]
 * - [前置条件 3]
 *
 * @postconditions
 * - [后置条件 1]
 * - [后置条件 2]
 * - [后置条件 3]
 */
test('TC-XXX-XXX-XXX: 测试标题', async () => {
  qase.id(XXX);
  // 测试逻辑...
});
```

#### 🎯 JSDoc 最佳实践

**1. @description（描述） - 必需**

描述应该包含：
- **测试目的**：为什么要做这个测试？验证什么？
- **测试范围**：覆盖哪些功能点？
- **测试策略**：如何验证（分阶段说明）
- **测试类型说明**：API集成测试、UI测试、端到端测试等

示例：
```typescript
/**
 * @description
 * 完整的渐进式邮件同步流程验证，从零开始创建账号、同步文件夹、渐进式同步邮件到目标数量。
 * 这是一个端到端 API 集成测试，验证整个同步系统的正确性、数据完整性和性能。
 *
 * 测试策略：
 * - Phase 0: 环境健康检查和测试账号创建
 * - Phase 1: 文件夹结构同步（验证 IMAP 文件夹发现）
 * - Phase 2: 渐进式邮件同步（Quick + Standard 两阶段）
 * - Phase 3: 完整数据验证（去重、增量准确性、内容质量）
 *
 * @severity critical
 * @behavior positive
 * @flaky no
 */
```

**2. @preconditions（前置条件） - 推荐**

列出测试执行前必须满足的条件：
- **环境依赖**：服务、数据库、网络等
- **配置要求**：环境变量、配置文件等
- **数据状态**：初始数据、测试账号等
- **外部服务**：第三方服务可用性等

示例：
```typescript
/**
 * @preconditions
 * - 后端服务已启动并运行在 http://localhost:3000
 * - 数据库已初始化且可访问（Prisma migrations 已执行）
 * - 测试邮箱账户凭证已配置在 .env.test 文件中
 *   - TEST_EMAIL: QQ 邮箱地址
 *   - TEST_PASSWORD: IMAP 授权码
 *   - TEST_PROVIDER: qq
 * - IMAP 服务器 (imap.qq.com:993) 网络可达
 * - 测试环境中无其他同步任务正在运行
 * - pg-boss 队列服务正常运行
 */
```

**3. @postconditions（后置条件） - 推荐**

列出测试执行后期望达到的状态：
- **数据状态**：创建/更新的数据
- **系统状态**：服务状态、资源状态等
- **验证结果**：通过的检查点
- **清理说明**：是否保留数据、如何清理等

示例：
```typescript
/**
 * @postconditions
 * - 测试账号成功创建，状态为 'active'
 * - 文件夹同步完成，至少包含 INBOX、Sent、Drafts 等标准文件夹
 * - 邮件同步达到目标数量（300封）或超时（5分钟）
 * - 所有邮件数据无重复（ID 和 messageId 唯一性验证）
 * - 增量同步数据准确性验证通过
 * - 邮件内容质量检查通过（无空 subject/body）
 * - 测试账号保留在数据库中（可用于后续测试或手动检查）
 */
```

**4. @severity（严重程度） - 推荐**

定义测试失败的影响程度：

**可用值**：
- `blocker` - 阻塞性问题，核心功能完全无法使用
- `critical` - 严重问题，影响核心功能
- `major` - 主要问题，影响重要功能
- `normal` - 普通问题（默认值）
- `minor` - 轻微问题，影响次要功能
- `trivial` - 微不足道的问题

示例：
```typescript
/**
 * @description 验证用户登录功能
 * @severity critical
 */
test('TC-API-AUTH-001: 用户登录验证', async () => {
  // 登录是核心功能，失败会严重影响系统
});
```

**5. @behavior（行为类型） - 可选**

定义测试验证的行为类型：

**可用值**：
- `positive` - 正向测试（验证正常流程）
- `negative` - 负向测试（验证异常处理）
- `destructive` - 破坏性测试（验证系统恢复能力）

示例：
```typescript
/**
 * @description 验证无效密码登录被拒绝
 * @behavior negative
 */
test('TC-API-AUTH-002: 无效密码登录失败', async () => {
  // 验证系统正确拒绝无效凭证
});
```

**6. @flaky（不稳定标志） - 可选**

标记测试是否不稳定（时快时慢或偶尔失败）：

**可用值**：
- `yes` / `true` / `1` - 测试不稳定
- `no` / `false` / `0` - 测试稳定（默认值）

示例：
```typescript
/**
 * @description 验证第三方 API 集成
 * @flaky yes
 */
test('TC-INT-EXT-001: 第三方服务集成', async () => {
  // 依赖外部服务，可能不稳定
});
```

#### 📚 不同测试类型的 JSDoc 模板

**API 集成测试模板**

```typescript
/**
 * @description
 * [API功能说明]。验证 [具体验证点]。
 * 这是一个 API 集成测试，验证 [验证范围]。
 *
 * @severity [critical|major|normal]
 * @behavior [positive|negative]
 * @flaky [yes|no]
 *
 * @preconditions
 * - 后端服务已启动 (http://localhost:3000)
 * - 数据库可访问且已执行 migrations
 * - [其他服务依赖]
 * - [测试数据准备]
 *
 * @postconditions
 * - API 返回正确的 HTTP 状态码
 * - 响应数据结构符合契约
 * - [数据库状态变更]
 * - [其他副作用]
 */
test('TC-API-XXX-001: API 功能测试', async ({ request }) => {
  qase.id(XXX);
  // ...
});
```

**UI 交互测试模板**

```typescript
/**
 * @description
 * 验证 [UI功能] 的用户交互流程。
 * 测试从 [起始状态] 到 [结束状态] 的完整用户操作路径。
 *
 * @severity [major|normal|minor]
 * @behavior [positive|negative]
 *
 * @preconditions
 * - 前端服务已启动 (http://localhost:5173)
 * - 后端服务正常运行
 * - Mock 数据已重置
 * - 用户已登录/未登录（根据场景）
 *
 * @postconditions
 * - UI 正确响应用户操作
 * - 页面状态符合预期
 * - 无 JavaScript 错误或警告
 * - [数据持久化情况]
 */
test('TC-UI-XXX-001: UI 交互测试', async ({ page }) => {
  qase.id(XXX);
  // ...
});
```

**端到端流程测试模板**

```typescript
/**
 * @description
 * 完整的 [业务流程] 验证，覆盖从 [起点] 到 [终点] 的全流程。
 * 这是一个端到端测试，验证 [系统整体行为]。
 *
 * 测试步骤：
 * 1. [步骤1说明]
 * 2. [步骤2说明]
 * 3. [步骤3说明]
 *
 * @severity [critical|major]
 * @behavior positive
 * @flaky [yes|no]
 *
 * @preconditions
 * - 所有服务（前端、后端、数据库等）已启动
 * - 测试环境配置完整
 * - [特定的业务前置条件]
 * - [测试数据准备]
 *
 * @postconditions
 * - 业务流程成功完成
 * - 所有中间状态正确
 * - 最终数据状态符合预期
 * - [清理或保留说明]
 */
test('TC-E2E-XXX-001: 端到端流程测试', async ({ page, request }) => {
  qase.id(XXX);
  // ...
});
```

#### ✅ 何时应该添加 JSDoc

**强烈推荐添加**（解决 Qase AI 审查问题）：
- ✅ API 集成测试（需要明确环境依赖和数据状态）
- ✅ 端到端流程测试（需要说明完整的业务流程）
- ✅ 复杂的测试场景（多步骤、多依赖、长时运行）
- ✅ 需要特殊环境配置的测试

**可选添加**：
- ⚠️ 简单的 UI 单元测试
- ⚠️ 冒烟测试（逻辑简单明了）
- ⚠️ 边界条件测试（测试意图清晰）

#### 🚀 JSDoc 的优势

1. **代码即文档**
   - 测试说明与代码同步维护
   - 版本控制追踪变更历史
   - 减少文档维护成本

2. **自动同步到 Qase**
   - 自动填充 Description 字段
   - 自动填充 Preconditions 字段
   - 自动填充 Postconditions 字段
   - 通过 Qase AI 审查

3. **提高代码质量**
   - 强制思考测试的前置条件
   - 明确测试的验证目标
   - 便于团队协作和代码审查

4. **IDE 支持**
   - 鼠标悬停即可查看测试说明
   - 便于快速理解测试意图
   - 支持跳转和搜索

---

## 📊 审核报告解读

### 评分系统

- **100分**: 所有检查项通过
- **90-99分**: 有少量警告，建议改进
- **80-89分**: 有一些问题或较多警告
- **<80分**: 有多个必须修复的问题

### 问题级别

#### ❌ 错误（必须修复）

- 缺少 `import { qase }`
- Custom ID 格式不正确
- 缺少 `qase.id()` 注解

#### ⚠️ 警告（建议改进）

- 缺少 `test.describe()` 包裹
- 未使用 `test.step()` 定义步骤
- 缺少 `@description` JSDoc 注释
- 缺少 `@preconditions` JSDoc 注释
- 缺少 `@postconditions` JSDoc 注释

---

## 🔧 常见问题修复

### 问题 1: 缺少 import { qase }

```typescript
// 在文件开头添加
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

---

## 🎯 完整示例（包含所有推荐元素）

### 示例 1: API 集成测试（完整版）

```typescript
import { test, expect } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';

test.describe('API Tests', () => {
  test.describe('Contract Validation', () => {

    /**
     * @description
     * 验证 Workspace API 返回的数据结构符合前端契约定义。
     * 这是一个 API 契约测试，确保 API 响应格式稳定，防止前后端集成问题。
     *
     * 测试策略：
     * - 验证 HTTP 响应状态和头部信息
     * - 验证响应体的 JSON 结构
     * - 验证关键字段的类型和必需性
     *
     * @preconditions
     * - 后端服务已启动并运行在 http://localhost:3000
     * - 数据库已初始化且可访问（Prisma migrations 已执行）
     * - 数据库中至少存在一个测试 Workspace
     * - API 认证凭据有效（Bearer Token 或 Session）
     * - 网络连接正常
     *
     * @postconditions
     * - API 返回 200 OK 状态码
     * - 响应 Content-Type 为 application/json
     * - 响应包含 workspaces 数组，数组长度 >= 1
     * - 每个 workspace 对象包含所有必需字段（id, name, createdAt 等）
     * - 数据库状态未改变（只读操作）
     */
    test('TC-API-CONTRACT-001: Workspace API 契约一致性验证', async ({ request }) => {
      qase.id(545);

      await test.step('Step 1: 发送 GET 请求获取 Workspace 列表', async () => {
        const response = await request.get('/api/workspaces');
        expect(response.ok()).toBeTruthy();
        expect(response.status()).toBe(200);
      });

      await test.step('Step 2: 验证响应结构符合契约', async () => {
        const data = await response.json();
        expect(data).toHaveProperty('workspaces');
        expect(Array.isArray(data.workspaces)).toBeTruthy();
        expect(data.workspaces.length).toBeGreaterThan(0);
      });

      await test.step('Step 3: 验证 Workspace 对象必需字段', async () => {
        const workspace = data.workspaces[0];
        expect(workspace).toHaveProperty('id');
        expect(workspace).toHaveProperty('name');
        expect(workspace).toHaveProperty('createdAt');

        // 验证字段类型
        expect(typeof workspace.id).toBe('string');
        expect(typeof workspace.name).toBe('string');
      });
    });
  });
});
```

### 示例 2: 端到端流程测试（真实案例）

这是一个基于实际项目的完整示例，展示了如何为复杂的端到端测试编写详细的 JSDoc：

```typescript
import { test, expect } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';

test.describe('API Tests', () => {
  test.describe('Sync Validation', () => {

    /**
     * @description
     * 完整的渐进式邮件同步流程验证，从零开始创建账号、同步文件夹、渐进式同步邮件到目标数量。
     * 这是一个端到端 API 集成测试，验证整个同步系统的正确性、数据完整性和性能。
     *
     * 测试策略：
     * - Phase 0: 环境健康检查和测试账号创建
     * - Phase 1: 文件夹结构同步（验证 IMAP 文件夹发现）
     * - Phase 2: 渐进式邮件同步（Quick + Standard 两阶段）
     * - Phase 3: 完整数据验证（去重、增量准确性、内容质量）
     *
     * @preconditions
     * - 后端服务已启动并运行在 http://localhost:3000
     * - 数据库已初始化且可访问（Prisma migrations 已执行）
     * - 测试邮箱账户凭证已配置在 .env.test 文件中
     *   - TEST_EMAIL: QQ 邮箱地址
     *   - TEST_PASSWORD: IMAP 授权码
     *   - TEST_PROVIDER: qq
     * - IMAP 服务器 (imap.qq.com:993) 网络可达
     * - 测试环境中无其他同步任务正在运行
     * - pg-boss 队列服务正常运行
     *
     * @postconditions
     * - 测试账号成功创建，状态为 'active'
     * - 文件夹同步完成，至少包含 INBOX、Sent、Drafts 等标准文件夹
     * - 邮件同步达到目标数量（300封）或超时（5分钟）
     * - 所有邮件数据无重复（ID 和 messageId 唯一性验证）
     * - 增量同步数据准确性验证通过
     * - 邮件内容质量检查通过（无空 subject/body）
     * - 测试账号保留在数据库中（可用于后续测试或手动检查）
     */
    test('TC-API-SYNC-015: 完整流程验证 (创建账号 → 同步 → 数据验证)', async ({ request }) => {
      qase.id(900);

      let accountId: string;

      await test.step('Phase 0: 健康检查', async () => {
        const healthResponse = await request.get('/health');
        expect(healthResponse.ok()).toBeTruthy();
      });

      await test.step('Phase 1: 创建测试账号', async () => {
        const response = await request.post('/api/mail-accounts', {
          data: {
            email: process.env.TEST_EMAIL,
            password: process.env.TEST_PASSWORD,
            provider: 'qq'
          }
        });

        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        accountId = data.id;
        expect(data.status).toBe('active');
      });

      await test.step('Phase 2: 同步文件夹结构', async () => {
        const response = await request.post(`/api/mail-accounts/${accountId}/sync-folders`);
        expect(response.ok()).toBeTruthy();

        const folders = await response.json();
        expect(folders.length).toBeGreaterThan(0);
        expect(folders.some(f => f.name === 'INBOX')).toBeTruthy();
      });

      // ... 更多测试步骤
    });
  });
});
```

---

**最后更新**: 2025-11-02
