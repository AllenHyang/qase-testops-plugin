#!/usr/bin/env node

/**
 * 获取 Qase 项目的自定义字段列表
 * 用于查找 Last Run Result 等字段的 ID
 */

const { loadConfig, qaseApiRequest } = require('../lib/qase-utils');


/**
 * 获取项目信息（包含自定义字段）
 */
async function getProjectCustomFields(config) {
  try {
    // 方法1: 获取项目信息
    console.log('📋 尝试获取项目信息...\n');
    const project = await qaseApiRequest(
      config,
      'GET',
      `/project/${config.qase.projectCode}`
    );

    if (project.result && project.result.counts) {
      console.log('✅ 项目信息:');
      console.log(`   项目代码: ${config.qase.projectCode}`);
      console.log(`   测试用例数: ${project.result.counts.cases}`);
      console.log('');
    }

    // 方法2: 通过测试用例查看字段结构
    console.log('📋 获取测试用例示例以查看自定义字段...\n');
    const cases = await qaseApiRequest(
      config,
      'GET',
      `/case/${config.qase.projectCode}?limit=5`
    );

    if (cases.result && cases.result.entities) {
      const allFieldIds = new Set();
      const fieldExamples = {};

      cases.result.entities.forEach(testCase => {
        if (testCase.custom_fields && Array.isArray(testCase.custom_fields)) {
          testCase.custom_fields.forEach(field => {
            allFieldIds.add(field.id);
            if (!fieldExamples[field.id]) {
              fieldExamples[field.id] = {
                id: field.id,
                examples: []
              };
            }
            if (fieldExamples[field.id].examples.length < 3) {
              fieldExamples[field.id].examples.push({
                caseId: testCase.id,
                value: field.value
              });
            }
          });
        }
      });

      console.log('================================================================================');
      console.log('📊 发现的自定义字段');
      console.log('================================================================================\n');

      if (allFieldIds.size === 0) {
        console.log('⚠️  未发现任何自定义字段');
        console.log('   这可能意味着：');
        console.log('   1. 项目中没有配置自定义字段');
        console.log('   2. 测试用例中未使用自定义字段\n');
      } else {
        Array.from(allFieldIds).sort((a, b) => a - b).forEach(fieldId => {
          console.log(`字段 ID: ${fieldId}`);
          console.log('示例值:');
          fieldExamples[fieldId].examples.forEach(ex => {
            console.log(`  - Case ${ex.caseId}: "${ex.value}"`);
          });
          console.log('');
        });
      }

      console.log('================================================================================');
      console.log('💡 如何找到 Last Run Result 字段 ID');
      console.log('================================================================================\n');
      console.log('方法 1: 通过 Qase Web UI');
      console.log('  1. 访问 https://app.qase.io/project/' + config.qase.projectCode);
      console.log('  2. 进入 Settings → Fields → Custom fields');
      console.log('  3. 找到 "Last Run Result" 字段');
      console.log('  4. 查看字段的 ID (通常在 URL 或详情中)\n');
      console.log('方法 2: 手动测试');
      console.log('  1. 手动编辑一个测试用例，设置 Last Run Result 值');
      console.log('  2. 重新运行此脚本');
      console.log('  3. 查看新出现的字段 ID\n');
      console.log('方法 3: 联系管理员');
      console.log('  询问项目管理员 Last Run Result 的字段 ID\n');

      return allFieldIds;
    }
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🔍 获取 Qase 自定义字段信息\n');
  const config = loadConfig();
  await getProjectCustomFields(config);
}

// 执行
if (require.main === module) {
  main().catch(err => {
    console.error('❌ 错误:', err.message);
    process.exit(1);
  });
}

module.exports = { getProjectCustomFields };
