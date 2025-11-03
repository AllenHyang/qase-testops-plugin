#!/usr/bin/env node

/**
 * 自动同步测试用例到 Qase Repository
 *
 * 使用 Qase API v1 导入测试用例
 * 文档: https://developers.qase.io/reference/introduction-to-qase-api
 */

const fs = require('fs');
const path = require('path');
const { loadConfig, qaseApiRequest } = require('../lib/qase-utils');

const PROJECT_ROOT = process.cwd();


/**
 * 字段值映射函数
 * 将字符串值转换为 Qase API 需要的数字 ID
 */

// Type 映射 (测试类型)
function mapTestType(type) {
  const typeMap = {
    'functional': 1,
    'smoke': 2,
    'regression': 3,
    'security': 4,
    'usability': 5,
    'performance': 6,
    'acceptance': 7
  };
  return typeMap[type] || 1; // 默认: functional
}

// Layer 映射 (测试层级)
function mapTestLayer(layer) {
  const layerMap = {
    'e2e': 1,
    'api': 2,
    'unit': 3
  };
  return layerMap[layer] || 1; // 默认: e2e
}

// Severity 映射 (严重程度)
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

// Behavior 映射 (行为类型)
function mapBehavior(behavior) {
  if (!behavior) return null; // 不设置

  const behaviorMap = {
    'positive': 1,
    'negative': 2,
    'destructive': 3
  };
  return behaviorMap[behavior] || null;
}

// Priority 映射 (优先级)
function mapPriority(priority) {
  const priorityMap = {
    'high': 1,
    'medium': 2,
    'low': 3
  };
  return priorityMap[priority] || 2; // 默认: medium
}

/**
 * 获取现有的 Suites 并构建层次化映射
 */
async function getSuites(config) {
  try {
    // 🔥 修复：添加分页支持，获取所有 suites
    const allSuites = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const response = await qaseApiRequest(
        config,
        'GET',
        `/suite/${config.qase.projectCode}?limit=${limit}&offset=${offset}`
      );

      const suites = response.result.entities || [];
      allSuites.push(...suites);

      // 如果返回的数量少于limit，说明已经是最后一页
      if (suites.length < limit) {
        break;
      }

      offset += limit;
    }

    const suites = allSuites;

    // 构建 ID 到 Suite 的映射
    const idToSuite = {};
    for (const suite of suites) {
      idToSuite[suite.id] = suite;
    }

    // 构建完整路径映射
    const pathMap = {};

    function buildPath(suite) {
      const parts = [suite.title];
      let current = suite;
      let depth = 0;

      // 向上追溯父 Suite，计算层次深度
      while (current.parent_id) {
        const parent = idToSuite[current.parent_id];
        if (!parent) break;
        parts.unshift(parent.title);
        current = parent;
        depth++;
      }

      const fullPath = parts.join(' > ');

      // 🔥 冲突检测：当有多个 Suite 生成相同路径时，优先选择层次更深的（有 parent 的）
      if (pathMap[fullPath]) {
        const existingSuite = idToSuite[pathMap[fullPath]];
        const existingDepth = existingSuite.parent_id ? 1 : 0; // 简化：有 parent 就算深度更高

        // 如果当前 Suite 有 parent 但已存在的没有，替换
        if (depth > 0 && existingDepth === 0) {
          pathMap[fullPath] = suite.id;
        }
        // 如果已存在的有 parent，保持不变（优先保留有层次的）
      } else {
        pathMap[fullPath] = suite.id;
      }

      return fullPath;
    }

    // 为每个 Suite 构建完整路径
    for (const suite of suites) {
      buildPath(suite);
    }

    return { suites, pathMap };
  } catch (error) {
    console.warn(`⚠️  获取 Suites 失败: ${error.message}`);
    return { suites: [], pathMap: {} };
  }
}

/**
 * 获取现有的测试用例（通过 qase_id 和 title 双重去重）
 * 支持分页获取所有测试用例
 */
