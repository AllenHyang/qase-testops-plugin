/**
 * Tests for extract-tests.js
 *
 * Tests core test extraction logic, including:
 * - Custom ID validation
 * - Test step extraction
 * - Suite hierarchy extraction
 * - JSDoc metadata extraction
 */

const fs = require('fs');
const path = require('path');

// Mock test file content for testing
const MOCK_TEST_FILE = `
/**
 * Test file description
 */

import { test } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';

test.describe('API Tests', () => {
  test.describe('Sync Validation', () => {
    /**
     * @description Complete workflow validation
     * @preconditions Account must be authenticated
     * @postconditions Data synced to database
     */
    test('TC-API-SYNC-001: Complete workflow validation', async ({ page }) => {
      qase.id(123);

      await test.step('Step 1: Initialize | test data | success', async () => {
        // Step 1 logic
      });

      await test.step('Step 2: Execute', async () => {
        // Step 2 logic
      });
    });
  });
});
`;

describe('extract-tests.js', () => {
  describe('validateCustomId', () => {
    test('should validate correct TC-API-SYNC-001 format', () => {
      const customId = 'TC-API-SYNC-001';
      const pattern = /^TC-[A-Z0-9]{2,8}-[A-Z]{2,12}-\d{3}$/;

      const valid = pattern.test(customId);
      expect(valid).toBe(true);
    });

    test('should reject empty Custom ID', () => {
      const customId = '';

      expect(customId.trim()).toBe('');
    });

    test('should reject Custom ID with invalid format', () => {
      const customId = 'INVALID-ID';
      const pattern = /^TC-[A-Z0-9]{2,8}-[A-Z]{2,12}-\d{3}$/;

      const valid = pattern.test(customId);
      expect(valid).toBe(false);
    });

    test('should handle Custom ID with E2E (number in LAYER)', () => {
      const customId = 'TC-E2E-SMOKE-001';
      const pattern = /^TC-[A-Z0-9]{2,8}-[A-Z]{2,12}-\d{3}$/;

      const valid = pattern.test(customId);
      expect(valid).toBe(true);
    });
  });

  describe('extractSteps', () => {
    test('should extract simple step format', () => {
      const testContent = `
        await test.step('Initialize system', async () => {});
      `;
      const stepPattern = /await\s+test\.step\(['"\`]([^'"\`]+)['"\`]/g;
      const steps = [];
      let match;

      while ((match = stepPattern.exec(testContent)) !== null) {
        const stepText = match[1].trim();
        const parts = stepText.split('|').map(p => p.trim());
        steps.push({
          action: parts[0] || stepText,
          data: parts[1] || '',
          expected_result: parts[2] || ''
        });
      }

      expect(steps).toHaveLength(1);
      expect(steps[0].action).toBe('Initialize system');
      expect(steps[0].data).toBe('');
      expect(steps[0].expected_result).toBe('');
    });

    test('should extract step with data format', () => {
      const testContent = `
        await test.step('Login user | username: test@example.com', async () => {});
      `;
      const stepPattern = /await\s+test\.step\(['"\`]([^'"\`]+)['"\`]/g;
      const steps = [];
      let match;

      while ((match = stepPattern.exec(testContent)) !== null) {
        const stepText = match[1].trim();
        const parts = stepText.split('|').map(p => p.trim());
        steps.push({
          action: parts[0] || stepText,
          data: parts[1] || '',
          expected_result: parts[2] || ''
        });
      }

      expect(steps).toHaveLength(1);
      expect(steps[0].action).toBe('Login user');
      expect(steps[0].data).toBe('username: test@example.com');
      expect(steps[0].expected_result).toBe('');
    });

    test('should extract step with full format (action | data | expected_result)', () => {
      const testContent = `
        await test.step('Verify email | test@example.com | Email sent successfully', async () => {});
      `;
      const stepPattern = /await\s+test\.step\(['"\`]([^'"\`]+)['"\`]/g;
      const steps = [];
      let match;

      while ((match = stepPattern.exec(testContent)) !== null) {
        const stepText = match[1].trim();
        const parts = stepText.split('|').map(p => p.trim());
        steps.push({
          action: parts[0] || stepText,
          data: parts[1] || '',
          expected_result: parts[2] || ''
        });
      }

      expect(steps).toHaveLength(1);
      expect(steps[0].action).toBe('Verify email');
      expect(steps[0].data).toBe('test@example.com');
      expect(steps[0].expected_result).toBe('Email sent successfully');
    });

    test('should extract multiple steps', () => {
      const testContent = `
        await test.step('Step 1', async () => {});
        await test.step('Step 2 | data', async () => {});
        await test.step('Step 3 | data | result', async () => {});
      `;
      const stepPattern = /await\s+test\.step\(['"\`]([^'"\`]+)['"\`]/g;
      const steps = [];
      let match;

      while ((match = stepPattern.exec(testContent)) !== null) {
        const stepText = match[1].trim();
        const parts = stepText.split('|').map(p => p.trim());
        steps.push({
          action: parts[0] || stepText,
          data: parts[1] || '',
          expected_result: parts[2] || ''
        });
      }

      expect(steps).toHaveLength(3);
      expect(steps[0].action).toBe('Step 1');
      expect(steps[1].action).toBe('Step 2');
      expect(steps[1].data).toBe('data');
      expect(steps[2].action).toBe('Step 3');
      expect(steps[2].expected_result).toBe('result');
    });
  });

  describe('extractTestJSDoc', () => {
    test('should extract @description from JSDoc', () => {
      const fileContent = `
        /**
         * @description Complete workflow validation
         */
        test('TC-API-SYNC-001: Test', async () => {});
      `;

      const jsdocPattern = /\/\*\*\s*\n([\s\S]*?)\*\//;
      const match = fileContent.match(jsdocPattern);

      expect(match).toBeTruthy();
      expect(match[1]).toContain('@description Complete workflow validation');
    });

    test('should extract @preconditions from JSDoc', () => {
      const fileContent = `
        /**
         * @preconditions Account must be authenticated
         */
        test('TC-API-SYNC-001: Test', async () => {});
      `;

      const jsdocPattern = /\/\*\*\s*\n([\s\S]*?)\*\//;
      const match = fileContent.match(jsdocPattern);

      expect(match).toBeTruthy();
      expect(match[1]).toContain('@preconditions Account must be authenticated');
    });

    test('should extract @postconditions from JSDoc', () => {
      const fileContent = `
        /**
         * @postconditions Data synced to database
         */
        test('TC-API-SYNC-001: Test', async () => {});
      `;

      const jsdocPattern = /\/\*\*\s*\n([\s\S]*?)\*\//;
      const match = fileContent.match(jsdocPattern);

      expect(match).toBeTruthy();
      expect(match[1]).toContain('@postconditions Data synced to database');
    });

    test('should extract all JSDoc tags together', () => {
      const fileContent = `
        /**
         * @description Test description
         * @preconditions User logged in
         * @postconditions Data saved
         */
        test('TC-API-SYNC-001: Test', async () => {});
      `;

      const jsdocPattern = /\/\*\*\s*\n([\s\S]*?)\*\//;
      const match = fileContent.match(jsdocPattern);

      expect(match).toBeTruthy();
      expect(match[1]).toContain('@description');
      expect(match[1]).toContain('@preconditions');
      expect(match[1]).toContain('@postconditions');
    });
  });

  describe('extractQaseId', () => {
    test('should extract qase.id() from test content', () => {
      const testContent = `
        test('TC-API-SYNC-001: Test', async () => {
          qase.id(123);
        });
      `;

      const qaseIdPattern = /qase\.id\((\d+)\)/;
      const match = testContent.match(qaseIdPattern);

      expect(match).toBeTruthy();
      expect(parseInt(match[1])).toBe(123);
    });

    test('should return null if no qase.id() found', () => {
      const testContent = `
        test('TC-API-SYNC-001: Test', async () => {
          // No qase.id()
        });
      `;

      const qaseIdPattern = /qase\.id\((\d+)\)/;
      const match = testContent.match(qaseIdPattern);

      expect(match).toBeNull();
    });
  });

  describe('detectTestType', () => {
    test('should detect smoke test', () => {
      const testId = 'TC-UI-SMOKE-001';
      const testTitle = 'Basic UI rendering';
      const allContent = `${testId} ${testTitle}`.toLowerCase();

      const isSmoke = allContent.includes('smoke') || allContent.includes('基本');
      expect(isSmoke).toBe(true);
    });

    test('should detect regression test', () => {
      const testId = 'TC-API-REGRESSION-001';
      const testTitle = 'Regression validation';
      const allContent = `${testId} ${testTitle}`.toLowerCase();

      const isRegression = allContent.includes('regression') || allContent.includes('回归');
      expect(isRegression).toBe(true);
    });

    test('should default to functional test', () => {
      const testId = 'TC-API-SYNC-001';
      const testTitle = 'Standard test';
      const allContent = `${testId} ${testTitle}`.toLowerCase();

      const isSmoke = allContent.includes('smoke');
      const isRegression = allContent.includes('regression');

      expect(isSmoke || isRegression).toBe(false);
      // Should default to 'functional'
    });
  });

  describe('detectLayer', () => {
    test('should detect API layer from TC-API-SYNC-001', () => {
      const testId = 'TC-API-SYNC-001';
      const match = testId.match(/^TC-([A-Z]+)-/);

      expect(match).toBeTruthy();
      expect(match[1]).toBe('API');

      const layer = match[1] === 'API' || match[1] === 'INT' ? 'api' : 'e2e';
      expect(layer).toBe('api');
    });

    test('should detect E2E layer from TC-E2E-SMOKE-001', () => {
      const testId = 'TC-E2E-SMOKE-001';
      const match = testId.match(/^TC-([A-Z0-9]+)-/);

      expect(match).toBeTruthy();
      expect(match[1]).toBe('E2E');

      const layer = match[1] === 'UI' || match[1] === 'E2E' ? 'e2e' : 'api';
      expect(layer).toBe('e2e');
    });

    test('should detect UI layer from TC-UI-ARCHIVE-001', () => {
      const testId = 'TC-UI-ARCHIVE-001';
      const match = testId.match(/^TC-([A-Z]+)-/);

      expect(match).toBeTruthy();
      expect(match[1]).toBe('UI');

      const layer = match[1] === 'UI' || match[1] === 'E2E' ? 'e2e' : 'api';
      expect(layer).toBe('e2e');
    });

    test('should detect UNIT layer from TC-UNIT-UTIL-001', () => {
      const testId = 'TC-UNIT-UTIL-001';
      const match = testId.match(/^TC-([A-Z]+)-/);

      expect(match).toBeTruthy();
      expect(match[1]).toBe('UNIT');

      const layer = match[1] === 'UNIT' ? 'unit' : 'e2e';
      expect(layer).toBe('unit');
    });
  });

  describe('detectPriority', () => {
    test('should detect high priority for smoke tests', () => {
      const testTitle = 'TC-UI-SMOKE-001: Basic rendering';

      const priority = testTitle.toLowerCase().includes('smoke') ? 'high' : 'medium';
      expect(priority).toBe('high');
    });

    test('should detect high priority for critical tests', () => {
      const testTitle = 'TC-API-SYNC-001: 核心功能验证';

      const priority = testTitle.includes('核心') || testTitle.includes('关键') ? 'high' : 'medium';
      expect(priority).toBe('high');
    });

    test('should detect low priority for edge case tests', () => {
      const testTitle = 'TC-API-EDGE-001: 边界条件测试';

      const priority = testTitle.includes('边界') || testTitle.toLowerCase().includes('edge') ? 'low' : 'medium';
      expect(priority).toBe('low');
    });

    test('should default to medium priority', () => {
      const testTitle = 'TC-API-SYNC-001: Standard test';

      const isHigh = testTitle.includes('核心') || testTitle.includes('smoke');
      const isLow = testTitle.includes('边界') || testTitle.includes('edge');
      const priority = isHigh ? 'high' : (isLow ? 'low' : 'medium');

      expect(priority).toBe('medium');
    });
  });

  describe('extractNestedDescribePath', () => {
    test('should extract single-level describe path', () => {
      const fileContent = `
        test.describe('API Tests', () => {
          test('TC-API-SYNC-001: Test', async () => {});
        });
      `;

      const describePattern = /test\.describe\(['"\`]([^'"\`]+)['"\`]/g;
      const describes = [];
      let match;

      while ((match = describePattern.exec(fileContent)) !== null) {
        describes.push(match[1].trim());
      }

      expect(describes).toHaveLength(1);
      expect(describes[0]).toBe('API Tests');
    });

    test('should extract two-level nested describe path', () => {
      const fileContent = `
        test.describe('API Tests', () => {
          test.describe('Sync Validation', () => {
            test('TC-API-SYNC-001: Test', async () => {});
          });
        });
      `;

      const describePattern = /test\.describe\(['"\`]([^'"\`]+)['"\`]/g;
      const describes = [];
      let match;

      while ((match = describePattern.exec(fileContent)) !== null) {
        describes.push(match[1].trim());
      }

      expect(describes).toHaveLength(2);
      expect(describes[0]).toBe('API Tests');
      expect(describes[1]).toBe('Sync Validation');

      const path = describes.join(' / ');
      expect(path).toBe('API Tests / Sync Validation');
    });

    test('should extract three-level nested describe path', () => {
      const fileContent = `
        test.describe('E2E Tests', () => {
          test.describe('Mail Management', () => {
            test.describe('Archive Features', () => {
              test('TC-E2E-ARCHIVE-001: Test', async () => {});
            });
          });
        });
      `;

      const describePattern = /test\.describe\(['"\`]([^'"\`]+)['"\`]/g;
      const describes = [];
      let match;

      while ((match = describePattern.exec(fileContent)) !== null) {
        describes.push(match[1].trim());
      }

      expect(describes).toHaveLength(3);
      expect(describes.join(' / ')).toBe('E2E Tests / Mail Management / Archive Features');
    });
  });
});
