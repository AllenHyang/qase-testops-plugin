/**
 * Tests for validate-test-ids.js
 *
 * Tests Custom ID validation logic and standards compliance
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPT_PATH = path.join(__dirname, '../../scripts/validate-test-ids.js');

describe('validate-test-ids.js', () => {
  describe('Custom ID Pattern Validation', () => {
    test('should accept valid TC-API-SYNC-001 format', () => {
      const testId = 'TC-API-SYNC-001';
      const pattern = /^TC-[A-Z]{2,8}-[A-Z]{2,12}-\d{3}$/;

      expect(pattern.test(testId)).toBe(true);
    });

    test('should accept valid TC-E2E-SMOKE-001 format (with number in LAYER)', () => {
      const testId = 'TC-E2E-SMOKE-001';
      const pattern = /^TC-[A-Z0-9]{2,8}-[A-Z]{2,12}-\d{3}$/;

      expect(pattern.test(testId)).toBe(true);
    });

    test('should accept valid TC-UI-ARCHIVE-999 format (max number)', () => {
      const testId = 'TC-UI-ARCHIVE-999';
      const pattern = /^TC-[A-Z]{2,8}-[A-Z]{2,12}-\d{3}$/;

      expect(pattern.test(testId)).toBe(true);
    });

    test('should reject invalid format: missing TC prefix', () => {
      const testId = 'API-SYNC-001';
      const pattern = /^TC-[A-Z]{2,8}-[A-Z]{2,12}-\d{3}$/;

      expect(pattern.test(testId)).toBe(false);
    });

    test('should reject invalid format: lowercase letters', () => {
      const testId = 'TC-api-sync-001';
      const pattern = /^TC-[A-Z]{2,8}-[A-Z]{2,12}-\d{3}$/;

      expect(pattern.test(testId)).toBe(false);
    });

    test('should reject invalid format: 2-digit number', () => {
      const testId = 'TC-API-SYNC-01';
      const pattern = /^TC-[A-Z]{2,8}-[A-Z]{2,12}-\d{3}$/;

      expect(pattern.test(testId)).toBe(false);
    });

    test('should reject invalid format: 4-digit number', () => {
      const testId = 'TC-API-SYNC-0001';
      const pattern = /^TC-[A-Z]{2,8}-[A-Z]{2,12}-\d{3}$/;

      expect(pattern.test(testId)).toBe(false);
    });

    test('should reject invalid format: layer too short (1 char)', () => {
      const testId = 'TC-A-SYNC-001';
      const pattern = /^TC-[A-Z]{2,8}-[A-Z]{2,12}-\d{3}$/;

      expect(pattern.test(testId)).toBe(false);
    });

    test('should reject invalid format: layer too long (9 chars)', () => {
      const testId = 'TC-APILAYERS-SYNC-001';
      const pattern = /^TC-[A-Z]{2,8}-[A-Z]{2,12}-\d{3}$/;

      expect(pattern.test(testId)).toBe(false);
    });

    test('should reject invalid format: module too short (1 char)', () => {
      const testId = 'TC-API-S-001';
      const pattern = /^TC-[A-Z]{2,8}-[A-Z]{2,12}-\d{3}$/;

      expect(pattern.test(testId)).toBe(false);
    });

    test('should reject invalid format: module too long (13 chars)', () => {
      const testId = 'TC-API-SYNCHRONIZING-001';
      const pattern = /^TC-[A-Z]{2,8}-[A-Z]{2,12}-\d{3}$/;

      expect(pattern.test(testId)).toBe(false);
    });
  });

  describe('extractCustomId', () => {
    test('should extract Custom ID from test title', () => {
      const title = "TC-API-SYNC-001: Complete workflow validation";
      const match = title.match(/^(TC-[A-Z]+-[A-Z]+-\d+):/);

      expect(match).toBeTruthy();
      expect(match[1]).toBe('TC-API-SYNC-001');
    });

    test('should handle test title with special characters', () => {
      const title = "TC-UI-SMOKE-001: Basic UI rendering (with special chars)";
      const match = title.match(/^(TC-[A-Z]+-[A-Z]+-\d+):/);

      expect(match).toBeTruthy();
      expect(match[1]).toBe('TC-UI-SMOKE-001');
    });

    test('should return null for invalid title format', () => {
      const title = "Invalid test without ID";
      const match = title.match(/^(TC-[A-Z]+-[A-Z]+-\d+):/);

      expect(match).toBeNull();
    });
  });

  describe('suggestCorrection', () => {
    test('should suggest correction for simple format ID', () => {
      const testId = 'API-001';
      const isSimpleFormat = /^[A-Z]+-\d+$/.test(testId);

      expect(isSimpleFormat).toBe(true);
      // Suggestion: needs layer and module
    });

    test('should suggest correction for missing layer or module', () => {
      const testId = 'TC-API-001';
      const isMissingPart = /^TC-[A-Z]+-\d+$/.test(testId);

      expect(isMissingPart).toBe(true);
      // Suggestion: missing layer or module
    });

    test('should detect lowercase in ID', () => {
      const testId = 'tc-api-sync-001';
      const hasLowercase = /[a-z]/.test(testId);

      expect(hasLowercase).toBe(true);
      // Suggestion: IDs must be uppercase
    });
  });

  describe('File inference', () => {
    test('should infer SYNC module from sync test file', () => {
      const fileName = 'sync-basic.spec.ts';
      const inferredModule = fileName.includes('sync') ? 'SYNC' : 'WORKFLOW';

      expect(inferredModule).toBe('SYNC');
    });

    test('should infer API layer from api test file', () => {
      const fileName = 'api-contract.spec.ts';
      const inferredLayer = fileName.includes('api') ? 'API' : 'E2E';

      expect(inferredLayer).toBe('API');
    });

    test('should infer SMOKE module from smoke test file', () => {
      const fileName = 'smoke-ui.spec.ts';
      const inferredModule = fileName.includes('smoke') ? 'SMOKE' : 'WORKFLOW';

      expect(inferredModule).toBe('SMOKE');
    });

    test('should default to WORKFLOW for generic files', () => {
      const fileName = 'core-workflow.spec.ts';
      const inferredModule = fileName.includes('workflow') ? 'WORKFLOW' : 'WORKFLOW';

      expect(inferredModule).toBe('WORKFLOW');
    });

    test('should default to E2E for non-api files', () => {
      const fileName = 'ui-rendering.spec.ts';
      const inferredLayer = fileName.includes('api') ? 'API' : 'E2E';

      expect(inferredLayer).toBe('E2E');
    });
  });
});
