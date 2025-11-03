#!/usr/bin/env node

/**
 * 从 Qase Repository 同步 Qase ID 到本地（Code First 架构）
 *
 * 新的工作流（Code First）：
 * 1. 从 Qase API 获取所有测试用例（custom_id → qase_id）
 * 2. 更新 CSV 文件的 v2.id 列（记录/审计用途）
 * 3. 调用 update-qase-annotations.js 回写 qase.id() 到代码
 * 4. 重新生成 CSV（基于更新后的代码）
 *
 * 数据流向：Qase → CSV（记录） → 代码（唯一真实来源） → CSV（最终快照）
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { loadConfig, qaseApiRequest } = require('../lib/qase-utils');

// 项目根目录
const PROJECT_ROOT = process.cwd();


/**
 * 从 Qase 获取所有 Suites 并构建层级路径映射（支持分页）
 */
async function getAllSuites(config) {
  try {
    console.log('🔍 从 Qase 获取所有 Suites...');

    // 分页获取所有 suites
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
      if (suites.length < limit) break;

      offset += limit;
      console.log(`   已获取 ${allSuites.length} 个 Suite...`);
    }

    console.log(`   找到 ${allSuites.length} 个 Suite\n`);

    // 构建 suite_id -> suite 对象的映射
    const suiteMap = {};
    for (const suite of allSuites) {
      suiteMap[suite.id] = suite;
    }

    // 构建 suite_id -> 完整路径的映射（Playwright 格式：用 \\ 分隔）
    function buildSuitePath(suiteId) {
      const path = [];
      let currentId = suiteId;

      while (currentId) {
        const suite = suiteMap[currentId];
        if (!suite) break;
        path.unshift(suite.title);
        currentId = suite.parent_id;
      }

      return path.join('\\');
    }

    const suitePathMap = {};
    for (const suiteId in suiteMap) {
      suitePathMap[suiteId] = buildSuitePath(suiteId);
    }

    return suitePathMap;
  } catch (error) {
    console.error(`❌ 获取 Suites 失败: ${error.message}`);
    return {};
  }
}

/**
 * 从 Qase 获取所有测试用例（增强版：包含 suite 信息 + 分页支持）
 */
async function getAllTestCases(config) {
  try {
    console.log('🔍 从 Qase 获取所有测试用例...');

    // 先获取所有 suites
    const suitePathMap = await getAllSuites(config);

    // 分页获取所有测试用例
    const allCases = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const response = await qaseApiRequest(
        config,
        'GET',
        `/case/${config.qase.projectCode}?limit=${limit}&offset=${offset}`
      );

      const cases = response.result.entities || [];
      allCases.push(...cases);

      // 如果返回的数量少于limit，说明已经是最后一页
      if (cases.length < limit) break;

      offset += limit;
      console.log(`   已获取 ${allCases.length} 个测试用例...`);
    }

    console.log(`   找到 ${allCases.length} 个测试用例\n`);

    // 构建 custom_id -> {qase_id, suite_path} 映射（增强格式）
    const idMapping = {};
    for (const testCase of allCases) {
      // 查找 custom_id 字段（字段 ID 为 1）
      const customField = testCase.custom_fields?.find(f => f.id === 1);
      if (customField && customField.value) {
        idMapping[customField.value] = {
          qase_id: testCase.id,
          suite_path: suitePathMap[testCase.suite_id] || ''
        };
      }
    }

    console.log(`   构建映射: ${Object.keys(idMapping).length} 个 custom_id → {qase_id, suite_path}`);
    return idMapping;
  } catch (error) {
    console.error(`❌ 获取测试用例失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * 解析 CSV 文件
 */
function parseCsv(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // 解析表头
  const headers = lines[0].split(',').map(h => h.trim());

  // 解析数据行
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue; // 跳过空行

    const values = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];

      if (char === '"') {
        if (inQuotes && lines[i][j + 1] === '"') {
          // 转义的引号 ""
          current += '"';
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);

    rows.push(values);
  }

  return { headers, rows };
}

/**
 * 转义 CSV 值
 */
function escapeCsvValue(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const strValue = String(value);

  if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
    return `"${strValue.replace(/"/g, '""')}"`;
  }

  return strValue;
}

/**
 * 生成 CSV 内容
 */
function generateCsv(headers, rows) {
  const lines = [headers.join(',')];

  for (const row of rows) {
    const escapedRow = row.map(v => escapeCsvValue(v));
    lines.push(escapedRow.join(','));
  }

  return lines.join('\n');
}

/**
 * 更新 CSV 文件的 v2.id 列
 */
