# Playwright Qase Reporter - Suite 层级覆盖方案

## 问题背景

Playwright Qase Reporter 的默认行为会根据以下信息自动创建 Suite 层级：

1. **Project name** - 来自 `playwright.config.ts` 的 `projects[].name`
2. **文件路径** - 测试文件的相对路径（如 `specs/smoke-ui.spec.ts`）
3. **test.describe() 嵌套** - 代码中的 describe 层级

这会导致创建深层嵌套的错误 Suite 结构：

```
default                          ← Project name
  └── specs/smoke-ui.spec.ts    ← 文件路径
      └── UI Tests              ← test.describe()
          └── Smoke Tests       ← 嵌套的 test.describe()
```

**期望的正确结构：**
```
UI Tests
  └── Smoke Tests
```

---

## 解决方案

### **使用 `qase.suite()` 明确指定 Suite 路径**

在测试代码中添加 `qase.suite()` 调用，覆盖 Reporter 的默认行为：

```typescript
test('TC-UI-SMOKE-001: Workspace 加载无错误验证 @smoke', async ({ page }) => {
  qase.id(612);
  qase.suite('UI Tests > Smoke Tests');  // 使用 > 作为层级分隔符
  // ...
});
```

---

## 关键技术点

### **1. Suite 层级分隔符**

✅ **正确：Tab 字符 (`\t`)**
```typescript
qase.suite('UI Tests\tSmoke Tests');       // 两层嵌套
qase.suite('E2E Tests\tArchive');          // 两层嵌套
qase.suite('API Tests\tSync Validation'); // 两层嵌套
```

**为什么使用 `\t`：**
- playwright-qase-reporter 官方文档明确指定使用 tab 字符作为层级分隔符
- Qase Reporter 会自动将 tab 解析为层级结构
- 在 Qase UI 中正确显示为父子层级关系
- 与 Reporter 内部逻辑完全一致

**重要提示：**
在 TypeScript/JavaScript 字符串中，`\t` 会被解释为真正的 tab 字符（ASCII 码 9），不是字面的反斜杠加 t。

❌ **错误：大于号带空格 (` > `)**
```typescript
qase.suite('UI Tests > Archive');
// 问题：Reporter 不识别 > 作为层级分隔符
// 结果：Qase 中显示为扁平的 "UI Tests > Archive" 字符串，而非层级结构
```

❌ **错误：斜杠 (`/`)**
```typescript
qase.suite('UI Tests / Archive');
// 问题：Reporter 不识别 / 作为层级分隔符
// 结果：创建扁平的 Suite 名称
```

