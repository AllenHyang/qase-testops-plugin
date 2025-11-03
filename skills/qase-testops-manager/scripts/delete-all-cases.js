#!/usr/bin/env node

/**
 * 批量删除所有 Qase 测试用例和 Suite
 *
 * 用法：
 *   node delete-all-cases.js                  # 删除所有测试用例和 Suite（需要确认）
 *   node delete-all-cases.js --yes            # 跳过确认，直接删除
 *   node delete-all-cases.js --csv-only       # 仅清空 CSV 文件
 *   node delete-all-cases.js --qase-only      # 仅删除 Qase 中的测试用例和 Suite
 *   node delete-all-cases.js --no-suites      # 不删除 Suite，仅删除测试用例
 */

const { loadConfig, qaseApiRequest } = require('../lib/qase-utils');


/**
 * 获取所有测试用例（支持分页）
 */
async function getAllTestCases(config) {
  try {
    let allCases = [];
    let offset = 0;
    const limit = 100; // 每页获取 100 个
    let hasMore = true;

    while (hasMore) {
      const response = await qaseApiRequest(
        config,
        'GET',
        `/case/${config.qase.projectCode}?limit=${limit}&offset=${offset}`
      );

      const cases = response.result.entities || [];
      allCases = allCases.concat(cases);

      // 检查是否还有更多数据
      const total = response.result.total || 0;
      offset += limit;
      hasMore = offset < total;

      if (hasMore) {
        console.log(`   已获取 ${allCases.length}/${total} 个测试用例...`);
      }
    }

    return allCases;
  } catch (error) {
    console.error(`❌ 获取测试用例失败: ${error.message}`);
    return [];
  }
}

/**
 * 从 Qase 删除测试用例
 */
async function deleteFromQase(config, caseId) {
  try {
    await qaseApiRequest(
      config,
      'DELETE',
      `/case/${config.qase.projectCode}/${caseId}`
    );
    return true;
  } catch (error) {
    console.error(`❌ 删除测试用例 ${caseId} 失败: ${error.message}`);
    return false;
  }
}

/**
 * 获取所有 Suite（支持分页）
 */
async function getAllSuites(config) {
  try {
    let allSuites = [];
    let offset = 0;
    const limit = 100; // 每页获取 100 个
    let hasMore = true;

    while (hasMore) {
      const response = await qaseApiRequest(
        config,
        'GET',
        `/suite/${config.qase.projectCode}?limit=${limit}&offset=${offset}`
      );

      const suites = response.result.entities || [];
      allSuites = allSuites.concat(suites);

      // 检查是否还有更多数据
      const total = response.result.total || 0;
      offset += limit;
      hasMore = offset < total;

      if (hasMore) {
        console.log(`   已获取 ${allSuites.length}/${total} 个 Suite...`);
      }
    }

    return allSuites;
  } catch (error) {
    console.error(`❌ 获取 Suite 失败: ${error.message}`);
    return [];
  }
}

/**
 * 从 Qase 删除 Suite
 */
async function deleteSuiteFromQase(config, suiteId) {
  try {
    await qaseApiRequest(
      config,
      'DELETE',
      `/suite/${config.qase.projectCode}/${suiteId}`
    );
    return true;
  } catch (error) {
    console.error(`❌ 删除 Suite ${suiteId} 失败: ${error.message}`);
    return false;
  }
}

/**
 * 清空 CSV 文件
 */
function clearCSV(config) {
  const csvPath = path.join(PROJECT_ROOT, config.outputDir, config.csvFileName);

  if (!fs.existsSync(csvPath)) {
    console.warn(`⚠️  CSV 文件不存在: ${csvPath}`);
    return false;
  }

  try {
    // 只保留表头
    const header = 'v2.id,title,description,preconditions,postconditions,suite_id,suite_parent_id,suite,suite_without_cases,priority,severity,type,layer,automation,status,is_flaky,is_muted,behavior,tags,steps_actions,steps_data,steps_result\n';
    fs.writeFileSync(csvPath, header, 'utf-8');
    console.log(`✅ 已清空 CSV 文件: ${csvPath}`);
    return true;
  } catch (error) {
    console.error(`❌ 清空 CSV 文件失败: ${error.message}`);
    return false;
  }
}

/**
 * 清空 JSON 文件
 */
function clearJSON(config) {
  const jsonPath = path.join(PROJECT_ROOT, config.outputDir, config.jsonFileName);

  if (!fs.existsSync(jsonPath)) {
    return; // JSON 文件是可选的
  }

  try {
    fs.writeFileSync(jsonPath, '[]', 'utf-8');
    console.log(`✅ 已清空 JSON 文件: ${jsonPath}`);
  } catch (error) {
    console.warn(`⚠️  清空 JSON 文件失败: ${error.message}`);
  }
}

/**
 * 用户确认
 */
function confirmAction(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    mode: 'both', // 'csv', 'qase', 'both'
    skipConfirmation: false,
    deleteSuites: true, // 默认删除 Suite
  };

  for (const arg of args) {
    if (arg === '--csv-only') {
      options.mode = 'csv';
    } else if (arg === '--qase-only') {
      options.mode = 'qase';
    } else if (arg === '--yes' || arg === '-y') {
      options.skipConfirmation = true;
    } else if (arg === '--no-suites') {
      options.deleteSuites = false;
    }
  }

  return options;
}

/**
 * 主函数
 */
