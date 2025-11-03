#!/usr/bin/env node

/**
 * 生成符合Qase v2格式的CSV导入文件
 *
 * 特性：
 * - 符合Qase CSV v2规范
 * - 支持测试步骤（用双引号包裹）
 * - 支持Suite层级结构
 * - 支持更新现有CSV文件
 */

const fs = require('fs');
const path = require('path');
const { loadConfig } = require('../lib/qase-utils');
const { scanTestFiles } = require('./extract-tests');

const PROJECT_ROOT = process.cwd();
const CONFIG = loadConfig();

// CSV v2 格式头部
const CSV_HEADERS = [
  'v2.id',
  'custom_id',
  'title',
  'description',
  'preconditions',
  'postconditions',
  'suite_id',
  'suite_parent_id',
  'suite',
  'suite_without_cases',
  'priority',
  'severity',
  'type',
  'layer',
  'automation',
  'status',
  'is_flaky',
  'is_muted',
  'behavior',
  'tags',
  'test_file_path',
  'steps_actions',
  'steps_data',
  'steps_result'
];

/**
 * 转义CSV字段值
 */
function escapeCsvValue(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const strValue = String(value);

  // 如果包含逗号、引号或换行符，需要用引号包裹并转义引号
  if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
    return `"${strValue.replace(/"/g, '""')}"`;
  }

  return strValue;
}

/**
 * 格式化测试步骤为CSV格式
 * v2格式要求步骤内容用双引号包裹
 */
function formatSteps(steps) {
  if (!steps || steps.length === 0) {
    return { actions: '', data: '', result: '' };
  }

  // 将步骤数组转换为编号列表
  const actions = steps.map((step, index) => `${index + 1}. ${step}`).join('\n');

  // v2格式要求用双引号包裹整个步骤内容
  return {
    actions: `"${actions.replace(/"/g, '""')}"`,
    data: '',
    result: ''
  };
}

/**
 * 创建Suite行（支持父子关系）
 */
function createSuiteRow(suiteId, suiteName, parentId = null) {
  return [
    '',                    // v2.id (留空，Qase自动分配)
    '',                    // custom_id (Suite不需要)
    '',                    // title
    '',                    // description
    '',                    // preconditions
    '',                    // postconditions
    suiteId,               // suite_id
    parentId || '',        // suite_parent_id (父Suite ID)
    suiteName,             // suite
    '1',                   // suite_without_cases (标记为Suite行)
    '',                    // priority
    '',                    // severity
    '',                    // type
    '',                    // layer
    '',                    // automation
    '',                    // status
    '',                    // is_flaky
    '',                    // is_muted
    '',                    // behavior
    '',                    // tags
    '',                    // test_file_path (Suite不需要)
    '',                    // steps_actions
    '',                    // steps_data
    ''                     // steps_result
  ];
}

/**
 * 创建测试用例行
 */
function createTestCaseRow(testCase, suiteId) {
  const steps = formatSteps(testCase.steps);

  return [
    testCase.qase_id || '',                // v2.id (从代码的 qase.id() 提取，如果没有则留空)
    testCase.id,                           // custom_id (用于去重，如TC-API-001)
    escapeCsvValue(testCase.title),        // title
    escapeCsvValue(testCase.description || ''),   // description
    escapeCsvValue(testCase.preconditions || ''), // preconditions
    escapeCsvValue(testCase.postconditions || ''), // postconditions
    suiteId,                               // suite_id
    '',                                    // suite_parent_id
    testCase.suite,                        // suite
    '',                                    // suite_without_cases (空表示是测试用例)
    testCase.priority || 'medium',         // priority
    'normal',                              // severity
    testCase.type || 'functional',         // type
    testCase.layer || 'e2e',               // layer
    testCase.automation || 'automated',    // automation
    testCase.status || 'actual',           // status
    'no',                                  // is_flaky
    '',                                    // is_muted
    'positive',                            // behavior
    testCase.type || 'e2e',                // tags
    escapeCsvValue(testCase.filePath || ''), // test_file_path (相对路径)
    steps.actions,                         // steps_actions
    steps.data,                            // steps_data
    steps.result                           // steps_result
  ];
}

/**
 * 解析层次化 Suite 路径
 * 例如: "API Tests / Contract Validation" → ["API Tests", "Contract Validation"]
 */