function updateCsvWithQaseIds(csvPath, idMapping) {
  console.log('\n📝 更新 CSV 文件...');

  // 解析 CSV
  const { headers, rows } = parseCsv(csvPath);

  if (headers.length === 0) {
    console.error('❌ CSV 文件为空或格式错误');
    return false;
  }

  // 找到关键列的索引
  const v2IdIndex = headers.findIndex(h => h === 'v2.id');
  const customIdIndex = headers.findIndex(h => h === 'custom_id');

  if (v2IdIndex === -1 || customIdIndex === -1) {
    console.error('❌ CSV 文件缺少必需的列: v2.id 或 custom_id');
    return false;
  }

  // 更新每一行
  let updatedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const customId = row[customIdIndex]?.trim();

    if (!customId) {
      // 跳过没有 custom_id 的行（可能是 Suite 行）
      skippedCount++;
      continue;
    }

    const mapping = idMapping[customId];
    if (mapping) {
      // 兼容新旧格式
      const qaseId = mapping.qase_id || mapping;
      row[v2IdIndex] = String(qaseId);
      updatedCount++;
      console.log(`   ✅ ${customId} → Qase ID: ${qaseId}`);
    } else {
      console.warn(`   ⚠️  未找到映射: ${customId}`);
    }
  }

  // 生成新的 CSV 内容
  const newContent = generateCsv(headers, rows);

  // 备份原文件
  const backupPath = `${csvPath}.backup`;
  fs.copyFileSync(csvPath, backupPath);
  console.log(`\n💾 原文件已备份: ${backupPath}`);

  // 写入更新后的文件
  fs.writeFileSync(csvPath, newContent, 'utf-8');
  console.log(`✅ CSV 文件已更新: ${csvPath}`);
  console.log(`   更新了 ${updatedCount} 个测试用例`);
  console.log(`   跳过了 ${skippedCount} 行（Suite 或空行）`);

  return true;
}

/**
 * 主函数
 */
async function main() {
  console.log('🔄 从 Qase 同步 ID 到本地 CSV\n');

  const config = loadConfig();
  const csvPath = path.join(PROJECT_ROOT, config.outputDir, config.csvFileName);

  // 检查 CSV 文件是否存在
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV 文件不存在: ${csvPath}`);
    console.error('   请先运行: node generate-csv.js');
    process.exit(1);
  }

  // 从 Qase 获取 ID 映射
  const idMapping = await getAllTestCases(config);

  if (Object.keys(idMapping).length === 0) {
    console.warn('\n⚠️  未找到任何 custom_id 映射');
    console.warn('   请确保已在 Qase 中创建测试用例');
    process.exit(1);
  }

  // 步骤 1: 更新 CSV 文件（临时记录，用于下一步）
  const success = updateCsvWithQaseIds(csvPath, idMapping);

  if (!success) {
    console.error('\n❌ CSV 更新失败');
    process.exit(1);
  }

  // 步骤 2: 回写 qase.id() 到代码（Code First - 代码是唯一真实来源）
  console.log('\n📝 步骤 2/3: 回写 Qase ID 到测试代码...');
  try {
    const scriptDir = __dirname;
    execSync(`node "${path.join(scriptDir, 'update-qase-annotations.js')}"`, {
      stdio: 'inherit',
      cwd: PROJECT_ROOT
    });
    console.log('✅ 代码更新完成');
  } catch (error) {
    console.error('❌ 代码更新失败:', error.message);
    process.exit(1);
  }

  // 步骤 3: 重新生成 CSV（基于更新后的代码，生成最终快照）
  console.log('\n📄 步骤 3/3: 重新生成 CSV（基于更新后的代码）...');
  try {
    const scriptDir = __dirname;
    execSync(`node "${path.join(scriptDir, 'generate-csv.js')}"`, {
      stdio: 'inherit',
      cwd: PROJECT_ROOT
    });
    console.log('✅ CSV 重新生成完成');
  } catch (error) {
    console.error('❌ CSV 生成失败:', error.message);
    process.exit(1);
  }

  console.log('\n✨ 同步完成！');
  console.log('\n📋 数据流向:');
  console.log('   Qase → 代码（qase.id()）→ CSV（最终快照）');
  console.log('\n📋 下一步:');
  console.log('   - 代码已包含 Qase ID（qase.id()）');
  console.log('   - CSV 文件已更新（用于版本控制和审计）');
  console.log('   - 可以提交代码和 CSV 到 Git');
}

// 执行
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ 同步失败:', error.message);
    process.exit(1);
  });
}

module.exports = { main, getAllTestCases, updateCsvWithQaseIds };
