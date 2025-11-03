#!/usr/bin/env node

/**
 * 比对本地测试用例与 Qase Repository 的差异
 *
 * 功能：
 * 1. 检测只在本地存在的测试（需要同步到 Qase）
 * 2. 检测只在 Qase 存在的测试（可能已删除或遗漏）
 * 3. 检测内容不一致的测试（标题、描述、步骤等）
 * 4. 提供详细的差异报告
 * 5. 支持指定单个测试用例的详细对比（--case TC-XXX-XXX-XXX）
 *
 * 使用方法：
 *   全局对比：node compare-with-qase.js
 *   单个测试用例对比：node compare-with-qase.js --case TC-API-SYNC-015
 */

const fs = require('fs');
const path = require('path');
const { loadConfig, qaseApiRequest } = require('../lib/qase-utils');

const PROJECT_ROOT = process.cwd();


/**
 * 获取 Qase 中的所有测试用例
 */
async function getQaseCases(config) {
  const cases = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await qaseApiRequest(
      config,
      'GET',
      `/case/${config.qase.projectCode}?limit=${limit}&offset=${offset}`
    );

    if (response.result && response.result.entities) {
      cases.push(...response.result.entities);

      if (response.result.entities.length < limit) {
        break;
      }

      offset += limit;
    } else {
      break;
    }
  }

  // 构建映射：custom_id -> case
  // Qase API 中 custom_fields 格式：[{ id: 1, value: "TC-XXX-XXX-001" }]
  const caseMap = {};
  cases.forEach(c => {
    if (c.custom_fields && Array.isArray(c.custom_fields)) {
      // 通常 custom_id 存储在 id=1 的字段中
      const customIdField = c.custom_fields.find(f => f.id === 1);
      if (customIdField && customIdField.value) {
        caseMap[customIdField.value] = c;
      }
    }
  });

  return { cases, caseMap };
}

/**
 * 读取本地 CSV 文件
 */
function readLocalCases(config) {
  const csvPath = path.join(PROJECT_ROOT, config.outputDir, config.csvFileName);

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ 错误: 找不到 CSV 文件: ${csvPath}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  });

  // 过滤出实际的测试用例（有 custom_id 的行）
  const testCases = records.filter(r => r.custom_id && r.custom_id.trim());

  // 构建映射
  const caseMap = {};
  testCases.forEach(tc => {
    caseMap[tc.custom_id] = tc;
  });

  return { testCases, caseMap };
}

/**
 * 比较两个测试用例的内容（增强版）
 */
function compareTestCase(local, qase, detailed = false) {
  const differences = [];

  // 比较标题
  const localTitle = local.title || '';
  const qaseTitle = qase.title || '';
  if (localTitle !== qaseTitle) {
    differences.push({
      field: 'title',
      label: '标题',
      local: localTitle,
      qase: qaseTitle,
    });
  }

  // 比较描述
  const localDesc = local.description || '';
  const qaseDesc = qase.description || '';
  if (localDesc !== qaseDesc) {
    differences.push({
      field: 'description',
      label: '描述',
      local: localDesc,
      qase: qaseDesc,
    });
  }

  // 比较前置条件
  const localPre = local.preconditions || '';
  const qasePre = qase.preconditions || '';
  if (localPre !== qasePre) {
    differences.push({
      field: 'preconditions',
      label: '前置条件',
      local: localPre,
      qase: qasePre,
    });
  }

  // 比较后置条件
  const localPost = local.postconditions || '';
  const qasePost = qase.postconditions || '';
  if (localPost !== qasePost) {
    differences.push({
      field: 'postconditions',
      label: '后置条件',
      local: localPost,
      qase: qasePost,
    });
  }

  // 比较步骤（详细模式下逐步对比）
  const localSteps = (local.steps_actions || '').split('\n').filter(s => s.trim());
  const localExpected = (local.steps_expected || '').split('\n').filter(s => s.trim());
  const qaseSteps = (qase.steps || []).map(s => s.action || '');
  const qaseExpected = (qase.steps || []).map(s => s.expected_result || '');

  if (detailed) {
    // 详细对比每个步骤
    const maxSteps = Math.max(localSteps.length, qaseSteps.length);
    const stepDifferences = [];

    for (let i = 0; i < maxSteps; i++) {
      const localStep = localSteps[i] || '';
      const qaseStep = qaseSteps[i] || '';
      const localExp = localExpected[i] || '';
      const qaseExp = qaseExpected[i] || '';

      if (localStep !== qaseStep || localExp !== qaseExp) {
        stepDifferences.push({
          stepIndex: i + 1,
          action: {
            local: localStep,
            qase: qaseStep,
            different: localStep !== qaseStep,
          },
          expected: {
            local: localExp,
            qase: qaseExp,
            different: localExp !== qaseExp,
          },
        });
      }
    }

    if (stepDifferences.length > 0) {
      differences.push({
        field: 'steps',
        label: '测试步骤',
        stepDifferences,
      });
    }
  } else {
    // 简化对比：只比较步骤数量
    if (localSteps.length !== qaseSteps.length) {
      differences.push({
        field: 'steps_count',
        label: '步骤数量',
        local: `${localSteps.length} 步`,
        qase: `${qaseSteps.length} 步`,
      });
    }
  }

  return differences;
}

