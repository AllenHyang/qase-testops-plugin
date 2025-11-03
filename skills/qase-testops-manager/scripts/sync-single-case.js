#!/usr/bin/env node

/**
 * 同步单个测试用例到 Qase（Code First 架构）
 * 用法: node sync-single-case.js TC-API-SYNC-015
 *      node sync-single-case.js EA-955
 *
 * Code First: 直接扫描代码获取 Custom ID 和 Qase ID 映射
 */

const fs = require('fs');
const path = require('path');
const { loadConfig, qaseApiRequest } = require('../lib/qase-utils');
const { scanTestFiles } = require('./extract-tests');

// 项目根目录
const PROJECT_ROOT = process.cwd();

// 从命令行获取测试用例 ID
const inputTestId = process.argv[2];

if (!inputTestId) {
  console.error('❌ 错误: 请提供测试用例 ID');
  console.error('   用法: node sync-single-case.js TC-UI-SYNC-001');
  console.error('        node sync-single-case.js EA-955');
  process.exit(1);
}

/**
 * 解析输入的测试用例 ID，支持两种格式（Code First）：
 * 1. Custom ID: TC-UI-SYNC-001
 * 2. Qase ID: EA-955 (projectCode-numericId)
 *
 * Code First: 直接扫描代码获取 Custom ID 和 Qase ID 映射
 *
 * @returns {string} Custom ID (TC-UI-SYNC-001)
 */
function resolveTestId(input, config) {
  // 检查是否是 Qase ID 格式 (EA-955)
  const qaseIdPattern = new RegExp(`^${config.qase.projectCode}-(\\d+)$`);
  const match = input.match(qaseIdPattern);

  if (match) {
    // 输入是 Qase ID 格式，需要从代码中查找对应的 Custom ID
    const numericId = parseInt(match[1], 10);

    console.log('🔍 扫描测试代码以查找 Custom ID...');
    const { testCases, errors } = scanTestFiles();

    if (errors.length > 0) {
      console.warn('⚠️  扫描过程中发现一些问题:');
      errors.forEach(err => console.warn(`   - ${err}`));
    }

    // 反向查找: 从 qase_id 找到 Custom ID
    for (const tc of testCases) {
      if (tc.qase_id === numericId) {
        console.log(`ℹ️  检测到 Qase ID 格式: ${input} → Custom ID: ${tc.id}`);
        return tc.id;
      }
    }

    console.error(`❌ 错误: 找不到 Qase ID ${input} 对应的 Custom ID`);
    const availableQaseIds = testCases
      .filter(tc => tc.qase_id)
      .map(tc => `${config.qase.projectCode}-${tc.qase_id}`)
      .join(', ');
    if (availableQaseIds) {
      console.error(`   可用的 Qase ID: ${availableQaseIds}`);
    } else {
      console.error('   提示: 代码中没有找到任何 qase.id() 注解');
      console.error('   请先运行完整同步: node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js');
    }
    process.exit(1);
  }

  // 输入是 Custom ID 格式，直接返回
  return input;
}


/**
 * 映射函数 - 与 sync-to-qase.js 保持一致
 */
function mapSeverity(severity) {
  const severityMap = {
    'blocker': 1,
    'critical': 2,
    'major': 3,
    'normal': 4,
    'minor': 5,
    'trivial': 6
  };
  return severityMap[severity] || 4; // 默认: normal
}

function mapPriority(priority) {
  const priorityMap = {
    'high': 1,
    'medium': 2,
    'low': 3
  };
  return priorityMap[priority] || 2; // 默认: medium
}

function mapTestType(type) {
  const typeMap = {
    'functional': 1,
    'smoke': 2,
    'regression': 3,
    'security': 4,
    'usability': 5,
    'performance': 6,
    'acceptance': 7,
    'compatibility': 8,
    'integration': 9,
    'exploratory': 10
  };
  return typeMap[type] || 1; // 默认: functional
}

function mapTestLayer(layer) {
  const layerMap = {
    'e2e': 1,
    'api': 2,
    'unit': 3
  };
  return layerMap[layer] || 1; // 默认: e2e
}

/**
 * 获取现有测试用例
 */
async function getExistingCase(config, customId) {
  try {
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await qaseApiRequest(
        config,
        'GET',
        `/case/${config.qase.projectCode}?limit=${limit}&offset=${offset}`
      );

      if (response.result && response.result.entities) {
        for (const testCase of response.result.entities) {
          // 检查 custom_fields 中的 Custom ID
          if (testCase.custom_fields && Array.isArray(testCase.custom_fields)) {
            const customIdField = testCase.custom_fields.find(f => f.id === 1);
            if (customIdField && customIdField.value === customId) {
              return testCase;
            }
          }

          // 也检查 title 是否以 Custom ID 开头
          if (testCase.title && testCase.title.startsWith(customId)) {
            return testCase;
          }
        }

        hasMore = response.result.total > offset + limit;
        offset += limit;
      } else {
        hasMore = false;
      }
    }

    return null;
  } catch (error) {
    console.error(`❌ 获取测试用例失败: ${error.message}`);
    return null;
  }
}