async function getExistingCases(config) {
  try {
    const allCases = [];
    let offset = 0;
    const limit = 100;

    // 分页获取所有测试用例
    while (true) {
      const response = await qaseApiRequest(
        config,
        'GET',
        `/case/${config.qase.projectCode}?limit=${limit}&offset=${offset}`
      );

      const cases = response.result.entities || [];
      allCases.push(...cases);

      // 如果返回的数量少于limit，说明已经是最后一页
      if (cases.length < limit) {
        break;
      }

      offset += limit;
    }

    // 创建两个映射：title -> case, qase_id -> case
    const titleMap = {};
    const qaseIdMap = {};

    for (const testCase of allCases) {
      // 1. 建立 title 映射（用于防止重复创建同名测试）
      if (testCase.title) {
        titleMap[testCase.title] = testCase;
      }

      // 2. 建立 qase_id 映射（用于检查本地 qase.id() 是否已存在）
      if (testCase.id) {
        qaseIdMap[testCase.id] = testCase;
      }
    }

    return { titleMap, qaseIdMap };
  } catch (error) {
    console.warn(`⚠️  获取现有测试用例失败: ${error.message}`);
    return { titleMap: {}, qaseIdMap: {} };
  }
}

/**
 * 解析 Suite 路径为名称数组
 * 支持多种分隔符：\t, /, >
 */
function parseSuitePath(suitePath) {
  if (!suitePath) return [];

  // 检测并使用对应的分隔符
  let separator = ' / '; // 默认（当前格式）
  if (suitePath.includes('\t')) {
    separator = '\t';
  } else if (suitePath.includes(' > ')) {
    separator = ' > ';
  }

  return suitePath.split(separator).map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * 创建单个 Suite（内部函数，由 ensureSuiteHierarchy 调用）
 */
async function createSuite(config, suiteName, parentId = null) {
  try {
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

    const indentation = parentId ? '      ' : '   ';
    console.log(`${indentation}✅ 创建 Suite: ${suiteName} (ID: ${response.result.id}${parentId ? `, Parent: ${parentId}` : ''})`);

    return {
      id: response.result.id,
      title: suiteName,
      parent_id: parentId
    };
  } catch (error) {
    console.error(`   ❌ 创建 Suite 失败: ${error.message}`);
    return null;
  }
}

/**
 * 确保层次化 Suite 存在（递归创建父 Suite）
 *
 * @param {Object} config - 配置对象
 * @param {string} suitePath - Suite 路径字符串（如 "E2E Tests / AI Features"）
 * @param {Array} existingSuites - 现有的 Suite 列表
 * @returns {number|null} - 最深层 Suite 的 ID，失败返回 null
 *
 * 算法：
 * 1. 解析路径为名称数组：["E2E Tests", "AI Features"]
 * 2. 从外到内逐层检查/创建：
 *    - 第1层: E2E Tests (parent_id = null)
 *    - 第2层: AI Features (parent_id = E2E Tests的ID)
 * 3. 返回最内层的 Suite ID
 */
async function ensureSuiteHierarchy(config, suitePath, existingSuites) {
  const suiteNames = parseSuitePath(suitePath);

  if (suiteNames.length === 0) {
    console.error('   ❌ Suite 路径为空');
    return null;
  }

  let parentId = null;

  for (let i = 0; i < suiteNames.length; i++) {
    const suiteName = suiteNames[i];
    const indentation = '   ' + '   '.repeat(i);

    // 查找是否已存在（匹配 title 和 parent_id）
    let suite = existingSuites.find(s =>
      s.title === suiteName &&
      (s.parent_id === parentId || (!s.parent_id && parentId === null))
    );

    if (suite) {
      console.log(`${indentation}ℹ️  使用现有 Suite: ${suiteName} (ID: ${suite.id}${parentId ? `, Parent: ${parentId}` : ''})`);
    } else {
      // 不存在就创建
      suite = await createSuite(config, suiteName, parentId);
      if (!suite) {
        return null; // 创建失败
      }
      existingSuites.push(suite);
    }

    parentId = suite.id; // 下一层的父 ID
  }

  return parentId; // 返回最深层的 Suite ID
}

/**
 * 更新单个测试用例
 */
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
    // 如果现有测试用例有这个字段，保留其值；否则不设置（更新时可选）
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
      suite_id: suiteId,
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

    // 只有当 behavior 不为 null 时才添加
    const behavior = mapBehavior(testCase.behavior);
    if (behavior !== null) {
      updateData.behavior = behavior;
    }

    await qaseApiRequest(
      config,
      'PATCH',
      `/case/${config.qase.projectCode}/${existingCase.id}`,
      updateData
    );

    return true;
  } catch (error) {
    console.error(`   ❌ 更新失败 (${testCase.id}): ${error.message}`);
    return false;
  }
}

/**
 * 批量创建测试用例
 * 返回 custom_id -> qase_id 的映射
 */