/**
 * 打印单个测试用例的详细对比
 */
function printDetailedComparison(customId, local, qase, differences) {
  console.log('================================================================================');
  console.log(`🔍 测试用例详细对比: ${customId}`);
  console.log('================================================================================\n');

  // 基本信息
  console.log('📋 基本信息:');
  console.log(`   Custom ID: ${customId}`);
  if (qase) {
    console.log(`   Qase ID: ${qase.id}`);
    console.log(`   Qase 链接: https://app.qase.io/case/${qase.id}`);
  }
  console.log('');

  // 如果只在本地存在
  if (!qase) {
    console.log('❌ 状态: 测试用例仅在本地存在，未同步到 Qase\n');
    console.log('📄 本地内容:');
    console.log(`   标题: ${local.title || '(无)'}`);
    console.log(`   描述: ${local.description || '(无)'}`);
    console.log(`   前置条件: ${local.preconditions || '(无)'}`);
    console.log(`   后置条件: ${local.postconditions || '(无)'}`);

    const steps = (local.steps_actions || '').split('\n').filter(s => s.trim());
    console.log(`   步骤数量: ${steps.length}`);
    if (steps.length > 0) {
      console.log('   步骤详情:');
      steps.forEach((step, i) => {
        console.log(`      ${i + 1}. ${step}`);
      });
    }
    console.log('');
    console.log('💡 建议: 运行 full-sync.js 同步此测试用例到 Qase');
    return;
  }

  // 如果只在 Qase 存在
  if (!local) {
    console.log('☁️  状态: 测试用例仅在 Qase 存在，本地未找到\n');
    console.log('📄 Qase 内容:');
    console.log(`   标题: ${qase.title || '(无)'}`);
    console.log(`   描述: ${qase.description || '(无)'}`);
    console.log(`   前置条件: ${qase.preconditions || '(无)'}`);
    console.log(`   后置条件: ${qase.postconditions || '(无)'}`);

    const steps = qase.steps || [];
    console.log(`   步骤数量: ${steps.length}`);
    if (steps.length > 0) {
      console.log('   步骤详情:');
      steps.forEach((step, i) => {
        console.log(`      ${i + 1}. ${step.action || '(无)'}`);
        if (step.expected_result) {
          console.log(`         期望: ${step.expected_result}`);
        }
      });
    }
    console.log('');
    console.log('💡 建议: 检查是否需要在本地代码中补充此测试用例，或从 Qase 删除');
    return;
  }

  // 对比状态
  if (differences.length === 0) {
    console.log('✅ 状态: 本地与 Qase 完全一致\n');
  } else {
    console.log(`⚠️  状态: 发现 ${differences.length} 个字段存在差异\n`);
  }

  // 详细差异对比
  if (differences.length > 0) {
    console.log('================================================================================');
    console.log('🔎 差异详情');
    console.log('================================================================================\n');

    differences.forEach((diff, index) => {
      console.log(`${index + 1}. ${diff.label || diff.field}:`);

      if (diff.field === 'steps' && diff.stepDifferences) {
        // 步骤级别对比
        console.log(`   差异步骤数: ${diff.stepDifferences.length}\n`);

        diff.stepDifferences.forEach(stepDiff => {
          console.log(`   步骤 ${stepDiff.stepIndex}:`);

          if (stepDiff.action.different) {
            console.log('      操作 (Action):');
            console.log(`         本地: ${stepDiff.action.local || '(空)'}`);
            console.log(`         Qase: ${stepDiff.action.qase || '(空)'}`);
          }

          if (stepDiff.expected.different) {
            console.log('      期望结果 (Expected):');
            console.log(`         本地: ${stepDiff.expected.local || '(空)'}`);
            console.log(`         Qase: ${stepDiff.expected.qase || '(空)'}`);
          }
          console.log('');
        });
      } else {
        // 普通字段对比
        console.log(`   本地: ${diff.local || '(空)'}`);
        console.log(`   Qase: ${diff.qase || '(空)'}`);
        console.log('');
      }
    });
  }

  // 建议操作
  console.log('================================================================================');
  console.log('💡 建议操作');
  console.log('================================================================================\n');

  if (differences.length > 0) {
    console.log('同步本地更改到 Qase:');
    console.log('   node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js\n');
    console.log('或者只同步此测试用例:');
    console.log('   node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js\n');
  } else {
    console.log('✅ 本地与 Qase 完全同步，无需操作！\n');
  }
}

