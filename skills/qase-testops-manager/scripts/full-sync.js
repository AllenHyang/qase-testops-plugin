#!/usr/bin/env node

/**
 * Qase 完整同步流水线（Code First 架构 + 前置检验）
 *
 * 数据流向：代码（唯一真实来源）→ CSV（记录/审计）→ Qase → 代码（回写 ID）→ CSV（最终快照）
 *
 * 执行步骤：
 * 0. review-test-standards.js - 前置检验：检查测试代码是否符合规范
 *    - Custom ID 格式 (TC-{LAYER}-{MODULE}-{NUMBER})
 *    - import { qase } 声明
 *    - qase.id() 注解
 *    - test.describe() 嵌套（强烈推荐，用于定义 Suite 层级）
 *    - test.step() 使用（推荐）
 *    - JSDoc 注释 (@description, @preconditions, @postconditions)
 * 1. generate-csv.js - 从代码扫描测试用例并生成 CSV（记录快照，用于版本控制）
 * 2. sync-to-qase.js - 从代码扫描并同步到 Qase（创建/更新 suite + test cases）
 * 3. sync-from-qase.js - 从 Qase 获取分配的 ID，回写到 CSV
 * 4. update-qase-annotations.js - 回写 qase.id() 到代码
 * 5. review-test-standards.js - 后置检验：验证同步结果正确性
 *
 * 关键原则：
 * - Code First: test.describe() 嵌套定义 Suite 层级（不使用 qase.suite()）
 * - 代码是唯一数据源（Custom ID, Suite 路径, 测试步骤, JSDoc 描述）
 * - 前置检验确保代码质量（防止不符合规范的代码进入 Qase）
 * - CSV 用于记录/审计和版本控制（Git diff, PR review）
 * - 后置检验确保同步完整性
 *
 * 使用示例：
 * node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js
 * node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js --force       # 强制同步，忽略检验失败
 * node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js --skip-review # 跳过前置检验
 *
 * 选项：
 * --skip-update   跳过代码回写（不更新 qase.id()）
 * --update-only   只更新 CSV（适用于小改动，跳过 Qase 同步）
 * --debug         保存 JSON 文件用于调试
 * --skip-review   跳过前置检验（不推荐）
 * --force         强制同步，忽略前置检验失败（不推荐）
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SKILL_DIR = path.dirname(__dirname);
const SCRIPT_DIR = path.join(SKILL_DIR, 'scripts');

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    skipUpdate: args.includes('--skip-update'),
    updateOnly: args.includes('--update-only'),
    debug: args.includes('--debug'),
    skipReview: args.includes('--skip-review'),
    force: args.includes('--force'),
  };
}

/**
 * 执行命令并输出
 */
