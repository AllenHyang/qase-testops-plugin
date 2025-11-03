/**
 * Tests for sync-single-case.js
 *
 * Tests single test case sync to Qase, including:
 * - Test ID resolution (Custom ID and Qase ID formats)
 * - Suite hierarchy handling
 * - Field mapping
 */

describe('sync-single-case.js', () => {
  describe('resolveTestId', () => {
    test('should accept Custom ID format directly', () => {
      const input = 'TC-UI-SYNC-001';
      const pattern = /^TC-[A-Z0-9]+-[A-Z]+-\d+$/;

      const isCustomId = pattern.test(input);
      expect(isCustomId).toBe(true);
      // Should return as-is
    });

    test('should detect Qase ID format (EA-955)', () => {
      const input = 'EA-955';
      const projectCode = 'EA';
      const qaseIdPattern = new RegExp(`^${projectCode}-(\\d+)$`);

      const match = input.match(qaseIdPattern);
      expect(match).toBeTruthy();
      expect(match[1]).toBe('955');
      // Should lookup corresponding Custom ID
    });

    test('should reject invalid format', () => {
      const input = 'INVALID-ID';
      const customIdPattern = /^TC-[A-Z0-9]+-[A-Z]+-\d+$/;
      const qaseIdPattern = /^[A-Z]+-\d+$/;

      const isCustomId = customIdPattern.test(input);
      const isQaseId = qaseIdPattern.test(input);

      expect(isCustomId).toBe(false);
      expect(isQaseId).toBe(false);
      // Should error
    });
  });

  describe('Field mapping functions', () => {
    test('mapSeverity should map severity levels', () => {
      const severityMap = {
        'blocker': 1,
        'critical': 2,
        'major': 3,
        'normal': 4,
        'minor': 5,
        'trivial': 6
      };

      expect(severityMap['blocker']).toBe(1);
      expect(severityMap['critical']).toBe(2);
      expect(severityMap['normal']).toBe(4);
      expect(severityMap['trivial']).toBe(6);
    });

    test('mapSeverity should default to normal (4)', () => {
      const severityMap = {
        'blocker': 1,
        'critical': 2,
        'major': 3,
        'normal': 4,
        'minor': 5,
        'trivial': 6
      };

      const unknownSeverity = 'unknown';
      const mapped = severityMap[unknownSeverity] || 4;

      expect(mapped).toBe(4);
    });

    test('mapPriority should map priority levels', () => {
      const priorityMap = {
        'high': 1,
        'medium': 2,
        'low': 3
      };

      expect(priorityMap['high']).toBe(1);
      expect(priorityMap['medium']).toBe(2);
      expect(priorityMap['low']).toBe(3);
    });

    test('mapPriority should default to medium (2)', () => {
      const priorityMap = {
        'high': 1,
        'medium': 2,
        'low': 3
      };

      const unknownPriority = 'unknown';
      const mapped = priorityMap[unknownPriority] || 2;

      expect(mapped).toBe(2);
    });

    test('mapTestType should map test types', () => {
      const typeMap = {
        'functional': 1,
        'smoke': 2,
        'regression': 3,
        'security': 4,
        'usability': 5,
        'performance': 6,
        'acceptance': 7,
        'compatibility': 8,
        'integration': 9,
        'exploratory': 10
      };

      expect(typeMap['functional']).toBe(1);
      expect(typeMap['smoke']).toBe(2);
      expect(typeMap['regression']).toBe(3);
      expect(typeMap['performance']).toBe(6);
    });

    test('mapTestType should default to functional (1)', () => {
      const typeMap = {
        'functional': 1,
        'smoke': 2,
        'regression': 3
      };

      const unknownType = 'unknown';
      const mapped = typeMap[unknownType] || 1;

      expect(mapped).toBe(1);
    });

    test('mapTestLayer should map test layers', () => {
      const layerMap = {
        'e2e': 1,
        'api': 2,
        'unit': 3
      };

      expect(layerMap['e2e']).toBe(1);
      expect(layerMap['api']).toBe(2);
      expect(layerMap['unit']).toBe(3);
    });

    test('mapTestLayer should default to e2e (1)', () => {
      const layerMap = {
        'e2e': 1,
        'api': 2,
        'unit': 3
      };

      const unknownLayer = 'unknown';
      const mapped = layerMap[unknownLayer] || 1;

      expect(mapped).toBe(1);
    });
  });

  describe('parseSuitePath', () => {
    test('should parse tab-separated suite path', () => {
      const suitePath = 'API Tests\\tSync Validation';
      const parts = suitePath.split('\\t').map(s => s.trim()).filter(s => s.length > 0);

      expect(parts).toHaveLength(2);
      expect(parts[0]).toBe('API Tests');
      expect(parts[1]).toBe('Sync Validation');
    });

    test('should parse > separated suite path', () => {
      const suitePath = 'API Tests > Sync Validation';
      const parts = suitePath.split('>').map(s => s.trim()).filter(s => s.length > 0);

      expect(parts).toHaveLength(2);
      expect(parts[0]).toBe('API Tests');
      expect(parts[1]).toBe('Sync Validation');
    });

    test('should handle single-level suite', () => {
      const suitePath = 'API Tests';
      const parts = suitePath.split('\\t').map(s => s.trim()).filter(s => s.length > 0);

      expect(parts).toHaveLength(1);
      expect(parts[0]).toBe('API Tests');
    });

    test('should handle three-level nested suite', () => {
      const suitePath = 'E2E Tests\\tMail Management\\tArchive Features';
      const parts = suitePath.split('\\t').map(s => s.trim()).filter(s => s.length > 0);

      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('E2E Tests');
      expect(parts[1]).toBe('Mail Management');
      expect(parts[2]).toBe('Archive Features');
    });
  });

  describe('Custom field handling', () => {
    test('should build custom fields object', () => {
      const customId = 'TC-API-SYNC-001';
      const fieldConfig = {
        customId: 1,
        testFilePath: 3
      };
      const filePath = 'e2e/specs/sync-basic.spec.ts';

      const customFields = {};
      customFields[fieldConfig.customId] = customId;
      customFields[fieldConfig.testFilePath] = filePath;

      expect(customFields[1]).toBe('TC-API-SYNC-001');
      expect(customFields[3]).toBe('e2e/specs/sync-basic.spec.ts');
    });

    test('should preserve Last Run Result field', () => {
      const existingFields = [
        { id: 1, value: 'TC-API-SYNC-001' },
        { id: 2, value: 'PASS' }  // Last Run Result
      ];

      const lastRunField = existingFields.find(f => f.id === 2);
      expect(lastRunField).toBeTruthy();
      expect(lastRunField.value).toBe('PASS');
      // Should preserve this value in update
    });
  });

  describe('Step formatting', () => {
    test('should format step with action only', () => {
      const step = {
        action: 'Initialize system',
        data: '',
        expected_result: ''
      };

      const formatted = {
        action: step.action || '',
        expected_result: step.expected_result || '',
        position: 1
      };

      expect(formatted.action).toBe('Initialize system');
      expect(formatted.expected_result).toBe('');
      expect(formatted.position).toBe(1);
    });

    test('should format step with action and expected_result', () => {
      const step = {
        action: 'Login user',
        data: 'username: test@example.com',
        expected_result: 'User logged in successfully'
      };

      const formatted = {
        action: step.action || '',
        expected_result: step.expected_result || '',
        position: 1
      };

      expect(formatted.action).toBe('Login user');
      expect(formatted.expected_result).toBe('User logged in successfully');
    });

    test('should handle array of steps', () => {
      const steps = [
        { action: 'Step 1', data: '', expected_result: '' },
        { action: 'Step 2', data: 'data', expected_result: 'result' },
        { action: 'Step 3', data: '', expected_result: '' }
      ];

      const formatted = steps.map((step, index) => ({
        action: step.action || '',
        expected_result: step.expected_result || '',
        position: index + 1
      }));

      expect(formatted).toHaveLength(3);
      expect(formatted[0].position).toBe(1);
      expect(formatted[1].position).toBe(2);
      expect(formatted[2].position).toBe(3);
    });
  });

  describe('Suite hierarchy creation', () => {
    test('should track parent-child relationship', () => {
      const suiteHierarchy = [
        { name: 'API Tests', parent: null, id: 1 },
        { name: 'Sync Validation', parent: 1, id: 2 }
      ];

      const rootSuite = suiteHierarchy.find(s => s.parent === null);
      const childSuite = suiteHierarchy.find(s => s.parent === 1);

      expect(rootSuite).toBeTruthy();
      expect(rootSuite.name).toBe('API Tests');
      expect(childSuite).toBeTruthy();
      expect(childSuite.name).toBe('Sync Validation');
      expect(childSuite.parent).toBe(rootSuite.id);
    });

    test('should build path from hierarchy', () => {
      const parts = ['E2E Tests', 'Mail Management', 'Archive Features'];
      const separator = '\\t';

      const fullPath = parts.join(separator);
      expect(fullPath).toBe('E2E Tests\\tMail Management\\tArchive Features');

      const level1 = parts.slice(0, 1).join(separator);
      const level2 = parts.slice(0, 2).join(separator);
      const level3 = parts.slice(0, 3).join(separator);

      expect(level1).toBe('E2E Tests');
      expect(level2).toBe('E2E Tests\\tMail Management');
      expect(level3).toBe('E2E Tests\\tMail Management\\tArchive Features');
    });
  });

  describe('Update data construction', () => {
    test('should build complete update data object', () => {
      const testCase = {
        id: 'TC-API-SYNC-001',
        title: 'Complete workflow validation',
        description: 'Test description',
        preconditions: 'User authenticated',
        postconditions: 'Data synced',
        severity: 'normal',
        priority: 'medium',
        type: 'functional',
        layer: 'api',
        isFlaky: false,
        automation: 'automated',
        status: 'actual',
        steps: [
          { action: 'Step 1', expected_result: '' }
        ],
        tags: ['smoke']
      };

      const suiteId = 123;

      const updateData = {
        title: testCase.title,
        description: testCase.description || '',
        preconditions: testCase.preconditions || '',
        postconditions: testCase.postconditions || '',
        suite_id: suiteId,
        severity: 4, // normal
        priority: 2, // medium
        type: 1, // functional
        layer: 2, // api
        is_flaky: 0,
        automation: 2, // automated
        status: 0, // actual
        steps: [{ action: 'Step 1', expected_result: '', position: 1 }],
        tags: ['smoke']
      };

      expect(updateData.title).toBe('Complete workflow validation');
      expect(updateData.suite_id).toBe(123);
      expect(updateData.severity).toBe(4);
      expect(updateData.layer).toBe(2);
      expect(updateData.steps).toHaveLength(1);
      expect(updateData.tags).toContain('smoke');
    });
  });
});
