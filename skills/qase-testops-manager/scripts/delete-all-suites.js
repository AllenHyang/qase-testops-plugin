#!/usr/bin/env node

/**
 * 批量删除所有 Qase Suites
 *
 * 用法：
 *   node delete-all-suites.js                  # 删除所有 Suite（需要确认）
 *   node delete-all-suites.js --yes            # 跳过确认，直接删除
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
    skipConfirmation: false,
  };

  for (const arg of args) {
    if (arg === '--yes' || arg === '-y') {
      options.skipConfirmation = true;
    }
  }

  return options;
}

/**
 * 主函数
 */
async function main() {
  console.log('🗑️  批量删除 Qase Suites...\n');

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
  console.log(`📊 Qase 中有 ${suites.length} 个 Suite\n`);

  if (suites.length === 0) {
    console.log('✅ 没有需要删除的 Suite');
    process.exit(0);
  }

  // 确认操作
  if (!options.skipConfirmation) {
    const confirmMessage = `⚠️  即将删除 ${suites.length} 个 Suite，是否继续？`;
    const confirmed = await confirmAction(confirmMessage);
    if (!confirmed) {
      console.log('\n❌ 操作已取消');
      process.exit(0);
    }
  }

  console.log('\n🚀 开始删除...\n');

  let deletedCount = 0;

  // 删除所有 Suite
  for (let i = 0; i < suites.length; i++) {
    const suite = suites[i];
    process.stdout.write(`\r删除进度: ${i + 1}/${suites.length} - [${suite.id}] ${suite.title.substring(0, 50)}...`);

    if (await deleteSuiteFromQase(config, suite.id)) {
      deletedCount++;
    }

    // 添加延迟避免API限流
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  console.log('\n');

  // 输出结果
  console.log('\n📊 删除完成');
  console.log(`   ✅ 已删除 ${deletedCount}/${suites.length} 个 Suite`);
  if (deletedCount < suites.length) {
    console.log(`   ⚠️  有 ${suites.length - deletedCount} 个 Suite 删除失败`);
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

module.exports = { deleteSuiteFromQase };