function runCommand(command, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📌 ${description}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    execSync(command, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    console.log(`\n✅ ${description} - 完成`);
    return true;
  } catch (error) {
    console.error(`\n❌ ${description} - 失败`);
    console.error(error.message);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  const options = parseArgs();

  console.log('🚀 开始 Qase 完整同步流水线\n');
  console.log(`配置:`);
  console.log(`  - 跳过代码更新: ${options.skipUpdate ? '是' : '否'}`);
  console.log(`  - 仅更新 CSV: ${options.updateOnly ? '是' : '否'}`);
  console.log(`  - Debug 模式: ${options.debug ? '是（保存 JSON）' : '否'}`);
  console.log(`  - 跳过规范检查: ${options.skipReview ? '是' : '否'}`);
  console.log(`  - 强制同步: ${options.force ? '是（忽略检查失败）' : '否'}`);
  console.log();

  const startTime = Date.now();

  // 步骤 0: 前置检验 - 检查测试代码是否符合规范
  if (!options.skipReview) {
    console.log('\n' + '='.repeat(60));
    console.log('📋 Step 0/5: 前置检验 - 检查测试代码规范');
    console.log('='.repeat(60));
    console.log('检查项:');
    console.log('  ✓ Custom ID 格式 (TC-{LAYER}-{MODULE}-{NUMBER})');
    console.log('  ✓ import { qase } 声明');
    console.log('  ✓ qase.id() 注解');
    console.log('  ✓ test.describe() 嵌套 (强烈推荐，用于定义 Suite 层级)');
    console.log('  ✓ test.step() 使用 (推荐)');
    console.log('  ✓ JSDoc 注释 (@description, @preconditions, @postconditions)');
    console.log();

    const reviewResult = runCommand(
      `node "${path.join(SCRIPT_DIR, 'review-test-standards.js')}"`,
      '执行规范检查'
    );

    if (!reviewResult) {
      console.error('\n❌ 前置检验失败 - 测试代码不符合规范');

      if (!options.force) {
        console.error('\n💡 解决方案:');
        console.error('   1. 根据上述检查结果修复代码问题');
        console.error('   2. 或使用 --force 强制同步（不推荐）');
        console.error('   3. 或使用 --skip-review 跳过检查（不推荐）');
        console.error('\n⚠️  建议: 先修复规范问题，确保代码质量！');
        process.exit(1);
      } else {
        console.warn('\n⚠️  强制继续同步（--force），但建议稍后修复规范问题');
      }
    } else {
      console.log('\n✅ 前置检验通过 - 代码符合规范');
    }
  } else {
    console.log('\n⏭️  跳过前置检验（--skip-review）');
  }

  // 步骤 1: 生成 CSV（内部会从代码提取测试用例）
  let generateCsvArgs = options.updateOnly ? '--update' : '';
  if (options.debug) {
    generateCsvArgs += ' --debug';
  }
  if (!runCommand(
    `node "${path.join(SCRIPT_DIR, 'generate-csv.js')}" ${generateCsvArgs}`.trim(),
    'Step 1/5: 从代码提取测试用例并生成 CSV'
  )) {
    console.error('\n❌ 流水线中断');
    process.exit(1);
  }

  // 如果是只更新 CSV，这里就结束
  if (options.updateOnly) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(60));
    console.log('✅ CSV 更新完成');
    console.log(`⏱️  耗时: ${elapsed}s`);
    console.log('='.repeat(60));
    return;
  }

  // 步骤 2: 同步到 Qase
  if (!runCommand(
    `node "${path.join(SCRIPT_DIR, 'sync-to-qase.js')}"`,
    'Step 2/5: 同步到 Qase Repository'
  )) {
    console.error('\n❌ 流水线中断');
    process.exit(1);
  }

  // 步骤 3: 回写 Qase ID
  if (!runCommand(
    `node "${path.join(SCRIPT_DIR, 'sync-from-qase.js')}"`,
    'Step 3/5: 回写 Qase ID 到 CSV'
  )) {
    console.error('\n❌ 流水线中断');
    process.exit(1);
  }

  // 步骤 4: 更新代码注解
  if (!options.skipUpdate) {
    if (!runCommand(
      `node "${path.join(SCRIPT_DIR, 'update-qase-annotations.js')}"`,
      'Step 4/5: 更新测试代码中的 qase.id()'
    )) {
      console.error('\n⚠️  代码更新失败，但同步已完成');
      console.error('   你可以稍后手动运行: node ~/.claude/skills/qase-testops-manager/scripts/update-qase-annotations.js');
    }
  } else {
    console.log('\n⏭️  跳过代码更新步骤（--skip-update）');
  }

  // 步骤 5: 后置检验（可选） - 验证同步结果
  console.log('\n' + '='.repeat(60));
  console.log('📋 Step 5/5: 后置检验 - 验证同步结果');
  console.log('='.repeat(60));
  console.log('验证项:');
  console.log('  ✓ 所有测试用例都有 qase.id()');
  console.log('  ✓ CSV 包含完整数据');
  console.log('  ✓ Custom ID 与 Qase ID 正确映射');

  if (runCommand(
    `node "${path.join(SCRIPT_DIR, 'review-test-standards.js')}"`,
    '执行后置检验'
  )) {
    console.log('\n✅ 后置检验通过 - 同步结果正确');
  } else {
    console.warn('\n⚠️  后置检验发现问题，请检查上述输出');
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('✅ 完整同步流水线执行完成（Code First）');
  console.log(`⏱️  总耗时: ${elapsed}s`);
  console.log('='.repeat(60));
  console.log('\n📋 数据流向:');
  console.log('   代码（唯一真实来源）→ Qase → 代码（qase.id()）→ CSV（最终快照）');
  console.log('\n📋 下一步:');
  console.log('   1. 检查代码：测试文件中的 qase.id() 和 qase.suite() 已更新');
  console.log('   2. 检查 CSV：e2e/qase/qase-test-cases.csv 包含完整数据');
  console.log('   3. 提交代码：git add e2e/specs/*.spec.ts e2e/qase/qase-test-cases.csv');
  console.log('   4. 运行测试验证: npm run test:e2e:smoke');
  console.log();
}

// 执行
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ 流水线执行失败:', error.message);
    process.exit(1);
  });
}

module.exports = { main };
