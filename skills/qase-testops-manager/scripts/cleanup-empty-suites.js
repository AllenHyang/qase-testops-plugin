#!/usr/bin/env node

/**
 * 清理 Qase Repository 中的空 Suite
 *
 * 用途：
 * - 清理 Playwright Reporter 运行时创建的空 suite
 * - 清理重构后遗留的空 suite
 *
 * 清理条件：
 * - cases_count = 0（没有测试用例）
 * - 可选：创建时间超过指定天数（避免误删刚创建的）
 *
 * 使用示例：
 * node cleanup-empty-suites.js --dry-run       # 预览将要删除的 suite
 * node cleanup-empty-suites.js --yes           # 确认删除
 * node cleanup-empty-suites.js --min-age=7     # 只删除 7 天前创建的空 suite
 */

const https = require('https');
const { loadConfig } = require('../lib/qase-utils');

const CONFIG = loadConfig();

/**
 * 从命令行参数解析选项
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: true,
    minAge: 0, // 最小天数，0 表示不限制
  };

  for (const arg of args) {
    if (arg === '--yes' || arg === '-y') {
      options.dryRun = false;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--min-age=')) {
      options.minAge = parseInt(arg.split('=')[1]);
    }
  }

  return options;
}

/**
 * 发起 HTTPS 请求
 */
function httpsRequest(url, options) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * 获取所有 suites（支持分页）
 */
async function getAllSuites() {
  let allSuites = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const url = `https://api.qase.io/v1/suite/${CONFIG.qase.projectCode}?limit=${limit}&offset=${offset}`;

    const response = await httpsRequest(url, {
      method: 'GET',
      headers: {
        'Token': CONFIG.qase.apiToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.status || !response.result) {
      throw new Error('Failed to fetch suites');
    }

    const suites = response.result.entities || [];
    allSuites = allSuites.concat(suites);

    // 检查是否还有更多数据
    const total = response.result.total || 0;
    offset += limit;
    hasMore = offset < total;
  }

  return allSuites;
}

/**
 * 删除单个 suite
 */
async function deleteSuite(suiteId) {
  const url = `https://api.qase.io/v1/suite/${CONFIG.qase.projectCode}/${suiteId}`;

  const response = await httpsRequest(url, {
    method: 'DELETE',
    headers: {
      'Token': CONFIG.qase.apiToken,
      'Content-Type': 'application/json',
    },
  });

  return response;
}

/**
 * 检查 suite 创建时间是否超过指定天数
 */
function isOlderThan(createdAt, days) {
  if (days === 0) return true; // 不限制

  const created = new Date(createdAt);
  const now = new Date();
  const diffDays = (now - created) / (1000 * 60 * 60 * 24);

  return diffDays >= days;
}

/**
 * 判断 suite 是否由 Reporter 创建
 *
 * 特征：
 * - title 包含文件路径（如 "specs/smoke-ui.spec.ts"）
 * - title 是 "default"
 * - parent suite 是上述类型
 */
function isReporterCreatedSuite(suite, allSuites) {
  const title = suite.title;

  // 直接匹配
  if (title === 'default' || title.includes('spec.ts')) {
    return true;
  }

  // 检查父 suite 是否是 Reporter 创建的
  if (suite.parent_id) {
    const parent = allSuites.find(s => s.id === suite.parent_id);
    if (parent && isReporterCreatedSuite(parent, allSuites)) {
      return true;
    }
  }

  return false;
}

/**
 * 主函数
 */
async function main() {
  const options = parseArgs();

  console.log('🔍 正在扫描 Qase Repository...\n');

  // 获取所有 suites
  const allSuites = await getAllSuites();
  console.log(`✅ 找到 ${allSuites.length} 个 suite\n`);

  // 筛选空 suite
  const emptySuites = allSuites.filter(suite => {
    // 必须是空的（没有测试用例）
    if (suite.cases_count !== 0) {
      return false;
    }

    // 🔥 关键检查：如果有子 suites，不应该删除（避免级联删除）
    const hasChildren = allSuites.some(s => s.parent_id === suite.id);
    if (hasChildren) {
      return false;
    }

    // 检查创建时间
    if (!isOlderThan(suite.created, options.minAge)) {
      return false;
    }

    return true;
  });

  if (emptySuites.length === 0) {
    console.log('✅ 没有需要清理的空 suite');
    return;
  }

  console.log(`📋 找到 ${emptySuites.length} 个空 suite:\n`);

  // 分组：Reporter 创建 vs 其他
  const reporterSuites = emptySuites.filter(s => isReporterCreatedSuite(s, allSuites));
  const otherSuites = emptySuites.filter(s => !isReporterCreatedSuite(s, allSuites));

  if (reporterSuites.length > 0) {
    console.log('🤖 Reporter 创建的空 suite:');
    reporterSuites.forEach(suite => {
      const parentInfo = suite.parent_id
        ? ` (parent: ${allSuites.find(s => s.id === suite.parent_id)?.title || suite.parent_id})`
        : '';
      console.log(`   - [${suite.id}] ${suite.title}${parentInfo}`);
    });
    console.log();
  }

  if (otherSuites.length > 0) {
    console.log('📦 其他空 suite:');
    otherSuites.forEach(suite => {
      const parentInfo = suite.parent_id
        ? ` (parent: ${allSuites.find(s => s.id === suite.parent_id)?.title || suite.parent_id})`
        : '';
      console.log(`   - [${suite.id}] ${suite.title}${parentInfo}`);
    });
    console.log();
  }

  // Dry run 模式
  if (options.dryRun) {
    console.log('ℹ️  这是预览模式（--dry-run）');
    console.log('ℹ️  使用 --yes 参数确认删除\n');
    console.log(`📊 统计:`);
    console.log(`   - Reporter 创建: ${reporterSuites.length} 个`);
    console.log(`   - 其他: ${otherSuites.length} 个`);
    console.log(`   - 总计: ${emptySuites.length} 个`);
    return;
  }

  // 确认删除
  console.log('⚠️  即将删除以下空 suite:\n');

  let deleteCount = 0;
  let errorCount = 0;

  for (const suite of emptySuites) {
    try {
      await deleteSuite(suite.id);
      console.log(`✅ 已删除: [${suite.id}] ${suite.title}`);
      deleteCount++;
    } catch (error) {
      console.error(`❌ 删除失败: [${suite.id}] ${suite.title} - ${error.message}`);
      errorCount++;
    }
  }

  console.log();
  console.log(`📊 清理完成:`);
  console.log(`   - 成功删除: ${deleteCount} 个`);
  console.log(`   - 删除失败: ${errorCount} 个`);
}

// 执行
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ 错误:', error.message);
    process.exit(1);
  });
}

module.exports = { getAllSuites, deleteSuite };
