#!/usr/bin/env node

/**
 * 自动更新测试代码中的 qase.id() 注解
 *
 * 功能：
 * 1. 从 CSV 读取 Custom ID → Qase ID 映射
 * 2. 扫描测试文件，找到带 Custom ID 的测试
 * 3. 自动添加或更新 qase.id()
 *
 * 注意：不再处理 qase.suite()，统一使用 test.describe() 定义层级
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { loadConfig } = require('../lib/qase-utils');

const PROJECT_ROOT = process.cwd();

const CONFIG = loadConfig();

/**
 * 从 CSV 加载 Qase ID 映射（只读 ID，不读 Suite）
 * Suite 路径将从当前文件的 test.describe() 嵌套中实时推导
 */
function loadQaseIdMapping() {
  const csvPath = path.join(PROJECT_ROOT, CONFIG.outputDir, CONFIG.csvFileName);

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ 错误: 找不到 CSV 文件: ${csvPath}`);
    console.error(`   请先运行完整同步流水线获取 Qase ID`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  });

  const mapping = {};
  records.forEach(record => {
    if (record.custom_id && record['v2.id']) {
      mapping[record.custom_id] = parseInt(record['v2.id']);
    }
  });

  return mapping;
}

/**
 * 从测试文件中提取嵌套的 test.describe() 路径
 * （从 extract-tests.js 复用的逻辑，确保一致性）
 *
 * 示例:
 * test.describe('API Tests', () => {
 *   test.describe('Sync Validation', () => {
 *     test('TC-API-SYNC-015: ...', () => {});
 *   });
 * });
 *
 * 返回: "API Tests\tSync Validation" (使用制表符 \t 作为层级分隔符)
 */
function extractNestedDescribePath(fileContent, testId) {
  const lines = fileContent.split('\n');
  const describePath = [];
  let braceDepth = 0;
  let inDescribe = false;
  let foundTest = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 找到目标测试行
    if (testId && line.includes(testId)) {
      foundTest = true;
      break;
    }

    // 提取 test.describe
    const describeMatch = line.match(/test\.describe\(['"`]([^'"`]+)['"`]/);
    if (describeMatch) {
      describePath.push(describeMatch[1].trim());
      inDescribe = true;
    }

    // 追踪大括号深度
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;
    braceDepth += openBraces - closeBraces;

    // 如果闭合了 describe，移除最后一个
    if (inDescribe && braceDepth === 0 && closeBraces > 0 && describePath.length > 0) {
      describePath.pop();
    }
  }

  return foundTest && describePath.length > 0 ? describePath.join('\t') : null;
}

/**
 * 提取测试文件中的 Custom ID
 */
