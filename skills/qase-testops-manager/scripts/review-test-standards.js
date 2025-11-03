#!/usr/bin/env node

/**
 * Qase 测试代码规范审核工具
 *
 * 检查测试代码是否符合规范：
 * 1. Custom ID 格式 (TC-{LAYER}-{MODULE}-{NUMBER}) - 必需
 * 2. import { qase } 声明 - 必需
 * 3. test.describe() 嵌套 - 强烈推荐（用于定义 Suite 层级）
 * 4. test.step() 使用 - 推荐（定义测试步骤）
 * 5. test.step() 格式 - 推荐（每个 step 建议包含 Action 和 Expected 注释）
 *    示例：
 *    await test.step('准备测试数据', async () => {
 *      // Action: 创建测试账号并预填充50封邮件
 *      // Expected: 账号创建成功，同步完成，邮件数量=50
 *      // ...
 *    })
 * 6. JSDoc 注释 - 推荐（@description, @preconditions, @postconditions）
 * 7. qase.id() 注解 - 自动管理（首次同步后自动添加，检查为警告级别）
 *
 * Code First 原则：
 * - Suite 层级由 test.describe() 嵌套定义，不使用 qase.suite()
 * - qase.id() 由同步工具自动管理，无需手动编写
 */

const fs = require('fs');
const path = require('path');
const { loadConfig } = require('../lib/qase-utils');

const CONFIG = loadConfig();
const E2E_DIR = path.join(process.cwd(), CONFIG.e2eDir);

// Custom ID 格式规范
const CUSTOM_ID_PATTERN = /TC-(?:API|UI|E2E|INT|PERF)-(?:[A-Z]+)-\d{3}/;

// 审核规则
const RULES = {
  CUSTOM_ID_FORMAT: 'Custom ID 格式必须为 TC-{LAYER}-{MODULE}-{NUMBER}',
  QASE_IMPORT: '必须导入 qase: import { qase } from "playwright-qase-reporter"',
  QASE_ID_ANNOTATION: 'qase.id() 注解（首次同步后自动添加）',
  TEST_DESCRIBE_NESTING: '强烈建议使用 test.describe() 嵌套来定义 Suite 层级（Code First）',
  TEST_STEP_USAGE: '建议使用 test.step() 定义测试步骤（推荐）',
  TEST_STEP_FORMAT: '建议每个 test.step() 包含 Action 和 Expected 注释（推荐）',
  JSDOC_DESCRIPTION: '建议添加 @description 说明测试目的（推荐）',
  JSDOC_PRECONDITIONS: '建议添加 @preconditions 说明前置条件（推荐）',
  JSDOC_POSTCONDITIONS: '建议添加 @postconditions 说明后置条件（推荐）',
};

// 审核结果
class TestAudit {
  constructor(filePath) {
    this.filePath = filePath;
    this.fileName = path.basename(filePath);
    this.issues = [];
    this.warnings = [];
    this.passed = [];
    this.tests = [];
  }

  addIssue(rule, line, message) {
    this.issues.push({ rule, line, message });
  }

  addWarning(rule, line, message) {
    this.warnings.push({ rule, line, message });
  }

  addPassed(rule, message) {
    this.passed.push({ rule, message });
  }

  addTest(testInfo) {
    this.tests.push(testInfo);
  }

  get hasIssues() {
    return this.issues.length > 0;
  }

  get score() {
    const total = this.passed.length + this.issues.length;
    return total === 0 ? 100 : Math.round((this.passed.length / total) * 100);
  }
}

/**
 * 提取测试信息
 */
