#!/bin/bash

###############################################################################
# Qase 双向同步示例脚本
#
# 用途：演示完整的双向同步工作流程
# 使用：./examples/bidirectional-sync-example.sh
###############################################################################

set -e  # 遇到错误立即退出

SCRIPT_DIR="$HOME/.claude/skills/qase-testops-manager/scripts"
PROJECT_ROOT="$(pwd)"

echo "=================================================="
echo "  Qase 双向同步示例"
echo "=================================================="
echo ""

# 检查配置文件
if [ ! -f "$PROJECT_ROOT/.qase-config.json" ]; then
  echo "❌ 错误: 找不到 .qase-config.json"
  echo "   请先创建配置文件"
  exit 1
fi

echo "✅ 配置文件检查通过"
echo ""

###############################################################################
# 阶段 1: 提取测试用例（代码 → CSV）
###############################################################################

echo "=================================================="
echo "阶段 1: 从代码提取测试用例"
echo "=================================================="
echo ""

echo "📝 运行: generate-csv.js --update"
node "$SCRIPT_DIR/generate-csv.js" --update

echo ""
echo "✅ 阶段 1 完成"
echo "   - 已生成/更新 e2e/qase/qase-test-cases.csv"
echo "   - CSV 中的 v2.id 列可能为空（新测试用例）"
echo ""

read -p "按 Enter 继续到阶段 2..."
echo ""

###############################################################################
# 阶段 2: 上传到 Qase（CSV → Qase）
###############################################################################

echo "=================================================="
echo "阶段 2: 上传测试用例到 Qase"
echo "=================================================="
echo ""

echo "📤 运行: sync-to-qase.js"
node "$SCRIPT_DIR/sync-to-qase.js"

echo ""
echo "✅ 阶段 2 完成"
echo "   - 已创建/更新 Qase 中的测试用例"
echo "   - 已生成 e2e/qase/qase-id-mapping.json"
echo "   - 映射了 Custom ID → Qase ID"
echo ""

# 显示生成的映射
if [ -f "$PROJECT_ROOT/e2e/qase/qase-id-mapping.json" ]; then
  echo "📋 ID 映射示例 (前 3 个):"
  cat "$PROJECT_ROOT/e2e/qase/qase-id-mapping.json" | head -n 5
  echo ""
fi

read -p "按 Enter 继续到阶段 3..."
echo ""

###############################################################################
# 阶段 3: 回写 Qase ID（Qase → CSV）
###############################################################################

echo "=================================================="
echo "阶段 3: 从 Qase 同步 ID 到 CSV"
echo "=================================================="
echo ""

echo "🔄 运行: sync-from-qase.js"
node "$SCRIPT_DIR/sync-from-qase.js"

echo ""
echo "✅ 阶段 3 完成"
echo "   - CSV 的 v2.id 列已更新为 Qase ID"
echo "   - 已备份原 CSV 为 .backup 文件"
echo ""

# 显示 CSV 示例（前 3 行）
if [ -f "$PROJECT_ROOT/e2e/qase/qase-test-cases.csv" ]; then
  echo "📋 CSV 示例 (前 3 行):"
  head -n 4 "$PROJECT_ROOT/e2e/qase/qase-test-cases.csv" | cut -d',' -f1-3
  echo ""
fi

read -p "按 Enter 继续到阶段 4（可选）..."
echo ""

###############################################################################
# 阶段 4: 更新测试代码（CSV → 代码）- 可选
###############################################################################

echo "=================================================="
echo "阶段 4: 在测试代码中添加 @qase-id 注解（可选）"
echo "=================================================="
echo ""

read -p "是否要在代码中添加 @qase-id 注解? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "📝 运行: update-test-code.js"
  node "$SCRIPT_DIR/update-test-code.js"

  echo ""
  echo "✅ 阶段 4 完成"
  echo "   - 已在测试代码中添加 @qase-id 注解"
  echo "   - 原文件已备份为 .backup 文件"
  echo ""

  # 显示代码示例
  echo "📋 代码示例:"
  echo ""
  echo "   // @qase-id 12345"
  echo "   test('TC-API-SYNC-001: Test title', async () => {"
  echo "     // ..."
  echo "   })"
  echo ""
else
  echo "⏭️  跳过阶段 4"
  echo ""
fi

###############################################################################
# 总结
###############################################################################

echo "=================================================="
echo "双向同步完成！"
echo "=================================================="
echo ""

echo "📊 生成的文件:"
echo "   1. e2e/qase/qase-test-cases.csv - CSV 文件（包含 Qase ID）"
echo "   2. e2e/qase/qase-id-mapping.json - ID 映射文件"
echo "   3. *.backup - 备份文件"

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "   4. 测试代码 - 包含 @qase-id 注解"
fi

echo ""
echo "🎯 下一步建议:"
echo "   1. 查看 CSV 文件，确认 v2.id 列已填充"
echo "   2. 访问 Qase 平台，验证测试用例已创建/更新"
echo "   3. 将 CSV 文件提交到版本控制:"
echo ""
echo "      git add e2e/qase/qase-test-cases.csv"

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "      git add e2e/specs/*.spec.ts"
fi

echo "      git commit -m 'chore: sync test cases with Qase'"
echo ""

echo "💡 查询同步结果:"
echo "   node $SCRIPT_DIR/query-cases.js"
echo ""

echo "📚 更多信息:"
echo "   - 详细文档: ~/.claude/skills/qase-testops-manager/BIDIRECTIONAL_SYNC.md"
echo "   - 快速指南: ~/.claude/skills/qase-testops-manager/QUICK_START_BIDIRECTIONAL.md"
echo ""

echo "✨ 双向同步流程演示完成！"
