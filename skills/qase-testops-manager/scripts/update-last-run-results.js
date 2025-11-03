#!/usr/bin/env node

/**
 * 根据测试运行结果自动更新 Last Run Result 自定义字段
 *
 * 工作流:
 * 1. 读取 test-results/results.json (Playwright 测试结果)
 * 2. 提取测试 ID 和状态
 * 3. 映射状态：passed → PASS, failed → FAILD, skipped → NOTRUN
 * 4. 批量更新 Qase 测试用例的 Last Run Result 字段
 *
 * 使用方法:
 *   node update-last-run-results.js [--dry-run] [--results-file path/to/results.json]
 */

const fs = require('fs');
const path = require('path');
const { loadConfig, qaseApiRequest } = require('../lib/qase-utils');

const PROJECT_ROOT = process.cwd();

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    resultsFile: args.find(arg => arg.startsWith('--results-file='))?.split('=')[1] || 'test-results/results.json',
  };
}

/**
 * 读取 Playwright 测试结果
 */
function readTestResults(resultsFile) {
  const resultsPath = path.join(PROJECT_ROOT, resultsFile);

  if (!fs.existsSync(resultsPath)) {
    console.error(`❌ 错误: 找不到测试结果文件: ${resultsPath}`);
    console.error('   请先运行测试: npm run test:e2e');
    process.exit(1);
  }

  try {
    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
    return results;
  } catch (error) {
    console.error(`❌ 错误: 解析测试结果失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * 从测试标题中提取 Custom ID
 * 例如: "TC-API-SYNC-015: 完整流程验证" → "TC-API-SYNC-015"
 */
function extractCustomId(title) {
  const match = title.match(/^(TC-[A-Z]+-[A-Z]+-\d+):/);
  return match ? match[1] : null;
}

/**
 * 映射 Playwright 状态到 Qase 值
 */
function mapStatus(playwrightStatus) {
  const statusMap = {
    'passed': 'PASS',
    'failed': 'FAILD',    // 注意：用户定义的是 FAILD 不是 FAILED
    'timedOut': 'FAILD',
    'skipped': 'NOTRUN',
    'interrupted': 'INVALID',
  };

  return statusMap[playwrightStatus] || 'NOTRUN';
}

/**
 * 解析测试结果并提取 Custom ID 和状态
 */
function parseTestResults(results) {
  const testResults = [];

  if (!results.suites || !Array.isArray(results.suites)) {
    return testResults;
  }

  function traverseSuite(suite) {
    // 处理当前 suite 的测试
    if (suite.specs && Array.isArray(suite.specs)) {
      suite.specs.forEach(spec => {
        const title = spec.title;
        const customId = extractCustomId(title);

        if (customId && spec.tests && spec.tests[0]) {
          const test = spec.tests[0];
          const result = test.results && test.results[0];

          if (result) {
            const status = mapStatus(result.status);
            testResults.push({
              customId,
              title,
              status,
              playwrightStatus: result.status,
            });
          }
        }
      });
    }

    // 递归处理嵌套 suite
    if (suite.suites && Array.isArray(suite.suites)) {
      suite.suites.forEach(subsuite => traverseSuite(subsuite));
    }
  }

  results.suites.forEach(suite => traverseSuite(suite));

  return testResults;
}

/**
 * 获取所有测试用例并构建 Custom ID → Qase ID 映射
 */
async function buildCaseMapping(config) {
  const caseMap = {};
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await qaseApiRequest(
      config,
      'GET',
      `/case/${config.qase.projectCode}?limit=${limit}&offset=${offset}`
    );

    if (response.result && response.result.entities) {
      response.result.entities.forEach(testCase => {
        // 从 custom_fields 中提取 Custom ID (field ID = 1)
        if (testCase.custom_fields && Array.isArray(testCase.custom_fields)) {
          const customIdField = testCase.custom_fields.find(f => f.id === 1);
          if (customIdField && customIdField.value) {
            caseMap[customIdField.value] = testCase.id;
          }
        }
      });

      if (response.result.entities.length < limit) {
        break;
      }

      offset += limit;
    } else {
      break;
    }
  }

  return caseMap;
}

/**
 * 更新单个测试用例的 Last Run Result 字段
 */
async function updateTestCase(config, qaseId, lastRunResult) {
  const updateData = {
    custom_field: {
      '1': null, // 保持 Custom ID 不变（不更新）
      [config.qase.lastRunResultFieldId]: lastRunResult,
    },
  };

  // 注意：由于我们只想更新 Last Run Result 字段，
  // 需要先获取测试用例的完整信息，然后更新
  // 但为了避免覆盖其他字段，我们只发送 custom_field

  await qaseApiRequest(
    config,
    'PATCH',
    `/case/${config.qase.projectCode}/${qaseId}`,
    updateData
  );
}

/**
 * 批量更新测试用例
 */
async function updateTestCases(config, testResults, caseMap, dryRun) {
  console.log(`\n📊 准备更新 ${testResults.length} 个测试用例...\n`);

  const updates = [];
  const notFound = [];

  for (const testResult of testResults) {
    const qaseId = caseMap[testResult.customId];

    if (!qaseId) {
      notFound.push(testResult);
      continue;
    }

    updates.push({
      customId: testResult.customId,
      qaseId,
      status: testResult.status,
    });
  }

  // 打印预览
  if (updates.length > 0) {
    console.log('✅ 将要更新的测试用例:');
    updates.forEach(update => {
      console.log(`   ${update.customId} (Qase ID: ${update.qaseId}) → ${update.status}`);
    });
    console.log('');
  }

  if (notFound.length > 0) {
    console.log('⚠️  未找到对应 Qase 测试用例:');
    notFound.forEach(test => {
      console.log(`   ${test.customId}: ${test.title}`);
    });
    console.log('');
  }

  // 执行更新
  if (dryRun) {
    console.log('🔍 预览模式：跳过实际更新\n');
    return { updated: 0, failed: 0, notFound: notFound.length };
  }

  console.log('🚀 开始更新...\n');

  let updated = 0;
  let failed = 0;

  for (const update of updates) {
    try {
      await updateTestCase(config, update.qaseId, update.status);
      console.log(`   ✅ ${update.customId} → ${update.status}`);
      updated++;

      // 添加延迟以避免 API 速率限制
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.log(`   ❌ ${update.customId}: ${error.message}`);
      failed++;
    }
  }

  return { updated, failed, notFound: notFound.length };
}

/**
 * 主函数
 */
async function main() {
  const options = parseArgs();
  console.log('🔄 更新 Last Run Result 字段\n');

  if (options.dryRun) {
    console.log('🔍 运行模式: 预览 (不会实际更新)\n');
  }

  // 1. 加载配置
  const config = loadConfig();

  // 2. 读取测试结果
  console.log('📄 读取测试结果...');
  const results = readTestResults(options.resultsFile);
  console.log(`   ✅ 找到测试结果文件\n`);

  // 3. 解析测试结果
  console.log('🔍 解析测试结果...');
  const testResults = parseTestResults(results);
  console.log(`   ✅ 解析了 ${testResults.length} 个测试\n`);

  if (testResults.length === 0) {
    console.log('⚠️  未找到任何带有 Custom ID 的测试');
    console.log('   请确保测试标题格式为: TC-XXX-XXX-XXX: ...\n');
    process.exit(0);
  }

  // 4. 构建 Custom ID → Qase ID 映射
  console.log('📋 构建测试用例映射...');
  const caseMap = await buildCaseMapping(config);
  console.log(`   ✅ 找到 ${Object.keys(caseMap).length} 个 Qase 测试用例\n`);

  // 5. 更新测试用例
  const stats = await updateTestCases(config, testResults, caseMap, options.dryRun);

  // 6. 打印总结
  console.log('================================================================================');
  console.log('📊 更新总结');
  console.log('================================================================================\n');

  if (options.dryRun) {
    console.log(`   🔍 预览模式: ${stats.updated + stats.failed} 个测试用例将被更新`);
  } else {
    console.log(`   ✅ 成功更新: ${stats.updated} 个`);
    console.log(`   ❌ 更新失败: ${stats.failed} 个`);
  }
  console.log(`   ⚠️  未找到: ${stats.notFound} 个\n`);

  if (stats.notFound > 0) {
    console.log('💡 提示: 未找到的测试用例可能尚未同步到 Qase');
    console.log('   运行: node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js\n');
  }

  process.exit(stats.failed > 0 ? 1 : 0);
}

// 执行
if (require.main === module) {
  main().catch(err => {
    console.error('❌ 错误:', err.message);
    process.exit(1);
  });
}

module.exports = { parseTestResults, mapStatus, updateTestCase };
