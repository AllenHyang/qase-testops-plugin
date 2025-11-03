# Qase 双向同步 - 快速开始

## 🚀 一分钟上手

### 首次设置（只需一次）

```bash
# 1. 确保已配置 .qase-config.json
cat .qase-config.json

# 2. 提取测试用例
node ~/.claude/skills/qase-testops-manager/scripts/generate-csv.js

# 3. 上传到 Qase
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js

# 4. 获取 Qase ID 到 CSV
node ~/.claude/skills/qase-testops-manager/scripts/sync-from-qase.js

# 5. (可选) 在代码中添加 @qase-id 注解
node ~/.claude/skills/qase-testops-manager/scripts/update-test-code.js
```

## 📝 日常工作流

### 添加新测试

```bash
# 1. 写测试代码
vim e2e/specs/new-feature.spec.ts

# 2. 更新 CSV
node ~/.claude/skills/qase-testops-manager/scripts/generate-csv.js --update

# 3. 同步到 Qase（创建新 case，生成 ID）
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js

# 4. 回写 Qase ID
node ~/.claude/skills/qase-testops-manager/scripts/sync-from-qase.js

# 5. (可选) 更新代码注解
node ~/.claude/skills/qase-testops-manager/scripts/update-test-code.js

# 6. 提交到版本控制
git add e2e/specs/new-feature.spec.ts e2e/qase/qase-test-cases.csv
git commit -m "feat: add new feature tests"
```

### 修改现有测试

```bash
# 1. 修改测试代码
vim e2e/specs/existing.spec.ts

# 2. 更新 CSV
node ~/.claude/skills/qase-testops-manager/scripts/generate-csv.js --update

# 3. 同步到 Qase（基于 v2.id 更新，不创建新 case）
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js

# 4. 提交
git add e2e/specs/existing.spec.ts e2e/qase/qase-test-cases.csv
git commit -m "chore: update test cases"
```

## 🔄 同步方向

```
         generate-csv.js
代码 ────────────────────→ CSV
         (提取 Custom ID)

         sync-to-qase.js
CSV  ────────────────────→ Qase
      (创建/更新，生成 Qase ID)

       sync-from-qase.js
Qase ────────────────────→ CSV
         (回写 Qase ID)

      update-test-code.js
CSV  ────────────────────→ 代码
      (添加 @qase-id 注解)
```

## 🎯 核心命令速查

| 命令 | 作用 | 何时使用 |
|------|------|----------|
| `generate-csv.js` | 代码 → CSV | 添加/修改测试后 |
| `sync-to-qase.js` | CSV → Qase | 需要上传到 Qase 时 |
| `sync-from-qase.js` | Qase → CSV | 获取 Qase ID 时 |
| `update-test-code.js` | CSV → 代码 | 想在代码中加注解时 |
| `query-cases.js` | 查询 Qase | 检查同步结果 |

## 💡 常用组合

### 完整同步流程（推荐）

```bash
node ~/.claude/skills/qase-testops-manager/scripts/generate-csv.js --update && \
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js && \
node ~/.claude/skills/qase-testops-manager/scripts/sync-from-qase.js
```

### 快速更新（CSV 已有 Qase ID）

```bash
node ~/.claude/skills/qase-testops-manager/scripts/generate-csv.js --update && \
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js
```

### 验证同步结果

```bash
node ~/.claude/skills/qase-testops-manager/scripts/query-cases.js | grep "TC-API"
```

## 🐛 快速故障排查

### CSV 没有 Qase ID？

```bash
# 检查 Qase 是否有数据
node ~/.claude/skills/qase-testops-manager/scripts/query-cases.js

# 如果没有，先上传
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js

# 再回写
node ~/.claude/skills/qase-testops-manager/scripts/sync-from-qase.js
```

### Custom ID 格式错误？

```bash
# 验证所有 Custom ID
node ~/.claude/skills/qase-testops-manager/scripts/validate-test-ids.js
```

### update-test-code.js 报错？

```bash
# 重新生成 ID 映射
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js
```

## 📂 关键文件

| 文件 | 用途 | 是否提交到 Git |
|------|------|----------------|
| `qase-test-cases.csv` | 单一数据源 | ✅ 必须提交 |
| `qase-id-mapping.json` | 临时 ID 映射 | ❌ 可选 |
| `*.backup` | 备份文件 | ❌ 不提交 |
| 测试代码（带 @qase-id） | 代码注解 | ✅ 推荐提交 |

## 📚 更多文档

- 详细说明：`BIDIRECTIONAL_SYNC.md`
- 完整文档：`skill.md`
- 工作流程：`references/workflows.md`
- Custom ID 规范：`references/custom-id-standards.md`

## 🎓 示例

### 完整示例：添加新测试到 Qase

```typescript
// 1. 编写测试代码 (e2e/specs/payment.spec.ts)
test('TC-API-PAYMENT-001: Process payment successfully', async ({ request }) => {
  await test.step('Send payment request', async () => {
    // ...
  });

  await test.step('Verify payment status', async () => {
    // ...
  });
});
```

```bash
# 2. 执行同步
node ~/.claude/skills/qase-testops-manager/scripts/generate-csv.js --update
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js
node ~/.claude/skills/qase-testops-manager/scripts/sync-from-qase.js
node ~/.claude/skills/qase-testops-manager/scripts/update-test-code.js
```

```typescript
// 3. 代码自动更新为:
// @qase-id 12345
test('TC-API-PAYMENT-001: Process payment successfully', async ({ request }) => {
  await test.step('Send payment request', async () => {
    // ...
  });

  await test.step('Verify payment status', async () => {
    // ...
  });
});
```

```csv
# 4. CSV 包含完整信息:
v2.id,custom_id,title,...
12345,TC-API-PAYMENT-001,Process payment successfully,...
```

现在你可以：
- ✅ 在代码中看到 Qase ID：`12345`
- ✅ 在 CSV 中看到完整映射
- ✅ 在 Qase 平台查看测试用例
- ✅ 后续更新会基于 `v2.id` 而非重新创建

## ⚡ 快捷脚本（可选）

创建别名简化操作：

```bash
# 添加到 ~/.bashrc 或 ~/.zshrc
alias qase-update='node ~/.claude/skills/qase-testops-manager/scripts/generate-csv.js --update'
alias qase-sync='node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js'
alias qase-pull='node ~/.claude/skills/qase-testops-manager/scripts/sync-from-qase.js'
alias qase-annotate='node ~/.claude/skills/qase-testops-manager/scripts/update-test-code.js'
alias qase-full='qase-update && qase-sync && qase-pull'
```

使用：
```bash
# 完整同步
qase-full

# 快速更新
qase-update && qase-sync
```
