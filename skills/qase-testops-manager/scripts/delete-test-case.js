#!/usr/bin/env node

/**
 * 删除测试用例
 *
 * 支持三种模式：
 * 1. 仅从 CSV 删除
 * 2. 仅从 Qase 删除
 * 3. 同时从 CSV 和 Qase 删除（默认）
 */

const { loadConfig, qaseApiRequest } = require('../lib/qase-utils');


/**
 * 获取所有测试用例
 */
async function getAllTestCases(config) {
  try {
    const response = await qaseApiRequest(
      config,
      'GET',
      `/case/${config.qase.projectCode}`
    );
    return response.result.entities || [];
  } catch (error) {
    console.error(`❌ 获取测试用例失败: ${error.message}`);
    return [];
  }
}

/**
 * 从 Qase 删除测试用例
 */
async function deleteFromQase(config, testId) {
  try {
    // 首先找到测试用例的 Qase ID
    const allCases = await getAllTestCases(config);
    const testCase = allCases.find(tc => tc.title.startsWith(testId));

    if (!testCase) {
      console.warn(`⚠️  在 Qase 中未找到测试用例: ${testId}`);
      return false;
    }

    // 删除测试用例
    await qaseApiRequest(
      config,
      'DELETE',
      `/case/${config.qase.projectCode}/${testCase.id}`
    );

    console.log(`✅ 从 Qase 删除: ${testId} (Qase ID: ${testCase.id})`);
    return true;
  } catch (error) {
    console.error(`❌ 从 Qase 删除失败 "${testId}": ${error.message}`);
    return false;
  }
}

/**
 * 从 CSV 删除测试用例
 */
function deleteFromCSV(config, testId) {
  const csvPath = path.join(PROJECT_ROOT, config.outputDir, config.csvFileName);

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ 错误: CSV 文件不存在: ${csvPath}`);
    return false;
  }

  try {
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');

    // 找到要删除的行
    const filteredLines = lines.filter(line => {
      // 保留标题行
      if (line.startsWith('v2.id,')) {
        return true;
      }
      // 过滤掉包含指定测试ID的行
      return !line.includes(testId);
    });

    // 检查是否有行被删除
    if (filteredLines.length === lines.length) {
      console.warn(`⚠️  在 CSV 中未找到测试用例: ${testId}`);
      return false;
    }

    // 写回文件
    fs.writeFileSync(csvPath, filteredLines.join('\n'), 'utf-8');
    console.log(`✅ 从 CSV 删除: ${testId}`);
    return true;
  } catch (error) {
    console.error(`❌ 从 CSV 删除失败: ${error.message}`);
    return false;
  }
}

/**
 * 从 JSON 删除测试用例
 */
function deleteFromJSON(config, testId) {
  const jsonPath = path.join(PROJECT_ROOT, config.outputDir, config.jsonFileName);

  if (!fs.existsSync(jsonPath)) {
    return; // JSON 文件是可选的，不报错
  }

  try {
    const testCases = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const filteredCases = testCases.filter(tc => tc.id !== testId);

    if (filteredCases.length < testCases.length) {
      fs.writeFileSync(jsonPath, JSON.stringify(filteredCases, null, 2), 'utf-8');
      console.log(`✅ 从 JSON 删除: ${testId}`);
    }
  } catch (error) {
    console.warn(`⚠️  从 JSON 删除失败: ${error.message}`);
  }
}

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    testIds: [],
    mode: 'both', // 'csv', 'qase', 'both'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--csv-only') {
      options.mode = 'csv';
    } else if (arg === '--qase-only') {
      options.mode = 'qase';
    } else if (arg === '--id' && i + 1 < args.length) {
      options.testIds.push(args[++i]);
    } else if (!arg.startsWith('--')) {
      // 支持直接传入测试ID（不带 --id）
      options.testIds.push(arg);
    }
  }

  return options;
}

/**
 * 主函数
 */
async function main() {
  console.log('🗑️  删除测试用例...\n');

  const config = loadConfig();
  const options = parseArgs();

  if (options.testIds.length === 0) {
    console.error('❌ 错误: 请指定要删除的测试用例 ID');
    console.error('\n使用方法:');
    console.error('  node delete-test-case.js TC-API-001');
    console.error('  node delete-test-case.js --id TC-API-001 --id TC-API-002');
    console.error('  node delete-test-case.js TC-API-001 --csv-only');
    console.error('  node delete-test-case.js TC-API-001 --qase-only');
    process.exit(1);
  }

  console.log(`🎯 删除模式: ${options.mode === 'csv' ? '仅 CSV' : options.mode === 'qase' ? '仅 Qase' : 'CSV + Qase'}`);
  console.log(`📋 要删除的测试用例: ${options.testIds.join(', ')}\n`);

  let csvDeleted = 0;
  let qaseDeleted = 0;
  let failed = 0;

  for (const testId of options.testIds) {
    console.log(`\n处理: ${testId}`);

    let success = false;

    // 从 CSV 删除
    if (options.mode === 'csv' || options.mode === 'both') {
      if (deleteFromCSV(config, testId)) {
        deleteFromJSON(config, testId);
        csvDeleted++;
        success = true;
      }
    }

    // 从 Qase 删除
    if (options.mode === 'qase' || options.mode === 'both') {
      // 验证 Qase 配置
      if (!config.qase || !config.qase.apiToken || !config.qase.projectCode) {
        console.error('⚠️  跳过 Qase 删除: 缺少 Qase 配置');
      } else {
        if (await deleteFromQase(config, testId)) {
          qaseDeleted++;
          success = true;
        }
      }
    }

    if (!success) {
      failed++;
    }

    // 添加延迟避免API限流
    if (options.mode === 'qase' || options.mode === 'both') {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n\n📊 删除完成');
  if (csvDeleted > 0) {
    console.log(`   ✅ CSV: ${csvDeleted} 个`);
  }
  if (qaseDeleted > 0) {
    console.log(`   ✅ Qase: ${qaseDeleted} 个`);
  }
  if (failed > 0) {
    console.log(`   ❌ 失败: ${failed} 个`);
  }
  console.log('');
}

// 执行
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ 删除失败:', error.message);
    process.exit(1);
  });
}

module.exports = { deleteFromCSV, deleteFromQase };
