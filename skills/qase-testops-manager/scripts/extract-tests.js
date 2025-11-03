#!/usr/bin/env node

/**
 * 从E2E测试文件中提取测试用例信息
 *
 * 提取内容：
 * - 测试ID (TC-XXX-NNN)
 * - 测试标题
 * - 测试描述（从注释中提取）
 * - 测试步骤（从test.step()中提取）
 * - 测试套件（从文件名或describe中提取）
 */

const fs = require('fs');
const path = require('path');

// 项目根目录
const PROJECT_ROOT = process.cwd();

/**
 * 加载配置文件
 */
function loadConfig() {
  const configPath = path.join(PROJECT_ROOT, '.qase-config.json');

  // 默认配置
  const defaultConfig = {
    e2eDir: 'e2e/specs',
    outputDir: 'e2e/qase',
    csvFileName: 'qase-test-cases.csv',
    jsonFileName: 'qase-test-cases.json',
    testIdPattern: 'TC-(?:SYNC|API|UI|AI|TAG|ARCH|SEARCH|WORK|EDGE|WS)-\\d+',
    excludeFiles: ['*.old.ts', '*.backup.ts']
  };

  // 如果配置文件存在，合并配置
  if (fs.existsSync(configPath)) {
    try {
      const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return { ...defaultConfig, ...userConfig };
    } catch (error) {
      console.warn(`⚠️  读取配置文件失败，使用默认配置: ${error.message}`);
      return defaultConfig;
    }
  }

  return defaultConfig;
}

const CONFIG = loadConfig();
const E2E_DIR = path.join(PROJECT_ROOT, CONFIG.e2eDir);

/**
 * 测试ID模式：TC-{LAYER}-{MODULE}-{NUMBER}
 * LAYER: 2-8个大写字母或数字 (API, UI, E2E, INT, PERF等)
 * MODULE: 2-12个大写字母 (SYNC, INBOX, ACCOUNT等)
 * NUMBER: 3位数字 (001-999)
 */
