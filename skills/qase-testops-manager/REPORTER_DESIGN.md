# Qase Skill Reporter 设计

## 🎯 目标

将 reporting 功能集成到 qase-testops-manager skill 中，提供：
1. **开箱即用**的 Playwright Reporter
2. **通用工具函数**供自定义使用
3. **配置化**，灵活适配不同项目
4. **可扩展**，支持未来的新功能

---

## 🏗️ 目录结构

```
~/.claude/skills/qase-testops-manager/
├── scripts/                    # 现有脚本
│   ├── full-sync.js
│   ├── update-last-run-results.js
│   └── ...
├── reporters/                  # 新增：Reporter 实现
│   ├── playwright/
│   │   ├── index.ts           # Playwright Reporter 主入口
│   │   ├── global-teardown.ts # Global Teardown 实现
│   │   └── types.ts           # 类型定义
│   ├── core/
│   │   ├── qase-updater.ts    # Qase 字段更新核心逻辑
│   │   └── result-parser.ts   # 测试结果解析
│   └── utils/
│       └── logger.ts          # 日志工具
├── references/                 # 现有文档
└── README_REPORTER.md         # Reporter 使用文档
```

---

## 📦 提供的能力

### 1. Playwright Global Teardown（推荐）

**使用方式**：
```typescript
// playwright.config.ts
import { qaseGlobalTeardown } from '~/.claude/skills/qase-testops-manager/reporters/playwright';

export default defineConfig({
  globalTeardown: qaseGlobalTeardown,
  // ...
});
```

### 2. Playwright Custom Reporter

**使用方式**：
```typescript
// playwright.config.ts
export default defineConfig({
  reporter: [
    ['html'],
    ['playwright-qase-reporter', { /* ... */ }],
    ['~/.claude/skills/qase-testops-manager/reporters/playwright', {
      updateLastRunResult: true,
      // 未来扩展：
      // createDefects: true,
      // sendNotification: true,
    }],
  ],
});
```

### 3. 工具函数（高级定制）

**使用方式**：
```typescript
import { updateQaseFields, parsePlaywrightResults } from '~/.claude/skills/qase-testops-manager/reporters/core';

// 自定义 reporter
class MyReporter implements Reporter {
  async onEnd(result) {
    const parsed = parsePlaywrightResults(result);
    await updateQaseFields(parsed);
  }
}
```

---

## 🔧 配置系统

### 配置文件扩展

**在 .qase-config.json 中添加**：
```json
{
  "qase": {
    "apiToken": "...",
    "projectCode": "EA",
    "lastRunResultFieldId": "2",

    // 新增：Reporter 配置
    "reporter": {
      "enabled": true,
      "autoUpdate": true,
      "features": {
        "updateLastRunResult": true,
        "createDefects": false,
        "sendNotification": false
      },
      "onError": "warn"  // "warn" | "throw" | "ignore"
    }
  }
}
```

---

## 📝 实现方案

### 方案 1: TypeScript 实现（推荐）

**优点**：
- ✅ 类型安全
- ✅ 易于维护
- ✅ IDE 支持好

**缺点**：
- ⚠️ 需要编译
- ⚠️ 项目需要支持 TS

### 方案 2: JavaScript 实现

**优点**：
- ✅ 无需编译
- ✅ 兼容性好

**缺点**：
- ❌ 无类型提示
- ❌ 易出错

### 推荐：混合方案

- **核心逻辑用 TypeScript**（在 skill 中编译）
- **提供编译后的 JS + d.ts**（项目直接使用）

---

## 🚀 实现步骤

### Phase 1: 基础实现

1. **创建 reporters 目录结构**
2. **实现 Global Teardown**
   ```typescript
   export default async function qaseGlobalTeardown() {
     await updateLastRunResults();
   }
   ```
3. **实现核心工具函数**
   ```typescript
   export async function updateQaseFields(config, results) {
     // 复用现有的 update-last-run-results.js 逻辑
   }
   ```

### Phase 2: Custom Reporter