async function bulkCreateTestCases(config, testCases, suiteId) {
  try {
    // 获取自定义字段配置
    const fieldConfig = config.qase.customFields || { customId: 1 };

    // 准备批量测试用例数据
    const cases = testCases.map(testCase => {
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

      // 添加 Custom ID 字段
      if (fieldConfig.customId) {
        customFields[fieldConfig.customId] = testCase.id;
      }

      // 添加 Last Run Result 字段（字段 2）- 新测试用例默认为 NOTRUN (4)
      customFields[2] = 4;

      // 添加 Test File Path 字段
      if (fieldConfig.testFilePath && testCase.filePath) {
        customFields[fieldConfig.testFilePath] = testCase.filePath;
      }

      const caseData = {
        title: testCase.title,
        description: testCase.description || '',
        preconditions: testCase.preconditions || '',
        postconditions: testCase.postconditions || '',
        suite_id: suiteId,
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

      // 只有当 behavior 不为 null 时才添加
      const behavior = mapBehavior(testCase.behavior);
      if (behavior !== null) {
        caseData.behavior = behavior;
      }

      return caseData;
    });

    const response = await qaseApiRequest(
      config,
      'POST',
      `/case/${config.qase.projectCode}/bulk`,
      { cases }
    );

    // 构建 custom_id -> {qase_id, suite_path} 映射（增强格式）
    const idMapping = {};

    // Qase bulk create 返回格式: { ids: [717, 718, ...] }
    if (response.result && response.result.ids && Array.isArray(response.result.ids)) {
      response.result.ids.forEach((qaseId, index) => {
        if (qaseId && testCases[index]) {
          // 增强格式：包含 qase_id 和 suite_path（使用制表符 \t 分隔）
          idMapping[testCases[index].id] = {
            qase_id: qaseId,
            suite_path: testCases[index].suite // 直接使用，已包含 \t
          };
        }
      });
    }

    return { result: response.result, idMapping };
  } catch (error) {
    console.error(`   ❌ 批量创建失败: ${error.message}`);
    return null;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始同步测试用例到 Qase...\n');

  const config = loadConfig();

  // 直接提取测试用例，不依赖中间文件
  const { main: extractMain } = require('./extract-tests.js');
  console.log('📤 从测试代码中提取用例...');
  const testCases = extractMain({ saveToFile: false, verbose: false });

  console.log(`📋 读取 ${testCases.length} 个测试用例`);
  console.log(`🎯 目标项目: ${config.qase.projectCode}\n`);

  // 获取现有 Suites（只需要 suite 列表，不需要 pathMap）
  console.log('📦 获取现有 Suites...');
  const { suites: existingSuites } = await getSuites(config);
  console.log(`   找到 ${existingSuites.length} 个已存在的 Suite`);

  // 获取现有测试用例（用于更新或创建）
  console.log('\n🔍 检查现有测试用例...');
  const { titleMap, qaseIdMap } = await getExistingCases(config);
  console.log(`   找到 ${Object.keys(qaseIdMap).length} 个已存在的测试用例`);

  // 分离需要更新和创建的测试用例
  const toUpdate = [];
  const toCreate = [];

  for (const tc of testCases) {
    let existingCase = null;
    let matchReason = '';

    // 1. 检查：如果测试代码中有 qase_id，优先检查远程是否存在
    // Note: extract-tests.js 可能需要扩展来提取 qase.id()，当前主要通过 custom_id 匹配
    const localQaseId = tc.qase_id; // 从代码中的 qase.id() 提取（如果有）
    if (localQaseId) {
      if (qaseIdMap[localQaseId]) {
        // 远程存在该 ID，必须走更新逻辑
        existingCase = qaseIdMap[localQaseId];
        matchReason = `qase_id: ${localQaseId}`;
      } else {
        // 远程不存在该 ID，可能已被删除
        console.warn(`   ⚠️  警告: ${tc.id} 的本地 qase_id (${localQaseId}) 在远程不存在，可能已被删除`);
      }
    }

    // 2. 如果通过 qase_id 没有匹配上，再检查 title（防止重复创建）
    if (!existingCase && titleMap[tc.title]) {
      existingCase = titleMap[tc.title];
      matchReason = `title: "${tc.title}"`;

      // 如果本地有 qase_id 但通过 title 匹配上了，说明可能是 ID 不一致
      if (localQaseId) {
        console.warn(`   ⚠️  ${tc.id}: 本地 qase_id (${localQaseId}) 与远程 (${existingCase.id}) 不一致，将更新为远程 ID`);
      }
    }

    if (existingCase) {
      console.log(`   🔄 需要更新: ${tc.id} (匹配: ${matchReason})`);
      toUpdate.push({ testCase: tc, existing: existingCase });
    } else {
      toCreate.push(tc);
    }
  }

  if (toUpdate.length > 0) {
    console.log(`\n🔄 准备更新 ${toUpdate.length} 个已存在的测试用例`);
  }
  if (toCreate.length > 0) {
    console.log(`\n📤 准备创建 ${toCreate.length} 个新测试用例`);
  }

  if (toUpdate.length === 0 && toCreate.length === 0) {
    console.log('\n✅ 没有需要同步的测试用例');
    return;
  }

  // 按 Suite 分组（创建）
  const groupedBySuite = {};
  for (const tc of toCreate) {
    if (!groupedBySuite[tc.suite]) {
      groupedBySuite[tc.suite] = [];
    }
    groupedBySuite[tc.suite].push(tc);
  }

  // 按 Suite 分组（更新）
  const updateGroupedBySuite = {};
  for (const { testCase, existing } of toUpdate) {
    if (!updateGroupedBySuite[testCase.suite]) {
      updateGroupedBySuite[testCase.suite] = [];
    }
    updateGroupedBySuite[testCase.suite].push({ testCase, existing });
  }

  console.log('');

  // 处理更新
  let totalUpdated = 0;
  let totalCreated = 0;
  let totalFailed = 0;
  const allIdMappings = {}; // 收集所有的 custom_id -> qase_id 映射

  // 先处理更新
  for (const [suiteName, items] of Object.entries(updateGroupedBySuite)) {
    console.log(`\n📦 更新 Suite: ${suiteName} (${items.length} 个测试用例)`);

    // 确保层次化 Suite 存在
    const suiteId = await ensureSuiteHierarchy(config, suiteName, existingSuites);
    if (!suiteId) {
      console.error(`   ⚠️  跳过此 Suite 的测试用例`);
      totalFailed += items.length;
      continue;
    }

    // 逐个更新测试用例
    console.log(`   🔄 更新 ${items.length} 个测试用例...`);
    for (const { testCase, existing } of items) {
      const success = await updateTestCase(config, testCase, existing, suiteId);
      if (success) {
        totalUpdated++;
        console.log(`      ✅ ${testCase.id}: ${testCase.title}`);
        // 记录更新的 ID 映射（增强格式）
        allIdMappings[testCase.id] = {
          qase_id: existing.id,
          suite_path: testCase.suite // 直接使用，已包含 \t
        };
      } else {
        totalFailed++;
      }
      // 添加小延迟避免API限流
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  // 然后处理创建
  for (const [suiteName, cases] of Object.entries(groupedBySuite)) {
    console.log(`\n📦 创建 Suite: ${suiteName} (${cases.length} 个测试用例)`);

    // 确保层次化 Suite 存在
    const suiteId = await ensureSuiteHierarchy(config, suiteName, existingSuites);
    if (!suiteId) {
      console.error(`   ⚠️  跳过此 Suite 的测试用例`);
      totalFailed += cases.length;
      continue;
    }

    // 批量创建测试用例
    console.log(`   📤 批量创建 ${cases.length} 个测试用例...`);
    const result = await bulkCreateTestCases(config, cases, suiteId);

    if (result && result.idMapping) {
      console.log(`   ✅ 批量创建成功: ${cases.length} 个测试用例`);
      totalCreated += cases.length;

      // 合并 ID 映射
      Object.assign(allIdMappings, result.idMapping);

      // 显示创建的测试用例详情
      cases.forEach(tc => {
        const mapping = result.idMapping[tc.id];
        const qaseId = mapping && mapping.qase_id ? mapping.qase_id : mapping; // 兼容旧格式
        console.log(`      • ${tc.id} → Qase ID: ${qaseId} - ${tc.title}`);
      });
    } else {
      console.error(`   ❌ 批量创建失败`);
      totalFailed += cases.length;
    }

    // 添加延迟避免API限流
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n\n📊 同步完成');
  if (totalUpdated > 0) {
    console.log(`   🔄 更新: ${totalUpdated} 个`);
  }
  if (totalCreated > 0) {
    console.log(`   ✅ 创建: ${totalCreated} 个`);
  }
  if (totalFailed > 0) {
    console.log(`   ❌ 失败: ${totalFailed} 个`);
  }
  console.log('');
}

// 执行
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ 同步失败:', error.message);
    process.exit(1);
  });
}

module.exports = { main };