function extractTestInfo(fileContent, filePath) {
  const lines = fileContent.split('\n');
  const tests = [];
  const describePath = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // 提取 test.describe
    const describeMatch = line.match(/test\.describe\(['"`]([^'"`]+)['"`]/);
    if (describeMatch) {
      describePath.push(describeMatch[1]);
    }

    // 提取测试用例
    const testMatch = line.match(/test\(['"`](TC-[^'"`]+)['"`]/);
    if (testMatch) {
      const customId = testMatch[1].split(':')[0].trim();
      const fullTitle = testMatch[1];

      // 查找该测试的 qase.id()
      let qaseId = null;
      let qaseSuite = null;
      let hasSteps = false;
      let stepsWithoutFormat = []; // 记录缺少 Action/Expected 的 step

      // 扫描测试体，查找所有内容（需要找到测试函数结束位置）
      let testEndLine = lines.length;
      let braceCount = 0;
      let foundStart = false;

      // 从当前行开始，因为 test() 可能跨多行
      for (let j = i; j < lines.length; j++) {
        const nextLine = lines[j];

        // 计算大括号来确定测试函数范围
        const openBraces = (nextLine.match(/\{/g) || []).length;
        const closeBraces = (nextLine.match(/\}/g) || []).length;

        braceCount += openBraces;
        if (openBraces > 0) {
          foundStart = true;
        }

        braceCount -= closeBraces;

        // 当找到第一个 { 后，如果大括号归零，说明测试函数结束
        if (foundStart && braceCount === 0) {
          testEndLine = j;
          break;
        }
      }

      // 在测试函数范围内查找
      for (let j = i + 1; j < testEndLine; j++) {
        const nextLine = lines[j];

        // 查找 qase.id()
        const idMatch = nextLine.match(/qase\.id\((\d+)\)/);
        if (idMatch) {
          qaseId = idMatch[1];
        }

        // 查找 qase.suite()
        const suiteMatch = nextLine.match(/qase\.suite\(['"`]([^'"`]+)['"`]\)/);
        if (suiteMatch) {
          qaseSuite = suiteMatch[1];
        }

        // 检查是否有 test.step()
        if (nextLine.includes('test.step(')) {
          hasSteps = true;

          // 检查这个 step 是否有 Action 和 Expected 注释
          const stepMatch = nextLine.match(/test\.step\(['"`]([^'"`]+)['"`]/);
          const stepName = stepMatch ? stepMatch[1] : 'unknown';

          // 向下查找这个 step 的内容（最多30行）
          let hasAction = false;
          let hasExpected = false;
          let stepEndLine = Math.min(j + 30, testEndLine);

          // 找到这个 step 的结束位置（通过括号匹配）
          let stepBraceCount = 0;
          let stepStarted = false;

          for (let k = j; k < testEndLine; k++) {
            const stepLine = lines[k];

            if (stepLine.includes('{')) {
              stepBraceCount += (stepLine.match(/\{/g) || []).length;
              stepStarted = true;
            }
            if (stepLine.includes('}')) {
              stepBraceCount -= (stepLine.match(/\}/g) || []).length;
              if (stepStarted && stepBraceCount <= 0) {
                stepEndLine = k;
                break;
              }
            }

            // 检查是否有 Action 和 Expected 注释
            if (/\/\/\s*Action:/i.test(stepLine)) {
              hasAction = true;
            }
            if (/\/\/\s*Expected:/i.test(stepLine)) {
              hasExpected = true;
            }
          }

          // 如果缺少 Action 或 Expected，记录下来
          if (!hasAction || !hasExpected) {
            stepsWithoutFormat.push({
              line: j + 1,
              name: stepName,
              missingAction: !hasAction,
              missingExpected: !hasExpected
            });
          }
        }
      }

      // 向上查找 JSDoc 注释
      let hasDescription = false;
      let hasPreconditions = false;
      let hasPostconditions = false;
      let jsdocStartLine = -1;

      // 向上扫描查找 JSDoc (最多向上 30 行)
      for (let j = i - 1; j >= Math.max(0, i - 30); j--) {
        const prevLine = lines[j].trim();

        // 找到 JSDoc 结束标记
        if (prevLine === '*/') {
          jsdocStartLine = j;

          // 向上查找 JSDoc 开始标记和内容
          for (let k = j - 1; k >= 0; k--) {
            const jsdocLine = lines[k];

            if (jsdocLine.includes('/**')) {
              // 找到 JSDoc 开始，提取内容
              const jsdocContent = lines.slice(k, j + 1).join('\n');
              hasDescription = /@description/.test(jsdocContent);
              hasPreconditions = /@preconditions/.test(jsdocContent);
              hasPostconditions = /@postconditions/.test(jsdocContent);
              break;
            }
          }
          break;
        }

        // 如果遇到代码行（非注释、非空行），停止查找
        if (prevLine && !prevLine.startsWith('//') && !prevLine.startsWith('*')) {
          break;
        }
      }

      tests.push({
        customId,
        fullTitle,
        lineNum,
        qaseId,
        qaseSuite,
        hasSteps,
        stepsWithoutFormat, // 缺少格式的 step 列表
        hasDescription,
        hasPreconditions,
        hasPostconditions,
        describePath: [...describePath],
      });
    }

    // 追踪大括号闭合（简化版）
    const closeBraces = (line.match(/\}/g) || []).length;
    if (closeBraces > 0 && describePath.length > 0) {
      describePath.pop();
    }
  }

  return tests;
}

/**
 * 审核单个文件
 */
function auditFile(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const audit = new TestAudit(filePath);

  // 1. 检查 import { qase }
  const hasQaseImport = /import\s+\{[^}]*qase[^}]*\}\s+from\s+['"]playwright-qase-reporter['"]/.test(fileContent);
  const usesQase = /qase\.(id|suite|title|attach|ignore)/.test(fileContent);

  if (usesQase && !hasQaseImport) {
    audit.addIssue(RULES.QASE_IMPORT, 1, '使用了 qase.* 但缺少 import 声明');
  } else if (hasQaseImport) {
    audit.addPassed(RULES.QASE_IMPORT, '✓ 正确导入 qase');
  }

  // 2. 提取测试信息
  const tests = extractTestInfo(fileContent, filePath);
  tests.forEach(test => audit.addTest(test));

  // 3. 检查每个测试
  tests.forEach(test => {
    // 检查 Custom ID 格式
    if (!CUSTOM_ID_PATTERN.test(test.customId)) {
      audit.addIssue(
        RULES.CUSTOM_ID_FORMAT,
        test.lineNum,
        `"${test.customId}" 不符合格式 TC-{LAYER}-{MODULE}-{NUMBER}`
      );
    } else {
      audit.addPassed(RULES.CUSTOM_ID_FORMAT, `✓ ${test.customId} 格式正确`);
    }

    // 检查 qase.id()（自动管理，首次同步后会自动添加）
    if (!test.qaseId) {
      audit.addWarning(
        RULES.QASE_ID_ANNOTATION,
        test.lineNum,
        `"${test.customId}" 缺少 qase.id() 注解（首次同步后会自动添加）`
      );
    } else {
      audit.addPassed(RULES.QASE_ID_ANNOTATION, `✓ ${test.customId} 有 qase.id(${test.qaseId})`);
    }

    // 检查 test.describe() 嵌套（强烈推荐，用于定义 Suite 层级）
    if (test.describePath.length === 0) {
      audit.addWarning(
        RULES.TEST_DESCRIBE_NESTING,
        test.lineNum,
        `"${test.customId}" 没有 test.describe() 包裹（强烈推荐用于定义 Suite 层级）`
      );
    } else {
      audit.addPassed(
        RULES.TEST_DESCRIBE_NESTING,
        `✓ ${test.customId} 在 "${test.describePath.join(' / ')}" 中`
      );
    }

    // 检查 test.step()（推荐）
    if (!test.hasSteps) {
      audit.addWarning(
        RULES.TEST_STEP_USAGE,
        test.lineNum,
        `"${test.customId}" 未使用 test.step() 定义步骤（推荐使用）`
      );
    } else {
      audit.addPassed(RULES.TEST_STEP_USAGE, `✓ ${test.customId} 使用了 test.step()`);

      // 检查每个 step 是否有 Action 和 Expected 格式（推荐）
      if (test.stepsWithoutFormat && test.stepsWithoutFormat.length > 0) {
        test.stepsWithoutFormat.forEach(step => {
          const missing = [];
          if (step.missingAction) missing.push('Action');
          if (step.missingExpected) missing.push('Expected');

          audit.addWarning(
            RULES.TEST_STEP_FORMAT,
            step.line,
            `Step "${step.name}" 建议添加 ${missing.join(' 和 ')} 注释`
          );
        });
      } else if (test.hasSteps) {
        audit.addPassed(RULES.TEST_STEP_FORMAT, `✓ ${test.customId} 所有 step 都有 Action/Expected 格式`);
      }
    }

    // 检查 JSDoc @description（推荐）
    if (!test.hasDescription) {
      audit.addWarning(
        RULES.JSDOC_DESCRIPTION,
        test.lineNum,
        `"${test.customId}" 建议添加 @description 说明测试目的`
      );
    } else {
      audit.addPassed(RULES.JSDOC_DESCRIPTION, `✓ ${test.customId} 有 @description`);
    }

    // 检查 JSDoc @preconditions（推荐）
    if (!test.hasPreconditions) {
      audit.addWarning(
        RULES.JSDOC_PRECONDITIONS,
        test.lineNum,
        `"${test.customId}" 建议添加 @preconditions 说明前置条件`
      );
    } else {
      audit.addPassed(RULES.JSDOC_PRECONDITIONS, `✓ ${test.customId} 有 @preconditions`);
    }

    // 检查 JSDoc @postconditions（推荐）
    if (!test.hasPostconditions) {
      audit.addWarning(
        RULES.JSDOC_POSTCONDITIONS,
        test.lineNum,
        `"${test.customId}" 建议添加 @postconditions 说明后置条件`
      );
    } else {
      audit.addPassed(RULES.JSDOC_POSTCONDITIONS, `✓ ${test.customId} 有 @postconditions`);
    }
  });

  return audit;
}

/**
 * 打印审核报告
 */
function printAudit(audit) {
  console.log('\n' + '='.repeat(80));
  console.log(`📄 文件: ${audit.fileName}`);
  console.log(`📊 评分: ${audit.score}/100 | 测试数量: ${audit.tests.length}`);
  console.log('='.repeat(80));

  if (audit.issues.length > 0) {
    console.log('\n❌ 问题 (必须修复):');
    audit.issues.forEach(issue => {
      console.log(`  行 ${issue.line}: ${issue.message}`);
      console.log(`  规则: ${issue.rule}`);
    });
  }

  if (audit.warnings.length > 0) {
    console.log('\n⚠️  警告 (建议改进):');
    audit.warnings.forEach(warning => {
      console.log(`  行 ${warning.line}: ${warning.message}`);
      console.log(`  规则: ${warning.rule}`);
    });
  }

  if (audit.passed.length > 0 && (audit.issues.length === 0 && audit.warnings.length === 0)) {
    console.log('\n✅ 全部通过:');
    audit.passed.slice(0, 5).forEach(p => {
      console.log(`  ${p.message}`);
    });
    if (audit.passed.length > 5) {
      console.log(`  ... 还有 ${audit.passed.length - 5} 项通过`);
    }
  }

  console.log('');
}

/**
 * 生成汇总报告
 */
function printSummary(audits) {
  const totalFiles = audits.length;
  const totalTests = audits.reduce((sum, a) => sum + a.tests.length, 0);
  const filesWithIssues = audits.filter(a => a.hasIssues).length;
  const avgScore = Math.round(audits.reduce((sum, a) => sum + a.score, 0) / totalFiles);

  console.log('\n' + '='.repeat(80));
  console.log('📊 总体报告');
  console.log('='.repeat(80));
  console.log(`总文件数: ${totalFiles}`);
  console.log(`总测试数: ${totalTests}`);
  console.log(`有问题的文件: ${filesWithIssues}`);
  console.log(`平均评分: ${avgScore}/100`);
  console.log('='.repeat(80));

  // 按评分排序
  const sorted = [...audits].sort((a, b) => a.score - b.score);

  if (filesWithIssues > 0) {
    console.log('\n🔍 需要关注的文件:');
    sorted.filter(a => a.hasIssues).slice(0, 10).forEach((a, i) => {
      console.log(`  ${i + 1}. ${a.fileName} (${a.score}/100) - ${a.issues.length} 个问题`);
    });
  } else {
    console.log('\n🎉 所有文件都符合规范！');
  }
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  const fileArg = args[0];

  let files = [];

  if (fileArg) {
    // 审核单个文件
    const filePath = path.resolve(fileArg);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ 文件不存在: ${filePath}`);
      process.exit(1);
    }
    files = [filePath];
  } else {
    // 审核所有 E2E 测试文件
    if (!fs.existsSync(E2E_DIR)) {
      console.error(`❌ E2E 目录不存在: ${E2E_DIR}`);
      process.exit(1);
    }

    files = fs.readdirSync(E2E_DIR)
      .filter(f => f.endsWith('.spec.ts') || f.endsWith('.spec.js'))
      .map(f => path.join(E2E_DIR, f));
  }

  console.log(`\n🔍 开始审核 ${files.length} 个测试文件...\n`);

  const audits = files.map(auditFile);
  audits.forEach(printAudit);

  if (files.length > 1) {
    printSummary(audits);
  }

  // 退出码
  const hasIssues = audits.some(a => a.hasIssues);
  process.exit(hasIssues ? 1 : 0);
}

main();