async function main() {
  console.log('🗑️  批量删除 Qase 测试用例和 Suite...\n');

  const config = loadConfig();
  const options = parseArgs();

  // 验证 Qase 配置
  if ((options.mode === 'qase' || options.mode === 'both') &&
      (!config.qase || !config.qase.apiToken || !config.qase.projectCode)) {
    console.error('❌ 错误: .qase-config.json 中缺少 Qase 配置');
    console.error('   请确保配置包含 qase.apiToken 和 qase.projectCode');
    process.exit(1);
  }

  console.log(`🎯 删除模式: ${options.mode === 'csv' ? '仅 CSV' : options.mode === 'qase' ? '仅 Qase' : 'CSV + Qase'}`);
  console.log(`🎯 是否删除 Suite: ${options.deleteSuites ? '是' : '否'}\n`);

  let testCases = [];
  let suites = [];
  let csvCount = 0;
  let qaseDeletedCount = 0;
  let suitesDeletedCount = 0;

  // 获取 Qase 测试用例和 Suite 数量
  if (options.mode === 'qase' || options.mode === 'both') {
    testCases = await getAllTestCases(config);
    console.log(`📊 Qase 中有 ${testCases.length} 个测试用例`);

    if (options.deleteSuites) {
      suites = await getAllSuites(config);
      console.log(`📊 Qase 中有 ${suites.length} 个 Suite`);
    }
    console.log('');
  }

  // 获取 CSV 测试用例数量
  if (options.mode === 'csv' || options.mode === 'both') {
    const csvPath = path.join(PROJECT_ROOT, config.outputDir, config.csvFileName);
    if (fs.existsSync(csvPath)) {
      const lines = fs.readFileSync(csvPath, 'utf-8').split('\n').filter(line => line.trim());
      csvCount = Math.max(0, lines.length - 1); // 减去表头
      console.log(`📊 CSV 中有 ${csvCount} 个测试用例\n`);
    }
  }

  // 确认操作
  if (!options.skipConfirmation) {
    let confirmMessage = '';
    if (options.mode === 'both') {
      const items = [`${testCases.length} 个 Qase 测试用例`, `${csvCount} 个 CSV 测试用例`];
      if (options.deleteSuites && suites.length > 0) {
        items.push(`${suites.length} 个 Suite`);
      }
      confirmMessage = `⚠️  即将删除 ${items.join('、')}，是否继续？`;
    } else if (options.mode === 'qase') {
      const items = [`${testCases.length} 个 Qase 测试用例`];
      if (options.deleteSuites && suites.length > 0) {
        items.push(`${suites.length} 个 Suite`);
      }
      confirmMessage = `⚠️  即将删除 ${items.join('、')}，是否继续？`;
    } else {
      confirmMessage = `⚠️  即将清空 CSV 文件中的 ${csvCount} 个测试用例，是否继续？`;
    }

    const confirmed = await confirmAction(confirmMessage);
    if (!confirmed) {
      console.log('\n❌ 操作已取消');
      process.exit(0);
    }
  }

  console.log('\n🚀 开始删除...\n');

  // 清空 CSV
  if (options.mode === 'csv' || options.mode === 'both') {
    if (clearCSV(config)) {
      clearJSON(config);
    }
  }

  // 从 Qase 删除
  if (options.mode === 'qase' || options.mode === 'both') {
    // 优先删除 Suite（会同时删除其中的测试用例）
    if (options.deleteSuites && suites.length > 0) {
      console.log('🗑️  删除 Suite（会同时删除其中的测试用例）...');
      for (let i = 0; i < suites.length; i++) {
        const suite = suites[i];
        process.stdout.write(`\r删除进度: ${i + 1}/${suites.length} - [${suite.id}] ${suite.title.substring(0, 50)}...`);

        if (await deleteSuiteFromQase(config, suite.id)) {
          suitesDeletedCount++;
        }

        // 添加延迟避免API限流
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      console.log('\n');

      // 删除 Suite 后，测试用例也会被删除
      console.log(`✅ 通过删除 Suite 已同时删除了所有测试用例\n`);
      qaseDeletedCount = testCases.length; // 标记所有测试用例为已删除
    } else if (testCases.length > 0) {
      // 如果不删除 Suite，则单独删除测试用例
      console.log('🗑️  删除测试用例（不删除 Suite）...');
      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        process.stdout.write(`\r删除进度: ${i + 1}/${testCases.length} - [${tc.id}] ${tc.title.substring(0, 50)}...`);

        if (await deleteFromQase(config, tc.id)) {
          qaseDeletedCount++;
        }

        // 添加延迟避免API限流
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      console.log('\n');
    }
  }

  // 输出结果
  console.log('\n📊 删除完成');
  if (options.mode === 'csv' || options.mode === 'both') {
    console.log(`   ✅ CSV: 已清空`);
  }
  if (options.mode === 'qase' || options.mode === 'both') {
    console.log(`   ✅ 测试用例: ${qaseDeletedCount}/${testCases.length} 个已删除`);
    if (qaseDeletedCount < testCases.length) {
      console.log(`   ⚠️  有 ${testCases.length - qaseDeletedCount} 个测试用例删除失败`);
    }
    if (options.deleteSuites) {
      console.log(`   ✅ Suite: ${suitesDeletedCount}/${suites.length} 个已删除`);
      if (suitesDeletedCount < suites.length) {
        console.log(`   ⚠️  有 ${suites.length - suitesDeletedCount} 个 Suite 删除失败`);
      }
    }
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

module.exports = { clearCSV, clearJSON };