function extractCustomIdFromTest(line) {
  // 匹配: test('TC-XXX-XXX-NNN: ...')  (允许 E2E 等包含数字的 LAYER)
  const match = line.match(/test\(['"]([A-Z]+-[A-Z0-9]+-[A-Z]+-\d+)/);
  return match ? match[1] : null;
}

/**
 * 检查是否已有 qase.id()
 */
function hasQaseId(content, startIndex) {
  // 在测试函数开始后的前10行内查找 qase.id()
  const lines = content.split('\n');
  const startLine = content.substring(0, startIndex).split('\n').length - 1;

  for (let i = startLine; i < Math.min(startLine + 10, lines.length); i++) {
    if (lines[i].includes('qase.id(')) {
      return true;
    }
  }

  return false;
}

/**
 * 检查是否已有 qase.suite()
 */
function hasQaseSuite(content, startIndex) {
  const lines = content.split('\n');
  const startLine = content.substring(0, startIndex).split('\n').length - 1;

  for (let i = startLine; i < Math.min(startLine + 10, lines.length); i++) {
    if (lines[i].includes('qase.suite(')) {
      return true;
    }
  }

  return false;
}

/**
 * 生成 qase 注解代码
 * 注意：只生成 qase.id()，使用 test.describe() 定义 Suite 层级
 */
function generateQaseAnnotations(qaseId, suite, indent = '    ') {
  const lines = [];

  lines.push(`${indent}qase.id(${qaseId});`);

  return lines.join('\n');
}

/**
 * 更新单个文件
 * @param {string} filePath - 文件路径
 * @param {Object} qaseIdMapping - Custom ID → Qase ID 映射（只包含 ID，不包含 Suite）
 */
function updateFile(filePath, qaseIdMapping) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  const updates = [];

  // 正则匹配所有 test() 调用 (允许 E2E 等包含数字的 LAYER)
  // 支持 async () 和 async ({ page }) 等各种参数格式
  const testRegex = /test\(['"]([A-Z]+-[A-Z0-9]+-[A-Z]+-\d+):.*?['"],\s*async\s*/g;
  let match;

  const replacements = [];

  while ((match = testRegex.exec(content)) !== null) {
    const customId = match[1];
    const testStartIndex = match.index;

    // 检查是否有 Qase ID 映射
    if (!qaseIdMapping[customId]) {
      continue; // 没有映射，跳过
    }

    const qaseId = qaseIdMapping[customId];

    // 🔑 从代码中实时提取 Suite 路径（Code First）
    const suite = extractNestedDescribePath(content, customId);

    // 找到测试函数体的起始位置（第一个 { 后）
    const funcBodyStart = content.indexOf('{', testStartIndex);
    if (funcBodyStart === -1) continue;

    // 获取缩进
    const lineStart = content.lastIndexOf('\n', testStartIndex) + 1;
    const indent = content.substring(lineStart, testStartIndex).match(/^\s*/)[0] + '  ';

    // 检查是否已有 qase.id()
    const hasId = hasQaseId(content, testStartIndex);

    if (hasId) {
      // 已有 qase.id()，检查是否需要更新
      const testContext = content.substring(testStartIndex, testStartIndex + 500);
      const qaseIdMatch = testContext.match(/qase\.id\((\d+)\);/);

      if (qaseIdMatch) {
        const oldQaseId = parseInt(qaseIdMatch[1]);
        const newQaseId = qaseId;
        const qaseIdPos = testStartIndex + testContext.indexOf(qaseIdMatch[0]);

        // 1. 更新 qase.id() 如果 ID 不同
        if (oldQaseId !== newQaseId) {
          replacements.push({
            position: qaseIdPos,
            oldText: qaseIdMatch[0],
            text: `qase.id(${newQaseId});`,
            customId,
            qaseId: newQaseId,
            type: 'replace-id',
          });

          modified = true;
          updates.push(`   ✅ ${customId} → 更新 qase.id(${oldQaseId} → ${newQaseId})`);
        }

        // 2. 不再处理 qase.suite()，使用 test.describe() 定义层级
        // (已移除 qase.suite() 处理逻辑)
      }
      continue;
    }

    // 没有 qase.id()，添加完整的注解
    const insertPos = content.indexOf('\n', funcBodyStart) + 1;
    const annotations = generateQaseAnnotations(qaseId, suite, indent);

    replacements.push({
      position: insertPos,
      text: annotations + '\n\n',
      customId,
      qaseId,
    });

    modified = true;
    updates.push(`   ✅ ${customId} → Qase ID: ${qaseId}, Suite: ${suite || '(无)'}`);
  }

  // 从后向前处理，避免位置偏移
  replacements.sort((a, b) => b.position - a.position);

  for (const replacement of replacements) {
    if (replacement.oldText) {
      // 替换模式：替换旧内容
      const oldTextLength = replacement.oldText.length;
      content = content.substring(0, replacement.position) + replacement.text + content.substring(replacement.position + oldTextLength);
    } else {
      // 插入模式：在指定位置插入新内容
      content = content.substring(0, replacement.position) + replacement.text + content.substring(replacement.position);
    }
  }

  if (modified) {
    // 备份原文件
    const backupPath = filePath + '.backup';
    fs.writeFileSync(backupPath, fs.readFileSync(filePath));

    // 写入更新后的内容
    fs.writeFileSync(filePath, content, 'utf-8');

    console.log(`📝 更新文件: ${path.relative(PROJECT_ROOT, filePath)}`);
    updates.forEach(u => console.log(u));
    console.log(`   💾 备份: ${path.relative(PROJECT_ROOT, backupPath)}\n`);

    return updates.length;
  }

  return 0;
}

/**
 * 主函数
 */
function main() {
  console.log('🔄 自动更新 qase.id() 注解...\n');
  console.log('📌 Suite 层级由 test.describe() 嵌套结构定义\n');

  // 加载映射（仅 Qase ID，Suite 从代码实时提取）
  const qaseIdMapping = loadQaseIdMapping();
  console.log(`✅ 加载 ${Object.keys(qaseIdMapping).length} 个 Qase ID 映射\n`);

  // 扫描测试文件
  const e2eDir = path.join(PROJECT_ROOT, CONFIG.e2eDir);
  const files = fs.readdirSync(e2eDir).filter(f => f.endsWith('.spec.ts') && !f.includes('.backup'));

  let totalUpdates = 0;

  files.forEach(file => {
    const filePath = path.join(e2eDir, file);
    const updates = updateFile(filePath, qaseIdMapping);
    totalUpdates += updates;
  });

  console.log('\n📊 更新完成');
  console.log(`   ✅ 更新了 ${totalUpdates} 个测试用例\n`);

  if (totalUpdates > 0) {
    console.log('📋 下一步:');
    console.log('   1. 检查更新的文件，确认注解正确');
    console.log('   2. 运行测试验证: npm run test:e2e:smoke');
    console.log('   3. 如果有问题，可以从 .backup 文件恢复\n');
  }
}

// 如果直接运行脚本
if (require.main === module) {
  main();
}

module.exports = { loadQaseIdMapping, extractNestedDescribePath, updateFile };