/**
 * 主函数
 */
async function main() {
  const options = parseArgs();
  const config = loadConfig();

  // 单个测试用例对比模式
  if (options.singleCase) {
    console.log(`🔍 对比单个测试用例: ${options.singleCase}\n`);

    // 读取本地测试用例
    console.log('📄 读取本地测试用例...');
    const { caseMap: localMap } = readLocalCases(config);

    // 读取 Qase 测试用例
    console.log('☁️  读取 Qase Repository 测试用例...');
    const { caseMap: qaseMap } = await getQaseCases(config);
    console.log('');

    // 查找指定的测试用例
    const local = localMap[options.singleCase];
    const qase = qaseMap[options.singleCase];

    if (!local && !qase) {
      console.error(`❌ 错误: 未找到测试用例 ${options.singleCase}`);
      console.error('   请检查 Custom ID 是否正确\n');
      process.exit(1);
    }

    // 对比测试用例（详细模式）
    const differences = local && qase ? compareTestCase(local, qase, true) : [];

    // 打印详细对比
    printDetailedComparison(options.singleCase, local, qase, differences);

    // 退出码：有差异或只在一方存在则返回 1
    const hasIssues = !local || !qase || differences.length > 0;
    process.exit(hasIssues ? 1 : 0);
  }

  // 全局对比模式
  console.log('🔍 开始比对本地测试用例与 Qase Repository...\n');

  // 1. 读取本地测试用例
  console.log('📄 读取本地测试用例...');
  const { testCases: localCases, caseMap: localMap } = readLocalCases(config);
  console.log(`   ✅ 找到 ${localCases.length} 个本地测试用例\n`);

  // 2. 读取 Qase 测试用例
  console.log('☁️  读取 Qase Repository 测试用例...');
  const { cases: qaseCases, caseMap: qaseMap } = await getQaseCases(config);
  console.log(`   ✅ 找到 ${qaseCases.length} 个 Qase 测试用例\n`);

  // 3. 比对差异
  console.log('🔎 分析差异...\n');

  const onlyLocal = [];
  const onlyQase = [];
  const different = [];
  const identical = [];

  // 检查本地测试用例
  for (const customId in localMap) {
    if (!qaseMap[customId]) {
      onlyLocal.push({ customId, data: localMap[customId] });
    } else {
      const differences = compareTestCase(localMap[customId], qaseMap[customId]);
      if (differences.length > 0) {
        different.push({
          customId,
          local: localMap[customId],
          qase: qaseMap[customId],
          differences,
        });
      } else {
        identical.push(customId);
      }
    }
  }

  // 检查只在 Qase 的测试用例
  for (const customId in qaseMap) {
    if (!localMap[customId]) {
      onlyQase.push({ customId, data: qaseMap[customId] });
    }
  }

  // 4. 输出报告
  console.log('================================================================================');
  console.log('📊 差异报告');
  console.log('================================================================================\n');

  console.log('📈 统计概览:');
  console.log(`   ✅ 完全一致: ${identical.length} 个`);
  console.log(`   ⚠️  内容不同: ${different.length} 个`);
  console.log(`   📍 仅本地存在: ${onlyLocal.length} 个`);
  console.log(`   ☁️  仅 Qase 存在: ${onlyQase.length} 个\n`);

  // 详细报告：仅本地存在
  if (onlyLocal.length > 0) {
    console.log('================================================================================');
    console.log('📍 仅在本地存在的测试（需要同步到 Qase）');
    console.log('================================================================================\n');
    onlyLocal.forEach(({ customId, data }) => {
      console.log(`❌ ${customId}: ${data.title || '(无标题)'}`);
    });
    console.log('');
  }

  // 详细报告：仅 Qase 存在
  if (onlyQase.length > 0) {
    console.log('================================================================================');
    console.log('☁️  仅在 Qase 存在的测试（可能已删除或遗漏）');
    console.log('================================================================================\n');
    onlyQase.forEach(({ customId, data }) => {
      console.log(`⚠️  ${customId}: ${data.title || '(无标题)'} (Qase ID: ${data.id})`);
    });
    console.log('');
  }

  // 详细报告：内容不同
  if (different.length > 0) {
    console.log('================================================================================');
    console.log('⚠️  内容不一致的测试');
    console.log('================================================================================\n');

    different.forEach(({ customId, local, qase, differences }, index) => {
      console.log(`${index + 1}. ${customId}: ${local.title || '(无标题)'}`);
      console.log(`   Qase ID: ${qase.id}`);
      console.log(`   差异字段 (${differences.length} 个):`);

      differences.forEach(diff => {
        console.log(`
   📝 ${diff.field}:`);
        console.log(`      本地: ${truncate(diff.local, 80)}`);
        console.log(`      Qase: ${truncate(diff.qase, 80)}`);
      });
      console.log('');
    });
  }

  // 5. 建议操作
  console.log('================================================================================');
  console.log('💡 建议操作');
  console.log('================================================================================\n');

  if (onlyLocal.length > 0) {
    console.log(`📍 同步 ${onlyLocal.length} 个仅在本地的测试到 Qase:`);
    console.log('   node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js\n');
  }

  if (different.length > 0) {
    console.log(`⚠️  更新 ${different.length} 个内容不一致的测试:`);
    console.log('   node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js\n');
  }

  if (onlyQase.length > 0) {
    console.log(`☁️  ${onlyQase.length} 个测试仅在 Qase 存在，请检查是否需要:`);
    console.log('   - 在本地代码中补充这些测试');
    console.log('   - 或从 Qase 删除这些过时的测试\n');
  }

  if (identical.length === localCases.length && onlyQase.length === 0) {
    console.log('✅ 本地与 Qase 完全同步，无需操作！\n');
  }

  // 6. 退出码
  const hasIssues = onlyLocal.length > 0 || onlyQase.length > 0 || different.length > 0;
  process.exit(hasIssues ? 1 : 0);
}

/**
 * 截断长文本
 */
function truncate(text, maxLength) {
  if (!text) return '(空)';
  text = text.replace(/\n/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// 执行
if (require.main === module) {
  main().catch(err => {
    console.error('❌ 错误:', err.message);
    process.exit(1);
  });
}

module.exports = { compareTestCase, readLocalCases, getQaseCases };
