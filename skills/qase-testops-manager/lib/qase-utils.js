/**
 * Qase 工具函数库
 *
 * 提供 Qase API 交互的通用函数，避免代码重复
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ROOT = process.cwd();

/**
 * 加载配置文件
 * @returns {Object} 配置对象
 */
function loadConfig() {
  const configPath = path.join(PROJECT_ROOT, '.qase-config.json');

  if (!fs.existsSync(configPath)) {
    console.error('❌ 错误: 找不到 .qase-config.json 配置文件');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  // 验证必需的 Qase 配置
  if (!config.qase || !config.qase.apiToken || !config.qase.projectCode) {
    console.error('❌ 错误: .qase-config.json 缺少 Qase 配置');
    console.error('   请添加以下配置:');
    console.error('   {');
    console.error('     "qase": {');
    console.error('       "apiToken": "your_api_token",');
    console.error('       "projectCode": "your_project_code"');
    console.error('     }');
    console.error('   }');
    process.exit(1);
  }

  return config;
}

/**
 * Qase API 请求封装
 * @param {Object} config - 配置对象
 * @param {string} method - HTTP 方法 (GET, POST, PATCH, DELETE)
 * @param {string} endpoint - API 端点路径 (如 /suite/PROJECT_CODE)
 * @param {Object|null} data - 请求体数据
 * @returns {Promise<Object>} API 响应
 */
function qaseApiRequest(config, method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.qase.io',
      port: 443,
      path: `/v1${endpoint}`,
      method: method,
      headers: {
        'Token': config.qase.apiToken,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`API错误 (${res.statusCode}): ${parsed.errorMessage || responseData}`));
          }
        } catch (error) {
          reject(new Error(`解析响应失败: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`请求失败: ${error.message}`));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * 获取所有 Suites（支持分页）
 * @param {Object} config - 配置对象
 * @returns {Promise<Array>} Suite 列表
 */
async function getAllSuites(config) {
  let allSuites = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const endpoint = `/suite/${config.qase.projectCode}?limit=${limit}&offset=${offset}`;
    const response = await qaseApiRequest(config, 'GET', endpoint);

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
 * 获取所有测试用例（支持分页）
 * @param {Object} config - 配置对象
 * @param {Object} filters - 过滤条件 (可选)
 * @returns {Promise<Array>} 测试用例列表
 */
async function getAllTestCases(config, filters = {}) {
  let allCases = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    let endpoint = `/case/${config.qase.projectCode}?limit=${limit}&offset=${offset}`;

    // 添加过滤条件
    if (filters.suite_id) {
      endpoint += `&suite_id=${filters.suite_id}`;
    }

    const response = await qaseApiRequest(config, 'GET', endpoint);

    if (!response.status || !response.result) {
      throw new Error('Failed to fetch test cases');
    }

    const cases = response.result.entities || [];
    allCases = allCases.concat(cases);

    // 检查是否还有更多数据
    const total = response.result.total || 0;
    offset += limit;
    hasMore = offset < total;
  }

  return allCases;
}

/**
 * 删除单个测试用例
 * @param {Object} config - 配置对象
 * @param {number} caseId - 测试用例 ID
 * @returns {Promise<Object>} 删除结果
 */
async function deleteTestCase(config, caseId) {
  const endpoint = `/case/${config.qase.projectCode}/${caseId}`;
  return await qaseApiRequest(config, 'DELETE', endpoint);
}

/**
 * 删除单个 Suite
 * @param {Object} config - 配置对象
 * @param {number} suiteId - Suite ID
 * @returns {Promise<Object>} 删除结果
 */
async function deleteSuite(config, suiteId) {
  const endpoint = `/suite/${config.qase.projectCode}/${suiteId}`;
  return await qaseApiRequest(config, 'DELETE', endpoint);
}

/**
 * 创建或更新测试用例
 * @param {Object} config - 配置对象
 * @param {Object} caseData - 测试用例数据
 * @param {number|null} caseId - 测试用例 ID（更新时提供）
 * @returns {Promise<Object>} 创建/更新结果
 */
async function createOrUpdateTestCase(config, caseData, caseId = null) {
  if (caseId) {
    // 更新现有用例
    const endpoint = `/case/${config.qase.projectCode}/${caseId}`;
    return await qaseApiRequest(config, 'PATCH', endpoint, caseData);
  } else {
    // 创建新用例
    const endpoint = `/case/${config.qase.projectCode}`;
    return await qaseApiRequest(config, 'POST', endpoint, caseData);
  }
}

/**
 * 创建 Suite
 * @param {Object} config - 配置对象
 * @param {Object} suiteData - Suite 数据
 * @returns {Promise<Object>} 创建结果
 */
async function createSuite(config, suiteData) {
  const endpoint = `/suite/${config.qase.projectCode}`;
  return await qaseApiRequest(config, 'POST', endpoint, suiteData);
}

/**
 * 通过 Custom ID 查找测试用例
 * @param {Object} config - 配置对象
 * @param {string} customId - Custom ID
 * @returns {Promise<Object|null>} 找到的测试用例或 null
 */
async function findTestCaseByCustomId(config, customId) {
  const allCases = await getAllTestCases(config);

  for (const testCase of allCases) {
    if (testCase.custom_fields) {
      for (const field of testCase.custom_fields) {
        if (field.value === customId) {
          return testCase;
        }
      }
    }
  }

  return null;
}

/**
 * 构建 Suite 层级路径
 * @param {string} suiteName - Suite 名称（可能包含分隔符）
 * @returns {Array<string>} Suite 路径数组
 */
function parseSuitePath(suiteName) {
  return suiteName.split('>').map(s => s.trim()).filter(s => s.length > 0);
}

module.exports = {
  loadConfig,
  qaseApiRequest,
  getAllSuites,
  getAllTestCases,
  deleteTestCase,
  deleteSuite,
  createOrUpdateTestCase,
  createSuite,
  findTestCaseByCustomId,
  parseSuitePath,
};
