#!/usr/bin/env node

/**
 * 根据条件批量删除 Qase 测试用例
 *
 * 用法：
 *   node bulk-delete.js --suite "AI 功能"        # 删除指定套件中的所有测试用例
 *   node bulk-delete.js --status deprecated     # 删除指定状态的测试用例
 *   node bulk-delete.js --title-contains "TC-"  # 删除标题包含指定文本的测试用例
 *   node bulk-delete.js --ids 101,102,103       # 删除指定 ID 列表的测试用例
 *   node bulk-delete.js --suite "AI 功能" --yes # 跳过确认
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
    suite: null,
    status: null,
    titleContains: null,
    ids: [],
    skipConfirmation: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--suite' && i + 1 < args.length) {
      options.suite = args[++i];
    } else if (arg === '--status' && i + 1 < args.length) {
      options.status = args[++i];
    } else if (arg === '--title-contains' && i + 1 < args.length) {
      options.titleContains = args[++i];
    } else if (arg === '--ids' && i + 1 < args.length) {
      options.ids = args[++i].split(',').map(id => parseInt(id.trim()));
    } else if (arg === '--yes' || arg === '-y') {
      options.skipConfirmation = true;
    }
  }

  return options;
}

/**
 * 根据条件筛选测试用例
 */
function filterTestCases(testCases, options) {
  let filtered = testCases;

  // 按套件筛选
  if (options.suite) {
    filtered = filtered.filter(tc =>
      tc.suite && tc.suite.title && tc.suite.title.includes(options.suite)
    );
  }

  // 按状态筛选
  if (options.status) {
    filtered = filtered.filter(tc => tc.status === options.status);
  }

  // 按标题筛选
  if (options.titleContains) {
    filtered = filtered.filter(tc =>
      tc.title && tc.title.includes(options.titleContains)
    );
  }

  // 按 ID 列表筛选
  if (options.ids.length > 0) {
    filtered = filtered.filter(tc => options.ids.includes(tc.id));
  }

  return filtered;
}

/**
 * 显示使用帮助
 */
function showUsage() {
  console.log(`
用法：
  node bulk-delete.js [选项]

选项：
  --suite <name>          删除指定套件中的所有测试用例
  --status <status>       删除指定状态的测试用例 (actual, deprecated, draft)
  --title-contains <text> 删除标题包含指定文本的测试用例
  --ids <id1,id2,...>     删除指定 ID 列表的测试用例
  --yes, -y               跳过确认，直接删除

示例：
  node bulk-delete.js --suite "AI 功能"
  node bulk-delete.js --status deprecated
  node bulk-delete.js --title-contains "TC-API"
  node bulk-delete.js --ids 101,102,103
  node bulk-delete.js --suite "AI 功能" --yes
`);
}

/**
 * 主函数
 */
async function main() {
  const options = parseArgs();

  // 检查是否提供了任何筛选条件
  if (!options.suite && !options.status && !options.titleContains && options.ids.length === 0) {
    console.error('❌ 错误: 请至少指定一个筛选条件');
    showUsage();
    process.exit(1);
  }

  console.log('🗑️  批量删除 Qase 测试用例...\n');

  const config = loadConfig();

  // 验证 Qase 配置
  if (!config.qase || !config.qase.apiToken || !config.qase.projectCode) {
    console.error('❌ 错误: .qase-config.json 中缺少 Qase 配置');
    console.error('   请确保配置包含 qase.apiToken 和 qase.projectCode');
    process.exit(1);
  }

  // 显示筛选条件
  console.log('🔍 筛选条件:');
  if (options.suite) console.log(`   - 套件: "${options.suite}"`);
  if (options.status) console.log(`   - 状态: "${options.status}"`);
  if (options.titleContains) console.log(`   - 标题包含: "${options.titleContains}"`);
  if (options.ids.length > 0) console.log(`   - ID 列表: [${options.ids.join(', ')}]`);
  console.log('');

  // 获取所有测试用例
  const allTestCases = await getAllTestCases(config);
  console.log(`📊 Qase 中共有 ${allTestCases.length} 个测试用例\n`);

  // 筛选测试用例
  const testCasesToDelete = filterTestCases(allTestCases, options);
  console.log(`🎯 匹配到 ${testCasesToDelete.length} 个测试用例:\n`);

  if (testCasesToDelete.length === 0) {
    console.log('✅ 没有匹配的测试用例，无需删除');
    process.exit(0);
  }

  // 显示将被删除的测试用例
  testCasesToDelete.forEach((tc, index) => {
    console.log(`${index + 1}. [ID: ${tc.id}] ${tc.title}`);
  });
  console.log('');

  // 确认操作
  if (!options.skipConfirmation) {
    const confirmed = await confirmAction(`⚠️  即将删除以上 ${testCasesToDelete.length} 个测试用例，是否继续？`);
    if (!confirmed) {
      console.log('\n❌ 操作已取消');
      process.exit(0);
    }
  }

  console.log('\n🚀 开始删除...\n');

  // 删除测试用例
  let deletedCount = 0;
  for (let i = 0; i < testCasesToDelete.length; i++) {
    const tc = testCasesToDelete[i];
    process.stdout.write(`\r删除进度: ${i + 1}/${testCasesToDelete.length} - [${tc.id}] ${tc.title.substring(0, 50)}...`);

    if (await deleteFromQase(config, tc.id)) {
      deletedCount++;
    }

    // 添加延迟避免API限流
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  console.log('\n');

  // 输出结果
  console.log('\n📊 删除完成');
  console.log(`   ✅ 成功: ${deletedCount}/${testCasesToDelete.length} 个测试用例已删除`);
  if (deletedCount < testCasesToDelete.length) {
    console.log(`   ⚠️  失败: ${testCasesToDelete.length - deletedCount} 个测试用例删除失败`);
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

module.exports = { filterTestCases };
