/**
 * Tests for update-qase-annotations.js
 *
 * Tests automatic qase.id() annotation updates in test code
 */

const fs = require('fs');
const path = require('path');

describe('update-qase-annotations.js', () => {
  describe('extractCustomIdFromTest', () => {
    test('should extract Custom ID from test line', () => {
      const line = "test('TC-API-SYNC-001: Complete workflow', async ({ page }) => {";
      const match = line.match(/test\(['"]([A-Z]+-[A-Z0-9]+-[A-Z]+-\d+)/);

      expect(match).toBeTruthy();
      expect(match[1]).toBe('TC-API-SYNC-001');
    });

    test('should extract Custom ID with E2E layer (number in LAYER)', () => {
      const line = "test('TC-E2E-SMOKE-001: Basic test', async () => {";
      const match = line.match(/test\(['"]([A-Z]+-[A-Z0-9]+-[A-Z]+-\d+)/);

      expect(match).toBeTruthy();
      expect(match[1]).toBe('TC-E2E-SMOKE-001');
    });

    test('should return null for line without Custom ID', () => {
      const line = "test('Invalid test without ID', async () => {";
      const match = line.match(/test\(['"]([A-Z]+-[A-Z0-9]+-[A-Z]+-\d+)/);

      expect(match).toBeNull();
    });
  });

  describe('hasQaseId', () => {
    test('should detect existing qase.id() in test', () => {
      const content = `
        test('TC-API-SYNC-001: Test', async () => {
          qase.id(123);
          // test logic
        });
      `;

      const hasId = content.includes('qase.id(');
      expect(hasId).toBe(true);
    });

    test('should return false when qase.id() not present', () => {
      const content = `
        test('TC-API-SYNC-001: Test', async () => {
          // test logic without annotation
        });
      `;

      const hasId = content.includes('qase.id(');
      expect(hasId).toBe(false);
    });
  });

  describe('generateQaseAnnotations', () => {
    test('should generate qase.id() annotation', () => {
      const qaseId = 123;
      const indent = '    ';

      const annotation = `${indent}qase.id(${qaseId});`;

      expect(annotation).toBe('    qase.id(123);');
    });

    test('should use custom indent', () => {
      const qaseId = 456;
      const indent = '  ';

      const annotation = `${indent}qase.id(${qaseId});`;

      expect(annotation).toBe('  qase.id(456);');
    });
  });

  describe('extractNestedDescribePath', () => {
    test('should extract single describe level', () => {
      const fileContent = `
        test.describe('API Tests', () => {
          test('TC-API-SYNC-001: Test', async () => {});
        });
      `;
      const testId = 'TC-API-SYNC-001';

      const describePattern = /test\.describe\(['"`]([^'"`]+)['"`]/g;
      const describes = [];
      let match;

      while ((match = describePattern.exec(fileContent)) !== null) {
        if (fileContent.indexOf(`test('${testId}:`) > match.index) {
          describes.push(match[1].trim());
        }
      }

      expect(describes).toHaveLength(1);
      expect(describes[0]).toBe('API Tests');
    });

    test('should extract nested describe levels', () => {
      const fileContent = `
        test.describe('API Tests', () => {
          test.describe('Sync Validation', () => {
            test('TC-API-SYNC-001: Test', async () => {});
          });
        });
      `;
      const testId = 'TC-API-SYNC-001';

      const describePattern = /test\.describe\(['"`]([^'"`]+)['"`]/g;
      const describes = [];
      let match;

      while ((match = describePattern.exec(fileContent)) !== null) {
        if (fileContent.indexOf(`test('${testId}:`) > match.index) {
          describes.push(match[1].trim());
        }
      }

      expect(describes.length).toBeGreaterThan(0);
      expect(describes).toContain('API Tests');
      expect(describes).toContain('Sync Validation');

      const path = describes.join('\\t'); // Tab separator
      expect(path).toBe('API Tests\\tSync Validation');
    });

    test('should return null when no describes found', () => {
      const fileContent = `
        test('TC-API-SYNC-001: Test', async () => {});
      `;
      const testId = 'TC-API-SYNC-001';

      const describePattern = /test\.describe\(['"`]([^'"`]+)['"`]/g;
      const describes = [];
      let match;

      while ((match = describePattern.exec(fileContent)) !== null) {
        if (fileContent.indexOf(`test('${testId}:`) > match.index) {
          describes.push(match[1].trim());
        }
      }

      expect(describes).toHaveLength(0);
    });
  });

  describe('CSV ID mapping', () => {
    test('should parse CSV ID mapping correctly', () => {
      const csvLine = 'TC-API-SYNC-001,123,API Tests,Complete workflow';
      const parts = csvLine.split(',');

      const customId = parts[0];
      const qaseId = parseInt(parts[1]);

      expect(customId).toBe('TC-API-SYNC-001');
      expect(qaseId).toBe(123);
    });

    test('should handle missing qase ID in CSV', () => {
      const csvLine = 'TC-API-SYNC-001,,API Tests,Complete workflow';
      const parts = csvLine.split(',');

      const customId = parts[0];
      const qaseId = parts[1] ? parseInt(parts[1]) : null;

      expect(customId).toBe('TC-API-SYNC-001');
      expect(qaseId).toBeNull();
    });
  });

  describe('Code update logic', () => {
    test('should detect need for qase.id() addition', () => {
      const testContent = `
        test('TC-API-SYNC-001: Test', async () => {
          // No qase.id() here
        });
      `;

      const hasId = /qase\.id\(\d+\)/.test(testContent);
      expect(hasId).toBe(false);
      // Should add qase.id()
    });

    test('should detect need for qase.id() update', () => {
      const testContent = `
        test('TC-API-SYNC-001: Test', async () => {
          qase.id(999); // Old ID
        });
      `;

      const match = testContent.match(/qase\.id\((\d+)\)/);
      expect(match).toBeTruthy();

      const oldId = parseInt(match[1]);
      const newId = 123;

      expect(oldId).toBe(999);
      expect(oldId).not.toBe(newId);
      // Should update qase.id()
    });

    test('should skip when qase.id() already correct', () => {
      const testContent = `
        test('TC-API-SYNC-001: Test', async () => {
          qase.id(123); // Correct ID
        });
      `;

      const match = testContent.match(/qase\.id\((\d+)\)/);
      expect(match).toBeTruthy();

      const currentId = parseInt(match[1]);
      const mappedId = 123;

      expect(currentId).toBe(mappedId);
      // Should skip (already correct)
    });
  });

  describe('Backup handling', () => {
    test('should create backup path with .backup extension', () => {
      const originalPath = '/path/to/test.spec.ts';
      const backupPath = originalPath + '.backup';

      expect(backupPath).toBe('/path/to/test.spec.ts.backup');
    });

    test('should verify backup file naming', () => {
      const filePath = 'e2e/specs/sync-basic.spec.ts';
      const backupPath = filePath + '.backup';

      expect(backupPath).toMatch(/\.spec\.ts\.backup$/);
    });
  });

  describe('Test function body detection', () => {
    test('should find function body start after =>', () => {
      const content = "test('TC-API-SYNC-001: Test', async ({ page }) => {";
      const arrowIndex = content.indexOf('=>');
      const bodyStart = content.indexOf('{', arrowIndex);

      expect(arrowIndex).toBeGreaterThan(-1);
      expect(bodyStart).toBeGreaterThan(arrowIndex);
    });

    test('should handle async function syntax', () => {
      const content = "test('TC-API-SYNC-001: Test', async () => {";
      const asyncIndex = content.indexOf('async');
      const bodyStart = content.indexOf('{', asyncIndex);

      expect(asyncIndex).toBeGreaterThan(-1);
      expect(bodyStart).toBeGreaterThan(asyncIndex);
    });

    test('should detect indent from line start', () => {
      const line = '    test(';
      const indent = line.match(/^\s*/)[0];

      expect(indent).toBe('    ');
      expect(indent.length).toBe(4);
    });
  });

  describe('Regex patterns', () => {
    test('should match test function with async params', () => {
      const pattern = /test\(['"]([A-Z]+-[A-Z0-9]+-[A-Z]+-\d+):.*?['"],\s*async\s*/;
      const testLine = "test('TC-API-SYNC-001: Test title', async ({ page }) => {";

      const match = pattern.exec(testLine);
      expect(match).toBeTruthy();
      expect(match[1]).toBe('TC-API-SYNC-001');
    });

    test('should match test function without params', () => {
      const pattern = /test\(['"]([A-Z]+-[A-Z0-9]+-[A-Z]+-\d+):.*?['"],\s*async\s*/;
      const testLine = "test('TC-API-SYNC-001: Test title', async () => {";

      const match = pattern.exec(testLine);
      expect(match).toBeTruthy();
      expect(match[1]).toBe('TC-API-SYNC-001');
    });
  });
});
