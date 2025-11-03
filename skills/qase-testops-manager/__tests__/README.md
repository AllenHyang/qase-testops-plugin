# Qase TestOps Manager - Test Suite

测试覆盖核心脚本功能，确保代码质量和正确性。

## 测试结构

```
__tests__/
├── scripts/
│   ├── validate-test-ids.test.js       # Custom ID 验证逻辑测试
│   ├── extract-tests.test.js           # 测试用例提取核心功能测试
│   ├── update-qase-annotations.test.js # 代码自动更新逻辑测试
│   └── sync-single-case.test.js        # 单个用例同步测试
└── README.md
```

## 测试覆盖范围

### validate-test-ids.test.js
- ✅ Custom ID 格式验证 (TC-{LAYER}-{MODULE}-{NUMBER})
- ✅ 不同层级的 ID 格式（API, UI, E2E）
- ✅ 边界情况（层级长度、数字位数）
- ✅ 错误建议生成
- ✅ 文件名推断逻辑

### extract-tests.test.js
- ✅ Custom ID 验证
- ✅ 测试步骤提取（简单/带数据/完整格式）
- ✅ JSDoc 元数据提取 (@description, @preconditions, @postconditions)
- ✅ qase.id() 提取
- ✅ 测试类型检测 (smoke, regression, functional)
- ✅ 测试层级检测 (API, UI, E2E, UNIT)
- ✅ 优先级检测 (high, medium, low)
- ✅ Suite 层级提取（单层/多层嵌套）

### update-qase-annotations.test.js
- ✅ Custom ID 提取
- ✅ qase.id() 存在性检测
- ✅ qase.id() 注解生成
- ✅ Suite 路径提取（嵌套 describe）
- ✅ CSV ID 映射解析
- ✅ 代码更新逻辑（添加/更新/跳过）
- ✅ 备份文件处理
- ✅ 测试函数体检测
- ✅ 正则表达式模式匹配

### sync-single-case.test.js
- ✅ 测试 ID 解析（Custom ID 和 Qase ID 格式）
- ✅ 字段映射 (severity, priority, type, layer)
- ✅ Suite 路径解析（Tab/> 分隔符）
- ✅ 自定义字段处理
- ✅ 测试步骤格式化
- ✅ Suite 层级关系创建
- ✅ 更新数据对象构建

## 运行测试

### 安装依赖
```bash
cd ~/.claude/skills/qase-testops-manager
npm install
```

### 运行所有测试
```bash
npm test
```

### 监听模式（开发时使用）
```bash
npm run test:watch
```

### 生成覆盖率报告
```bash
npm run test:coverage
```

覆盖率报告将生成在 `coverage/` 目录。

## 测试最佳实践

### 1. 测试命名规范
- 使用描述性的测试名称
- 格式：`should [expected behavior] when [condition]`
- 例如：`should accept valid TC-API-SYNC-001 format`

### 2. 测试组织
- 使用 `describe` 分组相关测试
- 每个函数/功能一个 `describe` 块
- 按逻辑功能组织测试用例

### 3. 测试覆盖
- ✅ 正常情况（Happy Path）
- ✅ 边界条件（Boundary Cases）
- ✅ 错误情况（Error Cases）
- ✅ 空值/null 处理

### 4. 测试独立性
- 每个测试独立运行
- 不依赖其他测试的执行顺序
- 不共享可变状态

## Jest 配置

配置位于 `package.json`:

```json
{
  "jest": {
    "testEnvironment": "node",
    "testMatch": ["**/__tests__/**/*.test.js"],
    "coverageDirectory": "coverage",
    "collectCoverageFrom": [
      "scripts/**/*.js",
      "lib/**/*.js",
      "!scripts/full-sync.js"
    ]
  }
}
```

## 持续集成

测试应在以下场景自动运行：
- 提交代码前（Pre-commit hook）
- Pull Request 创建时
- 代码合并前

## 添加新测试

创建新测试文件时：

1. **命名规范**: `[script-name].test.js`
2. **位置**: `__tests__/scripts/` 目录
3. **结构**:
```javascript
/**
 * Tests for [script-name].js
 *
 * Brief description of what is being tested
 */

describe('[script-name].js', () => {
  describe('[function or feature]', () => {
    test('should [expected behavior]', () => {
      // Arrange
      const input = 'test-input';

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toBe('expected-output');
    });
  });
});
```

## 故障排查

### 测试失败
1. 查看错误信息和堆栈跟踪
2. 确认测试用例的预期行为
3. 检查相关代码是否有更改
4. 运行单个测试隔离问题：
   ```bash
   npm test -- validate-test-ids.test.js
   ```

### 覆盖率不足
1. 运行覆盖率报告：
   ```bash
   npm run test:coverage
   ```
2. 打开 `coverage/lcov-report/index.html`
3. 找到未覆盖的代码分支
4. 添加相应的测试用例

## 维护指南

- 📅 定期运行测试确保代码质量
- 🔄 代码更改时更新相应测试
- 📈 保持测试覆盖率 > 80%
- 📝 为新功能添加测试
- ♻️ 重构时确保测试通过

## 参考资源

- [Jest 官方文档](https://jestjs.io/docs/getting-started)
- [Jest Matchers](https://jestjs.io/docs/expect)
- [Jest Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