/**
 * 更新单个测试用例
 */
/**
 * 解析层次化 Suite 路径
 * 支持两种分隔符：
 * 1. Tab 字符 (\t) - 从代码中提取的格式
 * 2. > - 用于显示的格式
 */
function parseSuitePath(suiteName) {
  // 优先使用 Tab 分隔符（从代码提取的格式）
  if (suiteName.includes('\t')) {
    return suiteName.split('\t').map(s => s.trim()).filter(s => s.length > 0);
  }
  // 回退到 > 分隔符
  return suiteName.split('>').map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * 创建或获取 Suite
 */
async function createSuite(config, suiteName, parentId, existingSuites) {
  try {
    // 先检查是否已存在
    const existing = existingSuites.find(
      suite => suite.title === suiteName &&
      (suite.parent_id === parentId || (!suite.parent_id && !parentId))
    );

    if (existing) {
      console.log(`   ℹ️  使用现有 Suite: ${suiteName} (ID: ${existing.id}${parentId ? `, Parent: ${parentId}` : ''})`);
      return existing.id;
    }

    // 如果不存在，才创建新 Suite
    const response = await qaseApiRequest(
      config,
      'POST',
      `/suite/${config.qase.projectCode}`,
      {
        title: suiteName,
        description: `从代码自动同步的测试套件`,
        preconditions: null,
        parent_id: parentId
      }
    );
    console.log(`   ✅ 创建 Suite: ${suiteName} (ID: ${response.result.id}${parentId ? `, Parent: ${parentId}` : ''})`);

    // 将新创建的 suite 加入 existingSuites 数组，防止重复创建
    const newSuite = {
      id: response.result.id,
      title: suiteName,
      parent_id: parentId
    };
    existingSuites.push(newSuite);

    return response.result.id;
  } catch (error) {
    console.error(`   ❌ 创建 Suite 失败: ${error.message}`);
    return null;
  }
}

/**
 * 确保层次化 Suite 存在（递归创建父 Suite）
 */
async function ensureSuiteHierarchy(config, fullSuitePath, suiteMap, existingSuites) {
  const parts = parseSuitePath(fullSuitePath);

  // 检测原始路径使用的分隔符
  const separator = fullSuitePath.includes('\t') ? '\t' : ' > ';

  // 递归确保每一层 Suite 都存在
  for (let i = 0; i < parts.length; i++) {
    const currentPath = parts.slice(0, i + 1).join(separator); // 使用相同的分隔符
    const currentName = parts[i];
    const parentPath = i > 0 ? parts.slice(0, i).join(separator) : null; // 使用相同的分隔符
    const parentId = parentPath ? suiteMap[parentPath] : null;

    // 如果当前层级的 Suite 不存在，创建它（或使用已存在的）
    if (!suiteMap[currentPath]) {
      const suiteId = await createSuite(config, currentName, parentId, existingSuites);
      if (suiteId) {
        suiteMap[currentPath] = suiteId;
      } else {
        return null; // 创建失败
      }
    }
  }

  return suiteMap[fullSuitePath];
}

async function updateTestCase(config, testCase, existingCase, suiteId) {
  try {
    // 处理步骤：Qase API v1 格式（只支持 action 和 expected_result）
    const steps = testCase.steps && testCase.steps.length > 0
      ? testCase.steps.map((step, index) => {
          // 如果 step 是对象（新格式），提取 action
          if (typeof step === 'object' && step.action) {
            return {
              action: step.action || '',
              expected_result: step.expected_result || '',
              position: index + 1
            };
          }
          // 兼容旧格式（字符串）
          return {
            action: step,
            expected_result: '',
            position: index + 1
          };
        })
      : [];

    // 构建自定义字段对象
    const customFields = {};
    const fieldConfig = config.qase.customFields || { customId: 1 };

    // 添加 Custom ID 字段
    if (fieldConfig.customId) {
      customFields[fieldConfig.customId] = testCase.id;
    }

    // 保留现有的 Last Run Result 字段值（字段 2）
    if (existingCase && existingCase.custom_fields) {
      const lastRunField = existingCase.custom_fields.find(f => f.id === 2);
      if (lastRunField && lastRunField.value !== null && lastRunField.value !== undefined) {
        customFields[2] = lastRunField.value;
      }
    }

    // 添加 Test File Path 字段
    if (fieldConfig.testFilePath && testCase.filePath) {
      customFields[fieldConfig.testFilePath] = testCase.filePath;
    }

    const updateData = {
      title: testCase.title,
      description: testCase.description || '',
      preconditions: testCase.preconditions || '',
      postconditions: testCase.postconditions || '',
      suite_id: suiteId, // 🔥 关键修复：更新 Suite ID
      severity: mapSeverity(testCase.severity),
      priority: mapPriority(testCase.priority),
      type: mapTestType(testCase.type),
      layer: mapTestLayer(testCase.layer),
      is_flaky: testCase.isFlaky ? 1 : 0,
      automation: testCase.automation === 'automated' ? 2 : 0,
      status: testCase.status === 'actual' ? 0 : 1,
      steps: steps,
      tags: Array.isArray(testCase.tags) ? testCase.tags : (testCase.tags ? [testCase.tags] : []),
      custom_field: customFields
    };

    await qaseApiRequest(
      config,
      'PATCH',
      `/case/${config.qase.projectCode}/${existingCase.id}`,
      updateData
    );

    return true;
  } catch (error) {
    console.error(`❌ 更新失败: ${error.message}`);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log(`\n🔄 同步单个测试用例: ${inputTestId}\n`);

  const config = loadConfig();

  // 解析输入 ID，支持 EA-955 或 TC-UI-SYNC-001 格式
  const targetTestId = resolveTestId(inputTestId, config);

  // 1. 从代码扫描测试用例（Code First - 唯一真实数据源）
  console.log('🔍 从测试代码扫描测试用例...');
  const { testCases, errors } = scanTestFiles();

  if (errors.length > 0) {
    console.warn('⚠️  扫描过程中发现一些问题:');
    errors.forEach(err => console.warn(`   - ${err}`));
  }

  if (testCases.length === 0) {
    console.error('❌ 错误: 没有找到任何测试用例');
    console.error('   请检查测试文件是否包含 Custom ID (TC-XXX-YYY-NNN)');
    process.exit(1);
  }

  // 2. 查找目标测试用例
  const targetCase = testCases.find(tc => tc.id === targetTestId);

  if (!targetCase) {
    console.error(`❌ 错误: 找不到测试用例 ${targetTestId}`);
    console.error(`   可用的测试用例: ${testCases.map(tc => tc.id).join(', ')}`);
    process.exit(1);
  }

  console.log(`✅ 找到测试用例:`);
  console.log(`   Custom ID: ${targetCase.id}`);
  console.log(`   标题: ${targetCase.title}`);
  console.log(`   文件: ${targetCase.filePath || targetCase.fileName}`);
  console.log(`   Suite: ${targetCase.suite}`);
  console.log(`   步骤: ${targetCase.steps ? targetCase.steps.length : 0} 个\n`);

  // 3. 在 Qase 中查找对应的测试用例
  console.log('🔍 在 Qase 中查找测试用例...');
  const existingCase = await getExistingCase(config, targetTestId);

  if (!existingCase) {
    console.error(`❌ 错误: 在 Qase 中找不到测试用例 ${targetTestId}`);
    console.error('   提示: 请先运行完整同步创建该测试用例');
    process.exit(1);
  }

  console.log(`✅ 找到 Qase 测试用例 (ID: ${existingCase.id})\n`);

  // 4. 确保 Suite 层级存在
  console.log('🔍 处理 Suite 层级...');
  const existingSuitesResponse = await qaseApiRequest(config, 'GET', `/suite/${config.qase.projectCode}`);
  const existingSuites = existingSuitesResponse.result.entities || [];

  const suiteMap = {};
  const suiteId = await ensureSuiteHierarchy(config, targetCase.suite, suiteMap, existingSuites);

  if (!suiteId) {
    console.error('\n❌ 错误: 无法创建或获取 Suite');
    process.exit(1);
  }

  console.log(`✅ Suite 准备就绪 (ID: ${suiteId})\n`);

  // 5. 更新测试用例
  console.log('📤 更新测试用例到 Qase...');
  const success = await updateTestCase(config, targetCase, existingCase, suiteId);

  if (success) {
    console.log(`\n✅ 成功更新测试用例 ${targetTestId}`);
    console.log(`   Qase ID: ${existingCase.id}`);
    console.log(`   查看: https://app.qase.io/case/${config.qase.projectCode}-${existingCase.id}`);
  } else {
    console.error(`\n❌ 更新测试用例失败`);
    process.exit(1);
  }
}

// 执行
if (require.main === module) {
  main().catch(err => {
    console.error('❌ 错误:', err.message);
    process.exit(1);
  });
}

module.exports = { updateTestCase };