1. **实现 Playwright Reporter 接口**
   ```typescript
   export default class QaseReporter implements Reporter {
     async onEnd(result) {
       await this.updateFields(result);
     }
   }
   ```

2. **添加配置支持**

### Phase 3: 扩展功能

1. **自动创建缺陷**
2. **通知集成**
3. **自定义字段更新**

---

## 📊 使用场景

### 场景 1: 简单项目（推荐）

```typescript
// playwright.config.ts
import { resolve } from 'path';
import { homedir } from 'os';

const skillPath = resolve(homedir(), '.claude/skills/qase-testops-manager');

export default defineConfig({
  globalTeardown: `${skillPath}/reporters/playwright/global-teardown.js`,
});
```

### 场景 2: 高级定制

```typescript
// e2e/reporters/custom.ts
import { updateQaseFields } from '~/.claude/skills/qase-testops-manager/reporters/core';

export default class CustomReporter implements Reporter {
  async onEnd(result) {
    // 自定义逻辑
    const filteredResults = this.filterResults(result);
    await updateQaseFields(filteredResults);

    // 其他自定义操作
    await this.sendSlackNotification(result);
  }
}
```

### 场景 3: CI/CD 集成

```yaml
# .github/workflows/test.yml
- name: Run E2E Tests
  run: npm run test:e2e
  env:
    QASE_AUTO_UPDATE: true
    QASE_CREATE_DEFECTS: true
```

---

## 🎨 API 设计

### Global Teardown

```typescript
/**
 * Qase Global Teardown
 * 自动更新 Last Run Result 字段
 *
 * @param config - 可选配置覆盖
 */
export default async function qaseGlobalTeardown(
  config?: Partial<QaseReporterConfig>
): Promise<void>;
```

### Custom Reporter

```typescript
/**
 * Qase Reporter 类
 */
export default class QaseReporter implements Reporter {
  constructor(options?: QaseReporterOptions);

  async onBegin(config: FullConfig, suite: Suite): Promise<void>;
  async onEnd(result: FullResult): Promise<void>;
}

export interface QaseReporterOptions {
  updateLastRunResult?: boolean;
  createDefects?: boolean;
  sendNotification?: boolean;
  onError?: 'warn' | 'throw' | 'ignore';
}
```

### 工具函数

```typescript
/**
 * 更新 Qase 测试用例字段
 */
export async function updateQaseFields(
  results: TestResult[],
  config?: QaseConfig
): Promise<UpdateResult>;

/**
 * 解析 Playwright 测试结果
 */
export function parsePlaywrightResults(
  result: FullResult
): TestResult[];

/**
 * 映射测试状态
 */
export function mapTestStatus(
  playwrightStatus: string
): QaseStatus;
```

---

## 📚 文档结构

### README_REPORTER.md

```markdown
# Qase Reporter 使用指南

## 快速开始

### 1. Global Teardown（推荐）
[代码示例]

### 2. Custom Reporter
[代码示例]

### 3. 高级定制
[代码示例]

## 配置选项

## API 文档

## 常见问题

## 示例项目
```

---

## ✅ 实施计划

### 第一步：创建基础结构
- [ ] 创建 reporters 目录
- [ ] 实现 Global Teardown
- [ ] 迁移现有逻辑到核心模块

### 第二步：完善功能
- [ ] 添加配置支持
- [ ] 实现 Custom Reporter
- [ ] 编写文档

### 第三步：项目集成
- [ ] 在当前项目中测试
- [ ] 验证功能完整性
- [ ] 收集反馈

### 第四步：发布和推广
- [ ] 更新 skill.md
- [ ] 添加示例项目
- [ ] 编写最佳实践

---

## 🎯 成功标准

1. ✅ 任何 Playwright 项目可以 5 分钟内集成
2. ✅ 提供至少 2 种使用方式（Global Teardown + Custom Reporter）
3. ✅ 完整的文档和示例
4. ✅ 配置化，易于定制
5. ✅ 错误处理完善，不影响测试流程

---

**预计时间**: 1-2 天完整实现
**复杂度**: ⭐⭐⭐☆☆
**价值**: ⭐⭐⭐⭐⭐