function parseSuitePath(suiteName) {
  return suiteName.split('/').map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * 构建 Suite 层次结构
 */
function buildSuiteHierarchy(testCases) {
  const suiteTree = {};
  const suiteIdMap = {};
  let nextSuiteId = 1;

  // 第一遍：收集所有唯一的 Suite 路径
  const allSuitePaths = new Set();
  for (const tc of testCases) {
    const path = parseSuitePath(tc.suite);

    // 添加每个层级的路径
    for (let i = 1; i <= path.length; i++) {
      const partialPath = path.slice(0, i).join(' / ');
      allSuitePaths.add(partialPath);
    }
  }

  // 第二遍：为每个 Suite 分配 ID 和父 ID
  const sortedPaths = Array.from(allSuitePaths).sort((a, b) => {
    const aDepth = a.split(' / ').length;
    const bDepth = b.split(' / ').length;

    // 先按深度排序，再按字母排序
    if (aDepth !== bDepth) {
      return aDepth - bDepth;
    }
    return a.localeCompare(b);
  });

  for (const fullPath of sortedPaths) {
    const parts = parseSuitePath(fullPath);
    const currentName = parts[parts.length - 1];
    const parentPath = parts.length > 1 ? parts.slice(0, -1).join(' / ') : null;
    const parentId = parentPath ? suiteIdMap[parentPath] : null;

    suiteIdMap[fullPath] = nextSuiteId;
    suiteTree[fullPath] = {
      id: nextSuiteId,
      name: currentName,
      fullPath: fullPath,
      parentId: parentId,
      testCases: []
    };

    nextSuiteId++;
  }

  // 第三遍：将测试用例分配到对应的 Suite
  for (const tc of testCases) {
    const fullPath = tc.suite;
    if (suiteTree[fullPath]) {
      suiteTree[fullPath].testCases.push(tc);
    }
  }

  return { suiteTree, suiteIdMap };
}

/**
 * 生成CSV内容（支持层次化 Suite）
 */
function generateCsv(testCases) {
  const rows = [];

  // 添加头部
  rows.push(CSV_HEADERS.join(','));

  // 构建 Suite 层次结构
  const { suiteTree, suiteIdMap } = buildSuiteHierarchy(testCases);

  // 按深度和字母顺序排列 Suite
  const sortedSuites = Object.values(suiteTree).sort((a, b) => {
    const aDepth = parseSuitePath(a.fullPath).length;
    const bDepth = parseSuitePath(b.fullPath).length;

    if (aDepth !== bDepth) {
      return aDepth - bDepth;
    }
    return a.fullPath.localeCompare(b.fullPath);
  });

  // 生成 Suite 行和测试用例行
  for (const suite of sortedSuites) {
    // 添加 Suite 行
    rows.push(createSuiteRow(suite.id, suite.name, suite.parentId).join(','));

    // 添加该 Suite 下的测试用例
    for (const tc of suite.testCases) {
      rows.push(createTestCaseRow(tc, suite.id).join(','));
    }
  }

  return rows.join('\n');
}

/**
 * 读取现有CSV文件
 */
function readExistingCsv(csvPath) {
  if (!fs.existsSync(csvPath)) {
    return null;
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');

  // 简单解析（不处理复杂的CSV转义）
  const headers = lines[0].split(',');
  const rows = lines.slice(1).map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current);
    return values;
  });

  return { headers, rows };
}

/**
 * 更新现有CSV文件
 */
function updateCsv(testCases, csvPath) {
  const existing = readExistingCsv(csvPath);

  if (!existing) {
    console.log('⚠️  现有CSV文件不存在，将创建新文件');
    return generateCsv(testCases);
  }

  console.log(`📄 读取现有CSV文件: ${existing.rows.length} 行`);

  // TODO: 实现智能合并逻辑
  // 1. 保留现有测试用例的v2.id
  // 2. 更新已存在的测试用例
  // 3. 添加新的测试用例

  console.log('⚠️  更新模式暂未完全实现，将覆盖现有文件');
  return generateCsv(testCases);
}

/**
 * Validate test case Custom IDs
 */
function validateTestIds(testCases) {
  const STANDARD_PATTERN = /^TC-(API|UI|E2E|INT|PERF)-(SYNC|INBOX|ACCOUNT|SEARCH|TAG|ARCHIVE|AI|CONTRACT|SMOKE|WORKFLOW|AUTH|SETTINGS)-(\d{3})$/;

  const issues = [];
  const validIds = [];

  for (const tc of testCases) {
    const customId = tc.customId;

    if (!customId) {
      issues.push({
        id: 'N/A',
        file: tc.file,
        issue: 'Missing Custom ID',
        suggestion: 'Add Custom ID in format TC-{LAYER}-{MODULE}-{NUMBER}'
      });
      continue;
    }

    if (!STANDARD_PATTERN.test(customId)) {
      issues.push({
        id: customId,
        file: tc.file,
        issue: 'Non-standard format',
        suggestion: suggestCorrection(customId, tc.file)
      });
    } else {
      validIds.push(customId);
    }
  }

  return { issues, validIds };
}

/**
 * Suggest correction for non-standard ID
 */
