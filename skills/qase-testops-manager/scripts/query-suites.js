#!/usr/bin/env node

/**
 * 查询 Qase Suites
 *
 * 用法：
 *   node query-suites.js                    # 查询所有 Suite
 *   node query-suites.js --json             # 输出 JSON 格式
 */

const { loadConfig, qaseApiRequest } = require('../lib/qase-utils');


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
    }

    return allSuites;
  } catch (error) {
    console.error(`❌ 获取 Suite 失败: ${error.message}`);
    return [];
  }
}

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    json: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--json') {
      options.json = true;
    }
  }

  return options;
}

/**
 * 格式化输出
 */
function formatOutput(suites, options) {
  if (options.json) {
    console.log(JSON.stringify(suites, null, 2));
    return;
  }

  console.log(`\n📊 找到 ${suites.length} 个 Suite:\n`);

  if (suites.length === 0) {
    console.log('  （无 Suite）\n');
    return;
  }

  suites.forEach((suite, index) => {
    console.log(`${index + 1}. [ID: ${suite.id}] ${suite.title}`);
    if (suite.description) {
      console.log(`   描述: ${suite.description}`);
    }
    if (suite.parent_id) {
      console.log(`   父级 Suite ID: ${suite.parent_id}`);
    }
    console.log(`   测试用例数量: ${suite.cases_count || 0}`);
    console.log('');
  });
}

/**
 * 主函数
 */
async function main() {
  console.log('🔍 查询 Qase Suites...\n');

  const config = loadConfig();
  const options = parseArgs();

  // 验证 Qase 配置
  if (!config.qase || !config.qase.apiToken || !config.qase.projectCode) {
    console.error('❌ 错误: .qase-config.json 中缺少 Qase 配置');
    console.error('   请确保配置包含 qase.apiToken 和 qase.projectCode');
    process.exit(1);
  }

  // 获取所有 Suite
  const suites = await getAllSuites(config);

  // 输出结果
  formatOutput(suites, options);
}

// 执行
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ 查询失败:', error.message);
    process.exit(1);
  });
}

module.exports = { getAllSuites };