❌ **错误：反斜杠 (`\`)**
```typescript
qase.suite('UI Tests\Archive');
// 问题：转义字符语法错误
// 结果：Suite 创建失败或层级错误
```

❌ **错误：只用空格**
```typescript
qase.suite('UI Tests Archive');
// 问题：无法区分层级
// 结果：扁平结构而非嵌套
```

### **2. 自动化添加 qase.suite()**

`update-qase-annotations.js` 脚本会自动：
- 从代码的 test.describe() 嵌套中提取 Suite 路径
- 使用 `\t` 作为层级分隔符
- 在 `qase.id()` 后添加 `qase.suite()`

**生成的代码：**
```typescript
test('TC-E2E-ARCHIVE-001: 归档单封邮件', async ({ page }) => {
  // 关联到 Qase 测试用例 EA-935
  qase.id(935);
  // 明确指定 suite 路径，覆盖 Reporter 的默认文件路径行为
  qase.suite('E2E Tests\tArchive');
  // ...
});
```

---

## 工作流

### **完整同步流程**

运行 `full-sync.js` 时，Step 5 会自动处理：

```bash
node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js
```

**Step 5: update-qase-annotations.js (Code First 实现)**
- ✅ 从 CSV 读取 Qase ID 映射（Custom ID → Qase ID）
- ✅ 从代码的 test.describe() 嵌套中实时提取 Suite 路径
- ✅ 为新测试添加 `qase.id()` + `qase.suite()`
- ✅ 为已有 `qase.id()` 的测试补充 `qase.suite()`
- ✅ 使用 `\t` 作为 Suite 层级分隔符

**Code First 原则：**
Suite 路径的唯一数据源是代码中的 test.describe() 嵌套结构，不依赖 CSV 或 JSON 文件。脚本会：
1. 读取每个测试文件
2. 解析 test.describe() 嵌套，提取 Suite 路径
3. 使用 `\t` 连接多层级 Suite
4. 生成 `qase.suite()` 注解

### **单独更新 Suite 注解**

如果只需要添加/更新 `qase.suite()`：

```bash
node ~/.claude/skills/qase-testops-manager/scripts/update-qase-annotations.js
```

---

## 验证

### **检查生成的代码**

```bash
grep -A3 "qase.id(" e2e/specs/smoke-ui.spec.ts
```

**正确的输出：**
```typescript
qase.id(897);
// 明确指定 suite 路径，覆盖 Reporter 的默认文件路径行为
qase.suite('UI Tests\tSmoke Tests');  // 使用 \t 分隔符
```

### **运行测试验证 Suite 结构**

```bash
npm run test:e2e -- e2e/specs/smoke-ui.spec.ts
```

检查 Qase Repository 中的 Suites 结构，应该看到：
- ✅ 正确的嵌套层级：UI Tests 作为父 Suite，Smoke Tests 作为子 Suite
- ❌ 不应有 `default / specs/...` 这样的错误层级
- ❌ 不应有 `UI Tests > Smoke Tests` 这样的扁平字符串

### **清理错误的 Suites**

如果之前使用了错误的分隔符，运行清理脚本：

```bash
node ~/.claude/skills/qase-testops-manager/scripts/cleanup-empty-suites.js --yes
```

这会删除所有空的、使用错误分隔符创建的 Suites（如 `E2E Tests > Archive`, `E2E Tests / Archive` 等）。

---

## 常见问题

### **Q: 为什么不能使用 `createCase: false` 禁用自动创建？**

A: Playwright Qase Reporter 即使配置了 `createCase: false`，仍会根据 test.describe() 和文件路径创建 Suite 路径。这是 Reporter 的内置行为，无法完全禁用。

### **Q: 可以手动修改 `qase.suite()` 吗？**

A: 可以。`update-qase-annotations.js` 检测到已有 `qase.suite()` 时会跳过，不会覆盖手动修改。但建议使用标准的 `\t` 分隔符以保持一致性。

### **Q: 如何处理多层嵌套的 Suite？**

A: 使用多个 `\t` 分隔符：
```typescript
qase.suite('Level1\tLevel2\tLevel3');  // 三层嵌套
```

### **Q: 为什么必须使用 `\t` 而不是 ` > `？**

A: 技术原因：
1. **Reporter 规范**：playwright-qase-reporter 官方文档明确指定使用 tab 字符作为层级分隔符
2. **正确解析**：Reporter 内部逻辑只识别 tab 字符，不识别 ` > ` 作为层级标记
3. **字符串处理**：JavaScript/TypeScript 字符串中的 `\t` 会被自动转换为真正的 tab 字符（ASCII 9）
4. **Qase 显示**：使用 `\t` 后，Qase UI 会正确显示父子层级关系，而不是扁平字符串

使用 `\t` 的优势：
1. 符合 Reporter 官方规范
2. 正确创建层级结构
3. 与 Reporter 内部逻辑一致
4. Qase UI 正确显示

---

## 相关文件

- **update-qase-annotations.js** - 自动添加/更新注解的脚本（Code First 实现）
  - `loadQaseIdMapping()` - 从 CSV 读取 Qase ID 映射
  - `extractNestedDescribePath()` - 从代码解析 test.describe() 嵌套，提取 Suite 路径
  - `updateFile()` - 为测试添加 qase.id() 和 qase.suite() 注解
- **full-sync.js** - 完整同步流水线（包含 Step 5）
- **extract-tests.js** - 从代码提取测试用例（支持解析 `\t` 分隔符）
- **review-test-standards.js** - 检查测试代码规范（验证 qase.suite() 使用 `\t` 分隔符）

---

## 更新历史

- **2025-01-02**: 初始版本 - 支持使用 ` > ` 作为 Suite 分隔符（后发现不符合 Reporter 规范）
- **2025-01-02**: 增强 update-qase-annotations.js - 支持为已有 qase.id() 的测试补充 qase.suite()
- **2025-01-02**: 重构为 Code First 架构 - Suite 路径从代码的 test.describe() 中实时提取，不依赖 CSV/JSON
- **2025-01-03**: **重大更新** - 修正为使用 `\t` (tab 字符) 作为 Suite 分隔符，符合 playwright-qase-reporter 官方规范