function suggestCorrection(testId, fileName) {
  const fileBaseName = path.basename(fileName, '.spec.ts').toLowerCase();

  let suggestedModule = 'WORKFLOW';
  if (fileBaseName.includes('sync')) suggestedModule = 'SYNC';
  else if (fileBaseName.includes('api') || fileBaseName.includes('contract')) suggestedModule = 'CONTRACT';
  else if (fileBaseName.includes('search')) suggestedModule = 'SEARCH';
  else if (fileBaseName.includes('tag')) suggestedModule = 'TAG';
  else if (fileBaseName.includes('archive')) suggestedModule = 'ARCHIVE';
  else if (fileBaseName.includes('ai')) suggestedModule = 'AI';
  else if (fileBaseName.includes('smoke')) suggestedModule = 'SMOKE';
  else if (fileBaseName.includes('inbox')) suggestedModule = 'INBOX';
  else if (fileBaseName.includes('account')) suggestedModule = 'ACCOUNT';

  let suggestedLayer = 'E2E';
  if (fileBaseName.includes('api')) suggestedLayer = 'API';
  else if (fileBaseName.includes('ui')) suggestedLayer = 'UI';

  const numberMatch = testId.match(/\d+/);
  const number = numberMatch ? numberMatch[0].padStart(3, '0') : '001';

  return `TC-${suggestedLayer}-${suggestedModule}-${number}`;
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  const isUpdate = args.includes('--update');
  const isDebug = args.includes('--debug');
  const outputArg = args.find(arg => arg.startsWith('--output='));

  // 使用配置文件中的路径，如果命令行参数指定了则使用命令行参数
  const outputDir = outputArg
    ? path.dirname(outputArg.split('=')[1])
    : path.join(PROJECT_ROOT, CONFIG.outputDir);

  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 创建输出目录: ${outputDir}\n`);
  }

  const outputPath = outputArg
    ? outputArg.split('=')[1]
    : path.join(outputDir, CONFIG.csvFileName);

  console.log('📝 生成Qase CSV文件...');
  console.log(`📋 配置文件: ${CONFIG === loadConfig() ? '使用默认配置' : '已加载 .qase-config.json'}`);
  if (isDebug) {
    console.log(`🐛 Debug 模式: 将保存 JSON 文件`);
  }
  console.log();

  // 直接从代码提取测试用例（不依赖 JSON 文件）
  console.log('🔍 从测试代码提取测试用例...');
  const { testCases, errors } = scanTestFiles();

  if (errors && errors.length > 0) {
    console.warn(`\n⚠️  发现 ${errors.length} 个提取警告（已跳过）`);
  }

  console.log(`✅ 提取 ${testCases.length} 个测试用例`);

  // Debug 模式：保存 JSON 文件
  if (isDebug) {
    const jsonPath = path.join(outputDir, CONFIG.jsonFileName);
    fs.writeFileSync(jsonPath, JSON.stringify(testCases, null, 2), 'utf-8');
    console.log(`🐛 Debug: JSON 文件已保存: ${jsonPath}`);
  }

  // Validate Custom IDs (unless --skip-validation flag is present)
  const skipValidation = args.includes('--skip-validation');
  const validateOnly = args.includes('--validate');

  if (!skipValidation) {
    console.log('\n🔍 验证 Custom ID 格式...');
    const { issues, validIds } = validateTestIds(testCases);

    if (issues.length > 0) {
      console.log(`\n❌ 发现 ${issues.length} 个问题:\n`);
      issues.forEach(({ id, file, issue, suggestion }) => {
        console.log(`  ID: ${id}`);
        console.log(`  文件: ${file}`);
        console.log(`  问题: ${issue}`);
        console.log(`  建议: ${suggestion}\n`);
      });

      if (validateOnly) {
        process.exit(1);
      }

      console.log('⚠️  警告: 发现非标准格式的 Custom ID');
      console.log('💡 使用 --skip-validation 跳过验证（不推荐）\n');
      console.log('📖 查看 ID 规范:');
      console.log('   ~/.claude/skills/qase-testops-manager/references/custom-id-standards.md\n');
    } else {
      console.log(`✅ 所有 ${validIds.length} 个 Custom ID 格式正确\n`);
    }

    if (validateOnly) {
      console.log('✨ 验证完成');
      process.exit(0);
    }
  }

  // 生成或更新CSV
  let csvContent;
  if (isUpdate && fs.existsSync(outputPath)) {
    console.log('🔄 更新模式...');
    csvContent = updateCsv(testCases, outputPath);
  } else {
    console.log('🆕 创建新CSV文件...');
    csvContent = generateCsv(testCases);
  }

  // 写入文件
  fs.writeFileSync(outputPath, csvContent, 'utf-8');

  console.log(`\n💾 CSV文件已保存: ${outputPath}`);
  console.log('\n📖 下一步:');
  console.log('   1. 在Qase中进入 Repository → Import → CSV');
  console.log('   2. 选择生成的CSV文件');
  console.log('   3. 确认字段映射');
  console.log('   4. 点击 Import\n');
}

// 如果直接运行脚本
if (require.main === module) {
  main();
}

module.exports = { generateCsv, formatSteps, createTestCaseRow, createSuiteRow };