const STANDARD_ID_PATTERN = /^TC-[A-Z0-9]{2,8}-[A-Z]{2,12}-\d{3}$/;
const TEST_ID_PATTERN = /test\(['"`]([^:'"]+):\s*([^'"`]+)['"]/g;

/**
 * 验证 Custom ID 格式
 */
function validateCustomId(customId) {
  if (!customId || customId.trim() === '') {
    return {
      valid: false,
      error: 'Custom ID is required and cannot be empty'
    };
  }

  const trimmedId = customId.trim();

  if (!STANDARD_ID_PATTERN.test(trimmedId)) {
    return {
      valid: false,
      error: `Invalid format. Expected: TC-{LAYER}-{MODULE}-{NUMBER} (e.g., TC-API-SYNC-001). Got: ${trimmedId}`
    };
  }

  return { valid: true };
}

/**
 * 从测试文件中提取测试步骤
 */
/**
 * 从测试内容中提取步骤（支持详细格式）
 *
 * 支持的格式：
 * 1. 简单格式：'操作描述'
 * 2. 带数据：'操作描述 | 测试数据'
 * 3. 完整格式：'操作描述 | 测试数据 | 期望结果'
 *
 * @param {string} testContent - 测试内容
 * @returns {Array} - 步骤对象数组 [{action, data, expected_result}]
 */
function extractSteps(testContent) {
  const steps = [];
  const stepPattern = /await\s+test\.step\(['"`]([^'"`]+)['"`]/g;

  let match;
  while ((match = stepPattern.exec(testContent)) !== null) {
    const stepText = match[1].trim();

    // 使用 | 分隔符解析步骤
    const parts = stepText.split('|').map(p => p.trim());

    const step = {
      action: parts[0] || stepText,  // 第一部分是 action
      data: parts[1] || '',            // 第二部分是 data（可选）
      expected_result: parts[2] || ''  // 第三部分是 expected_result（可选）
    };

    steps.push(step);
  }

  return steps;
}

/**
 * 从文件顶部提取描述注释
 */
function extractDescription(fileContent) {
  // 匹配文件顶部的/** ... */注释块
  const descPattern = /^\/\*\*\s*\n([\s\S]*?)\*\//;
  const match = fileContent.match(descPattern);

  if (match) {
    // 清理注释标记，保留内容
    return match[1]
      .split('\n')
      .map(line => line.replace(/^\s*\*\s?/, '').trim())
      .filter(line => line.length > 0)
      .join('\n');
  }

  return '';
}

/**
 * 从测试前的 JSDoc 注释中提取元数据
 * @param {string} fileContent - 文件内容
 * @param {string} testId - 测试 ID
 * @returns {Object} { description, preconditions, postconditions }
 */
function extractTestJSDoc(fileContent, testId) {
  const result = {
    description: '',
    preconditions: '',
    postconditions: ''
  };

  // 转义正则特殊字符
  const escapedId = testId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

  // 找到测试定义的位置
  const testPattern = new RegExp(`test\\(['\`"]${escapedId}:`, 's');
  const testMatch = testPattern.exec(fileContent);

  if (!testMatch) {
    return result;
  }

  // 在测试定义之前查找 JSDoc 注释
  const beforeTest = fileContent.substring(0, testMatch.index);

  // 从后往前找最近的 JSDoc 注释块
  const jsdocPattern = /\/\*\*\s*\n([\s\S]*?)\*\/\s*$/;
  const jsdocMatch = beforeTest.match(jsdocPattern);

  if (!jsdocMatch) {
    return result;
  }

  const jsdocContent = jsdocMatch[1];
  const lines = jsdocContent.split('\n');

  let currentTag = null;
  let currentContent = [];

  for (const line of lines) {
    // 移除行首的 * 和空格
    const cleanLine = line.replace(/^\s*\*\s?/, '').trim();

    if (cleanLine.startsWith('@description')) {
      if (currentTag) {
        result[currentTag] = currentContent.join('\n').trim();
      }
      currentTag = 'description';
      currentContent = [cleanLine.replace('@description', '').trim()];
    } else if (cleanLine.startsWith('@preconditions')) {
      if (currentTag) {
        result[currentTag] = currentContent.join('\n').trim();
      }
      currentTag = 'preconditions';
      currentContent = [];
    } else if (cleanLine.startsWith('@postconditions')) {
      if (currentTag) {
        result[currentTag] = currentContent.join('\n').trim();
      }
      currentTag = 'postconditions';
      currentContent = [];
    } else if (cleanLine && currentTag) {
      currentContent.push(cleanLine);
    }
  }

  // 保存最后一个 tag 的内容
  if (currentTag) {
    result[currentTag] = currentContent.join('\n').trim();
  }

  return result;
}

/**
 * 提取测试的原始 JSDoc 文本内容（用于字段检测）
 * @param {string} fileContent - 文件内容
 * @param {string} testId - 测试 ID
 * @returns {string} - 原始 JSDoc 文本，如果没有则返回空字符串
 */
function extractRawJSDoc(fileContent, testId) {
  // 转义正则特殊字符
  const escapedId = testId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

  // 找到测试定义的位置
  const testPattern = new RegExp(`test\\(['\`"]${escapedId}:`, 's');
  const testMatch = testPattern.exec(fileContent);

  if (!testMatch) {
    return '';
  }

  // 在测试定义之前查找 JSDoc 注释
  const beforeTest = fileContent.substring(0, testMatch.index);

  // 从后往前找最近的 JSDoc 注释块
  const jsdocPattern = /\/\*\*\s*\n([\s\S]*?)\*\/\s*$/;
  const jsdocMatch = beforeTest.match(jsdocPattern);

  if (!jsdocMatch) {
    return '';
  }

  // 返回原始 JSDoc 内容（包括所有标签）
  return jsdocMatch[1];
}

/**
 * 根据 Custom ID 映射到标准 Suite
 * 格式: TC-{LAYER}-{MODULE}-{NUMBER} → {LAYER} Tests / {MODULE}
 */
/**
 * ❌ 已移除 mapCustomIdToSuite() 函数
 *
 * Code First 原则：Suite 层级必须从 test.describe() 提取，不允许硬编码映射
 */

/**
 * 从测试文件中提取嵌套的 test.describe() 路径
 *
 * 示例:
 * test.describe('API Tests', () => {
 *   test.describe('Contract Validation', () => {
 *     test('TC-API-CONTRACT-001: ...', () => {});
 *   });
 * });
 *
 * 返回: "API Tests / Contract Validation"
 *
 * 策略：基于括号匹配确定层级，不依赖缩进
 */
function extractNestedDescribePath(fileContent, testId) {
  // 转义 testId 用于正则表达式
  const escapedId = testId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 找到测试定义的位置
  const testPattern = new RegExp(`test\\(['\"\`]${escapedId}:`);
  const testMatch = testPattern.exec(fileContent);

  if (!testMatch) {
    return null;
  }

  const testStartPos = testMatch.index;

  // 从文件开头到测试位置，查找所有 test.describe()
  const beforeTest = fileContent.substring(0, testStartPos);
  const describePattern = /test\.describe\(['"` ]([^'"`]+)['"` ]/g;

  // 收集所有 describe 及其位置
  const allDescribes = [];
  let match;
  while ((match = describePattern.exec(beforeTest)) !== null) {
    allDescribes.push({
      name: match[1].trim(),
      startPos: match.index,
      endPos: match.index + match[0].length
    });
  }

  if (allDescribes.length === 0) {
    return null;
  }

  // 对每个 describe，计算从其位置到测试位置的括号平衡
  // 如果括号未闭合（balance > 0），说明测试在这个 describe 内部
  const parentDescribes = [];

  for (const describe of allDescribes) {
    // 从 describe 的结束位置到测试开始位置
    const segment = fileContent.substring(describe.endPos, testStartPos);

    // 计算括号平衡（忽略字符串和注释中的括号）
    let balance = 0;
    let inString = false;
    let stringChar = '';
    let inSingleComment = false;
    let inMultiComment = false;

    for (let i = 0; i < segment.length; i++) {
      const char = segment[i];
      const prevChar = i > 0 ? segment[i - 1] : '';
      const nextChar = i < segment.length - 1 ? segment[i + 1] : '';

      // 处理注释
      if (!inString && char === '/' && nextChar === '/') {
        inSingleComment = true;
        continue;
      }
      if (inSingleComment && char === '\n') {
        inSingleComment = false;
        continue;
      }
      if (!inString && char === '/' && nextChar === '*') {
        inMultiComment = true;
        continue;
      }
      if (inMultiComment && char === '*' && nextChar === '/') {
        inMultiComment = false;
        i++; // skip the '/'
        continue;
      }

      // 处理字符串
      if (!inSingleComment && !inMultiComment) {
        if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
            stringChar = '';
          }
        }
      }

      // 计算括号（只在非字符串、非注释中）
      if (!inString && !inSingleComment && !inMultiComment) {
        if (char === '(' || char === '{') {
          balance++;
        } else if (char === ')' || char === '}') {
          balance--;
        }
      }
    }

    // 如果 balance > 0，说明这个 describe 还没闭合，测试在其内部
    if (balance > 0) {
      parentDescribes.push(describe);
    }
  }

  // 按照在文件中出现的顺序排序（外层在前）
  parentDescribes.sort((a, b) => a.startPos - b.startPos);

  // 返回路径
  return parentDescribes.length > 0
    ? parentDescribes.map(d => d.name).join(' / ')
    : null;
}

/**
 * 从测试文件中提取Suite名称
 */
/**
 * 从测试用例中提取 qase.suite() 指定的 suite 路径
 * @param {string} fileContent - 文件内容
 * @param {string} customId - 测试 Custom ID
 * @returns {string|null} - Suite 路径（使用 \t 作为层级分隔符），如果未找到返回 null
 *
 * 注意：playwright-qase-reporter 使用 \t (tab 字符) 作为 Suite 层级分隔符
 * 例如：'E2E Tests\tArchive' 会被解析为两层嵌套（E2E Tests > Archive）
 */
function extractQaseSuite(fileContent, customId) {
  if (!customId) return null;

  // 转义正则特殊字符
  const escapedId = customId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

  // 找到测试定义
  const testPattern = new RegExp(`test\\(['\`"]${escapedId}:.*?\\{`, 's');
  const testMatch = testPattern.exec(fileContent);

  if (!testMatch) return null;

  // 在测试定义后查找 qase.suite()
  const afterTest = fileContent.substring(testMatch.index);

  // 匹配 qase.suite('...') 或 qase.suite("...")
  // \t 在 JavaScript 字符串中会被自动转换为真正的 tab 字符（ASCII 9）
  const qaseSuitePattern = /qase\.suite\(['\"]([^'\"]+)['\"]\)/;
  const match = afterTest.match(qaseSuitePattern);

  if (match) {
    return match[1]; // 返回 suite 路径（包含 \t 作为层级分隔符）
  }

  return null;
}

function extractSuite(fileContent, fileName, customId, config) {
  // Code First: 只从 test.describe() 嵌套结构提取 Suite 路径
  if (customId) {
    const nestedPath = extractNestedDescribePath(fileContent, customId);
    if (nestedPath) {
      return nestedPath;
    }
  }

  // ❌ Code First 原则：如果无法从 test.describe() 提取，报错而不是回退
  throw new Error(`❌ 无法从 test.describe() 提取 Suite 路径！
    文件: ${fileName}
    测试ID: ${customId}

    请确保测试使用了 test.describe() 嵌套结构定义 Suite 层级。

    正确示例:
    test.describe('E2E Tests', () => {
      test.describe('Archive', () => {
        test('${customId}: ...', async () => {
          // 测试内容
        });
      });
    });
  `);
}

/**
 * 提取单个测试用例的完整内容
 */
function extractTestContent(fileContent, testId) {
  // 转义正则表达式中的特殊字符
  const escapedId = testId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

  // 找到测试开始位置 - 匹配整个test函数签名
  // test('TC-API-001: ...', async ({ ... }) => {
  const testPattern = new RegExp(`test\\(['\`"]${escapedId}:[^\`'"]*['\`"].*?=>\\s*\\{`, 's');
  const testMatch = testPattern.exec(fileContent);

  if (!testMatch) {
    console.warn(`⚠️  无法找到测试: ${testId}`);
    return null;
  }

  // 函数体开始位置（第一个{）
  const startIndex = testMatch.index + testMatch[0].length - 1;

  // 找到匹配的结束括号
  let braceCount = 1;
  let endIndex = startIndex + 1;
  let inString = false;
  let stringChar = '';
  let inComment = false;

  while (endIndex < fileContent.length && braceCount > 0) {
    const char = fileContent[endIndex];
    const prevChar = fileContent[endIndex - 1];

    // 处理字符串（避免字符串中的括号影响计数）
    if (!inComment && (char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
    }

    // 处理单行注释
    if (!inString && char === '/' && fileContent[endIndex + 1] === '/') {
      inComment = true;
    }
    if (inComment && char === '\n') {
      inComment = false;
    }

    // 只在非字符串、非注释内计数括号
    if (!inString && !inComment) {
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
      }
    }

    endIndex++;
  }

  if (braceCount !== 0) {
    console.warn(`⚠️  括号不匹配: ${testId}`);
    return null;
  }

  return fileContent.substring(startIndex, endIndex);
}

/**
 * 从测试代码中确定测试类型
 * @param {string} testContent - 测试内容
 * @param {string} testId - Custom ID (如 TC-UI-SMOKE-001)
 * @param {string} testTitle - 测试标题
 */
function detectTestType(testContent, testId = '', testTitle = '') {
  const allContent = `${testId} ${testTitle} ${testContent}`.toLowerCase();

  // 优先检测smoke测试
  if (allContent.includes('smoke') || allContent.includes('基本')) {
    return 'smoke';
  }

  // 回归测试
  if (allContent.includes('regression') || allContent.includes('回归')) {
    return 'regression';
  }

  // 契约/API测试
  if (allContent.includes('contract') || allContent.includes('契约')) {
    return 'functional';
  }

  return 'functional';
}

/**
 * 从测试代码中确定优先级
 */
function detectPriority(testContent, testTitle) {
  if (testTitle.includes('smoke') || testTitle.includes('基本')) {
    return 'high';
  }
  if (testTitle.includes('核心') || testTitle.includes('关键')) {
    return 'high';
  }
  if (testTitle.includes('边界') || testTitle.includes('edge')) {
    return 'low';
  }

  return 'medium';
}

/**
 * 根据测试 ID 自动推断测试层级 (layer)
 * @param {string} testId - 测试 ID (e.g., TC-API-SYNC-001)
 * @returns {string} - 'api', 'e2e', 或 'unit'
 */
function detectLayer(testId) {
  // 从 Custom ID 中提取层级标识
  // 格式: TC-{LAYER}-{MODULE}-{NUMBER}
  const match = testId.match(/^TC-([A-Z]+)-/);

  if (match) {
    const layerPrefix = match[1];

    // API 层测试
    if (layerPrefix === 'API' || layerPrefix === 'INT') {
      return 'api';
    }

    // Unit 层测试
    if (layerPrefix === 'UNIT') {
      return 'unit';
    }

    // UI/E2E 层测试
    if (layerPrefix === 'UI' || layerPrefix === 'E2E') {
      return 'e2e';
    }
  }

  // 默认: e2e (向后兼容)
  return 'e2e';
}

/**
 * 从 JSDoc 中提取 severity (严重程度)
 * @param {string} testContent - 测试内容
 * @returns {string} - 'blocker', 'critical', 'major', 'normal', 'minor', 'trivial'
 */
function detectSeverity(testContent) {
  // 查找 @severity 标签
  const severityMatch = testContent.match(/@severity\s+(blocker|critical|major|normal|minor|trivial)/i);

  if (severityMatch) {
    return severityMatch[1].toLowerCase();
  }

  // 默认: normal
  return 'normal';
}

/**
 * 从 JSDoc 中提取 behavior (行为类型)
 * @param {string} testContent - 测试内容
 * @returns {string|null} - 'positive', 'negative', 'destructive', 或 null
 */
function detectBehavior(testContent) {
  // 查找 @behavior 标签
  const behaviorMatch = testContent.match(/@behavior\s+(positive|negative|destructive)/i);

  if (behaviorMatch) {
    return behaviorMatch[1].toLowerCase();
  }

  // 默认: null (不设置)
  return null;
}

/**
 * 从 JSDoc 中提取 is_flaky (不稳定标志)
 * @param {string} testContent - 测试内容
 * @returns {boolean} - true 或 false
 */
function detectFlaky(testContent) {
  // 查找 @flaky 标签
  const flakyMatch = testContent.match(/@flaky\s+(yes|true|1|no|false|0)/i);

  if (flakyMatch) {
    const value = flakyMatch[1].toLowerCase();
    return value === 'yes' || value === 'true' || value === '1';
  }

  // 默认: false (不是 flaky)
  return false;
}

/**
 * 从测试代码中提取 Qase ID (qase.id())
 * @param {string} testContent - 测试内容
 * @returns {number|null} - Qase ID 或 null
 */
function extractQaseId(testContent) {
  // 查找 qase.id(123) 调用
  const qaseIdMatch = testContent.match(/qase\.id\((\d+)\)/);

  if (qaseIdMatch) {
    return parseInt(qaseIdMatch[1], 10);
  }

  return null;
}

/**
 * 扫描测试文件并提取所有测试用例
 */
function scanTestFiles() {
  const testCases = [];
  const errors = [];

  // 读取所有测试文件
  const files = fs.readdirSync(E2E_DIR)
    .filter(file => file.endsWith('.spec.ts'));

  for (const fileName of files) {
    const filePath = path.join(E2E_DIR, fileName);
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    // 计算相对于项目根目录的路径
    const relativeFilePath = path.relative(PROJECT_ROOT, filePath);

    const description = extractDescription(fileContent);

    // 提取所有测试
    let match;
    const idPattern = new RegExp(TEST_ID_PATTERN);

    while ((match = idPattern.exec(fileContent)) !== null) {
      const testId = match[1].trim();
      const title = match[2].trim();

      // ⚠️ 强制验证 Custom ID
      const validation = validateCustomId(testId);
      if (!validation.valid) {
        errors.push({
          file: fileName,
          testId: testId || '(missing)',
          title: title,
          error: validation.error
        });
        continue; // 跳过无效的测试用例
      }

      // 使用 Custom ID 映射 Suite
      const suite = extractSuite(fileContent, fileName, testId, CONFIG);

      // 提取测试完整内容
      const testContent = extractTestContent(fileContent, testId);

      if (testContent) {
        // 提取原始 JSDoc 文本用于字段检测
        const rawJSDoc = extractRawJSDoc(fileContent, testId);

        const steps = extractSteps(testContent);
        const testType = detectTestType(testContent, testId, title);
        const priority = detectPriority(testContent, title);
        const severity = detectSeverity(rawJSDoc);
        const behavior = detectBehavior(rawJSDoc);
        const isFlaky = detectFlaky(rawJSDoc);
        const qaseId = extractQaseId(testContent); // 提取 Qase ID (如果有)

        // 提取测试级别的 JSDoc 元数据
        const jsdoc = extractTestJSDoc(fileContent, testId);

        // 构建完整的title：Custom ID + 标题 + tags
        let fullTitle = `${testId}: ${title}`;

        // 根据测试类型和优先级添加tag
        const tags = [];
        if (testType === 'smoke') tags.push('@smoke');
        if (testType === 'regression') tags.push('@regression');
        if (priority === 'high' && testType !== 'smoke') tags.push('@critical');

        // 如果有tags，添加到title末尾
        if (tags.length > 0) {
          fullTitle += ` ${tags.join(' ')}`;
        }

        testCases.push({
          id: testId,
          customId: testId, // 明确标记为 customId
          qase_id: qaseId, // Qase ID (从 qase.id() 提取，可能为 null)
          title: fullTitle, // 使用完整的title
          originalTitle: title, // 保留原始title供参考
          description: jsdoc.description || description, // 优先使用测试级别的 description
          preconditions: jsdoc.preconditions || '', // 前置条件
          postconditions: jsdoc.postconditions || '', // 后置条件
          suite: suite,
          fileName: fileName,
          file: fileName, // 添加 file 字段以便错误报告
          filePath: relativeFilePath, // 相对于项目根目录的文件路径
          steps: steps,
          type: testType,
          priority: priority,
          severity: severity, // 严重程度
          behavior: behavior, // 行为类型
          isFlaky: isFlaky, // 不稳定标志
          layer: detectLayer(testId), // 自动根据 Custom ID 推断层级
          automation: 'automated',
          status: 'actual',
          tags: tags // 保存为数组
        });
      }
    }
  }

  return { testCases, errors };
}

/**
 * 主函数
 * @param {Object} options - 选项
 * @param {boolean} options.saveToFile - 是否保存到文件（默认 false）
 * @param {boolean} options.verbose - 是否显示详细日志（默认 true）
 */
function main(options = {}) {
  const { saveToFile = false, verbose = true } = options;

  if (verbose) {
    console.log('🔍 扫描E2E测试文件...');
    console.log(`📁 目录: ${E2E_DIR}\n`);
  }

  const { testCases, errors } = scanTestFiles();

  if (verbose) {
    console.log(`✅ 找到 ${testCases.length} 个测试用例\n`);

    // 按Suite分组显示
    const suiteMap = {};
    for (const tc of testCases) {
      if (!suiteMap[tc.suite]) {
        suiteMap[tc.suite] = [];
      }
      suiteMap[tc.suite].push(tc);
    }

    for (const [suite, cases] of Object.entries(suiteMap)) {
      console.log(`📦 ${suite} (${cases.length} 个测试)`);
      for (const tc of cases) {
        console.log(`   - ${tc.id}: ${tc.title}`);
        if (tc.steps.length > 0) {
          console.log(`     步骤: ${tc.steps.length} 个`);
        }
      }
      console.log('');
    }

    // ⚠️ 如果有验证错误，显示警告但继续处理
    if (errors.length > 0) {
      console.warn(`\n⚠️  发现 ${errors.length} 个 Custom ID 验证警告（已跳过）:\n`);
      errors.forEach(({ file, testId, title, error }) => {
        console.warn(`  文件: ${file}`);
        console.warn(`  测试ID: ${testId}`);
        console.warn(`  标题: ${title}`);
        console.warn(`  错误: ${error}\n`);
      });

      console.warn('⚠️  部分 Custom ID 可能不符合标准格式，但仍会继续处理');
      console.warn('📖 查看规范: ~/.claude/skills/qase-testops-manager/references/custom-id-standards.md\n');
    }
  }

  // 只在 debug 模式下保存文件
  if (saveToFile) {
    // 确保输出目录存在
    const outputDir = path.join(PROJECT_ROOT, CONFIG.outputDir);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📁 创建输出目录: ${outputDir}\n`);
    }

    // 保存为JSON
    const outputPath = path.join(outputDir, CONFIG.jsonFileName);
    fs.writeFileSync(outputPath, JSON.stringify(testCases, null, 2), 'utf-8');

    console.log(`💾 已保存到: ${outputPath}`);
    console.log(`✨ 所有 ${testCases.length} 个测试用例的 Custom ID 格式正确\n`);
  }

  return testCases;
}

// 如果直接运行脚本
if (require.main === module) {
  // 检查是否有 --debug 参数（debug 模式保存 JSON 文件）
  const debug = process.argv.includes('--debug');

  if (debug) {
    console.log('🐛 Debug 模式: 将保存 JSON 文件\n');
  } else {
    console.log('ℹ️  正常模式: 不保存 JSON 文件（使用 --debug 保存）\n');
  }

  main({ saveToFile: debug, verbose: true });
}

module.exports = { main, scanTestFiles, extractSteps, extractDescription };
