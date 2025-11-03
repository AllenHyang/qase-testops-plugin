#!/usr/bin/env node

/**
 * 查询 Qase 测试用例
 *
 * 用法：
 *   node query-cases.js                    # 查询所有测试用例
 *   node query-cases.js --suite "AI 功能"  # 按套件筛选
 *   node query-cases.js --json             # 输出 JSON 格式
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
    }

    return allCases;
  } catch (error) {
    console.error(`❌ 获取测试用例失败: ${error.message}`);
    return [];
  }
}

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    suite: null,
    json: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--suite' && i + 1 < args.length) {
      options.suite = args[++i];
    } else if (arg === '--json') {
      options.json = true;
    }
  }

  return options;
}

/**
 * 格式化输出
 */
function formatOutput(testCases, options) {
  if (options.json) {
    console.log(JSON.stringify(testCases, null, 2));
    return;
  }

  console.log(`\n📊 找到 ${testCases.length} 个测试用例:\n`);

  if (testCases.length === 0) {
    console.log('  （无测试用例）\n');
    return;
  }

  testCases.forEach((tc, index) => {
    console.log(`${index + 1}. [ID: ${tc.id}] ${tc.title}`);
    if (tc.suite) {
      console.log(`   Suite: ${tc.suite.title || '(无套件)'}`);
    }
    if (tc.status) {
      console.log(`   Status: ${tc.status}`);
    }
    console.log('');
  });
}

/**
 * 主函数
 */
async function main() {
  console.log('🔍 查询 Qase 测试用例...\n');

  const config = loadConfig();
  const options = parseArgs();

  // 验证 Qase 配置
  if (!config.qase || !config.qase.apiToken || !config.qase.projectCode) {
    console.error('❌ 错误: .qase-config.json 中缺少 Qase 配置');
    console.error('   请确保配置包含 qase.apiToken 和 qase.projectCode');
    process.exit(1);
  }

  // 获取所有测试用例
  let testCases = await getAllTestCases(config);

  // 按套件筛选
  if (options.suite) {
    testCases = testCases.filter(tc =>
      tc.suite && tc.suite.title && tc.suite.title.includes(options.suite)
    );
    console.log(`🔎 筛选套件: "${options.suite}"\n`);
  }

  // 输出结果
  formatOutput(testCases, options);
}

// 执行
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ 查询失败:', error.message);
    process.exit(1);
  });
}

module.exports = { getAllTestCases };
