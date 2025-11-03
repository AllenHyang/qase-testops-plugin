# Suite Organization Standards

## Overview

This document defines the standard structure for organizing test suites in Qase. Following these standards ensures consistency, scalability, and maintainability across the test repository.

## Three-Tier Suite Structure

### Tier 1: Test Layer (Root Suites)

Organize by testing layer to separate concerns:

```
📦 API Tests
📦 E2E Tests
📦 UI Tests
📦 Integration Tests
📦 Performance Tests
```

**Benefits:**
- Clear separation of testing scope
- Easy filtering by test type
- Parallel execution planning
- Team assignment (API team, UI team, etc.)

### Tier 2: Feature Area (Sub-Suites)

Group tests by functional domain:

```
📦 API Tests
  ├─ Contract Validation
  ├─ Mail Sync Endpoints
  ├─ Account Management
  └─ Search & Filter

📦 E2E Tests
  ├─ Core Workflows
  ├─ Progressive Sync
  ├─ Archive & Cleanup
  └─ Tag Management

📦 UI Tests
  ├─ Smoke Tests
  ├─ Sync Display
  ├─ UX Validation
  └─ Component Tests
```

**Benefits:**
- Functional grouping
- Feature-based test planning
- Easy navigation in Qase UI
- Clear ownership by feature teams

### Tier 3: Test Scenario (Sub-Sub-Suites, Optional)

For complex features, add a third tier:

```
📦 E2E Tests
  └─ Progressive Sync
      ├─ Two-Phase Logic
      ├─ Complete Flow
      └─ Error Recovery
```

**Use When:**
- Feature has 10+ test cases
- Multiple testing scenarios exist
- Need finer granularity

## Naming Conventions

### Suite Names

**Format:** `{Layer} - {Feature}` or `{Feature Area}`

#### Layer Names (Tier 1)
```
✅ API Tests
✅ E2E Tests
✅ UI Tests
✅ Integration Tests
✅ Performance Tests

❌ API (too short, ambiguous)
❌ 后端测试 (avoid mixing languages)
❌ api_tests (use proper case)
```

#### Feature Names (Tier 2)
```
✅ Contract Validation
✅ Mail Sync Endpoints
✅ Progressive Sync
✅ Smoke Tests

❌ contract (not descriptive)
❌ sync ux (inconsistent case)
❌ 邮件同步 (avoid mixing languages)
```

### Language Consistency

**Rule:** Use **English only** for suite names

**Rationale:**
- International team collaboration
- Tool compatibility
- Search and filter consistency
- Professional standard

**Chinese can be used in:**
- Test case descriptions
- Step details
- Comments and documentation
- But NOT in suite names or test IDs

## Suite Hierarchy Separator

### Standard Separator: `\t` (Tab Character)

**CRITICAL:** Always use `\t` (tab character) as the suite hierarchy separator in `qase.suite()` calls, as specified by playwright-qase-reporter documentation.

```typescript
✅ CORRECT - Use \t (tab character)
qase.suite('E2E Tests\tArchive');
qase.suite('API Tests\tSync Validation');
qase.suite('UI Tests\tSmoke Tests');
```

### Why `\t` is the Standard

1. **Official Specification**: playwright-qase-reporter documentation explicitly requires tab character for hierarchy
2. **Correct Parsing**: Reporter's internal logic recognizes only `\t` as hierarchy delimiter
3. **Automatic Conversion**: JavaScript/TypeScript automatically converts `\t` escape sequence to real tab character (ASCII 9)
4. **Qase UI Display**: Tab-separated suites correctly display as parent-child hierarchies in Qase

**Important Note:**
In TypeScript/JavaScript strings, `\t` is an escape sequence that represents a real tab character, not the literal characters backslash and 't'.

### ❌ DON'T Use These Separators

**Greater-than with Spaces (` > `)**:
```typescript
❌ WRONG - Space-greater-space
qase.suite('E2E Tests > Archive');
// Problem: Reporter doesn't recognize > as hierarchy separator
// Result: Qase displays flat string "E2E Tests > Archive" instead of nested structure
```

**Slash (`/`)**:
```typescript
❌ WRONG - Forward slash
qase.suite('E2E Tests / Archive');
// Problem: Reporter doesn't recognize / as hierarchy separator
// Result: Creates flat suite name
```

**Backslash (`\`)**:
```typescript
❌ WRONG - Single backslash
qase.suite('E2E Tests\Archive');
// Problem: Invalid escape sequence syntax error
// Result: Suite creation fails or hierarchy is incorrect
```

**Spaces Only**:
```typescript
❌ WRONG - No separator
qase.suite('E2E Tests Archive');
// Problem: Cannot distinguish hierarchy levels
// Result: Flat structure instead of nested
```

### Implementation in Code

**test.describe() Structure:**
```typescript
import { test, expect } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';

test.describe('E2E Tests', () => {           // Level 1
  test.describe('Archive', () => {           // Level 2

    test('TC-E2E-ARCHIVE-001: Test title', async () => {
      qase.id(935);
      qase.suite('E2E Tests\tArchive');     // ✅ Explicit hierarchy with \t

      await test.step('Step 1', async () => {
        // Test logic
      });
    });
  });
});
```

### Sync Script Compatibility

The sync scripts are configured to parse `\t` separator:

```javascript
// sync-to-qase.js
function parseSuitePath(suiteName) {
  return suiteName.split('\t').map(s => s.trim()).filter(s => s.length > 0);
}

function ensureSuiteHierarchy(config, fullSuitePath, suiteMap, existingSuites = []) {
  const parts = parseSuitePath(fullSuitePath);

  for (let i = 0; i < parts.length; i++) {
    const currentPath = parts.slice(0, i + 1).join('\t');  // ✅ Rejoin with \t
    // ... suite creation logic
  }
}
```

### Validation

Before syncing, verify all test files use correct separator:

```bash
# Find any files not using \t separator (will show files using other separators)
grep -r "qase\.suite" e2e/specs/*.spec.ts | grep -v "\\\\t"

# Expected output: (empty - all files use correct \t separator)
```

### Migration from Old Separators

If you have existing tests with wrong separators, use batch replacement:

```bash
# Replace > with \t
cd e2e/specs
for file in *.spec.ts; do
  sed -i.bak "s/qase\.suite('\([^']*\) > /qase.suite('\1\\t/g" "$file"
done

# Replace / with \t
for file in *.spec.ts; do
  sed -i.bak "s/qase\.suite('\([^']*\) \/ /qase.suite('\1\\t/g" "$file"
done
```

### Cleanup Empty Suites

After fixing separators, clean up old incorrect suites:

```bash
node ~/.claude/skills/qase-testops-manager/scripts/cleanup-empty-suites.js --yes
```

This removes suites created with wrong separators (e.g., "E2E Tests > Archive", "E2E Tests / Archive")

## Test Case ID to Suite Mapping

### Standard Mapping

Match Custom ID format to suite structure:

| Custom ID Pattern | Tier 1 Suite | Tier 2 Suite |
|-------------------|--------------|--------------|
| `TC-API-SYNC-*` | API Tests | Mail Sync Endpoints |
| `TC-API-CONTRACT-*` | API Tests | Contract Validation |
| `TC-E2E-WORKFLOW-*` | E2E Tests | Core Workflows |
| `TC-E2E-PROGRESSIVE-*` | E2E Tests | Progressive Sync |
| `TC-UI-SMOKE-*` | UI Tests | Smoke Tests |
| `TC-UI-SYNCDISPLAY-*` | UI Tests | Sync Display |

### Mapping Rules

1. **LAYER → Tier 1**: First segment after `TC-` maps to root suite
2. **MODULE → Tier 2**: Second segment maps to feature suite
3. **Consistent naming**: Module name should match suite name (abbreviated)

**Examples:**
```
TC-API-SYNC-001 → API Tests / Mail Sync Endpoints
TC-E2E-WORKFLOW-001 → E2E Tests / Core Workflows
TC-UI-SMOKE-001 → UI Tests / Smoke Tests
```

## Priority and Severity Guidelines

### Priority Levels

Define execution order and frequency:

| Priority | When to Use | Execution Frequency |
|----------|-------------|---------------------|
| **high** | Smoke tests, critical user paths | Every commit/PR |
| **medium** | Standard feature tests | Daily/nightly builds |
| **low** | Edge cases, nice-to-have checks | Weekly/release |

**Example Assignments:**
```
TC-UI-SMOKE-001: high (smoke test)
TC-API-SYNC-001: high (core API)
TC-E2E-WORKFLOW-001: medium (standard flow)
TC-UI-COMPONENT-042: low (edge case)
```

### Severity Levels

Define impact of failure:

| Severity | When to Use | Impact |
|----------|-------------|--------|
| **critical** | Core functionality broken | System unusable |
| **major** | Important feature broken | Major workflow blocked |
| **normal** | Standard feature issue | Workaround exists |
| **minor** | Cosmetic or edge case | Minimal user impact |

**Example Assignments:**
```
TC-API-SYNC-001: critical (sync is core feature)
TC-UI-SMOKE-001: critical (app won't load)
TC-E2E-WORKFLOW-001: major (key user scenario)
TC-UI-COMPONENT-042: minor (rare edge case)
```

### Combined Strategy

Use priority + severity for test selection:

```
Smoke Run (CI/CD):
  - priority: high
  - severity: critical or major

Regression Run (Nightly):
  - priority: high or medium
  - severity: any

Full Run (Release):
  - priority: any
  - severity: any
```

## Tags and Labels

### Standard Tags

Use tags for cross-cutting concerns:

| Tag | Purpose | Example Use Cases |
|-----|---------|-------------------|
| `smoke` | Quick validation | CI/CD gates |
| `regression` | Comprehensive coverage | Pre-release validation |
| `p0` | Highest priority | Hotfix validation |
| `p1` | High priority | Release blockers |
| `flaky` | Known instability | Skip in CI, investigate |
| `manual` | Manual testing required | Exploratory tests |

### Module Tags

Add tags for feature areas (supplement suites):

```
sync, inbox, account, search, tag, archive, ai
```

### Layer Tags

Add tags for test layers (supplement suites):

```
api, e2e, ui, integration, performance
```

**Example Test Case:**
```
ID: TC-API-SYNC-001
Priority: high
Severity: critical
Tags: smoke, regression, p0, api, sync
```

## CSV Field Standards

### Required Fields

Minimum fields for valid test case:

```csv
v2.id,custom_id,title,suite,priority,severity,type,automation,status
```

**Field Values:**

| Field | Valid Values | Default |
|-------|--------------|---------|
| priority | high, medium, low | medium |
| severity | critical, major, normal, minor | normal |
| type | functional, integration, smoke, regression | functional |
| automation | automated, not-automated, manual | automated |
| status | actual, draft, deprecated | actual |

### Suite Fields

**For suite-only rows (no test case):**
```csv
v2.id,suite_id,suite,suite_without_cases
,,API Tests,1
,,Contract Validation,1
```

**For test cases:**
```csv
v2.id,custom_id,title,suite_id,suite
,TC-API-SYNC-001,Workspace API validation,1,Contract Validation
```

**Notes:**
- `suite_without_cases=1`: Suite exists but is empty (parent suite)
- `suite_id`: Numeric identifier for parent suite
- `suite`: Name of the suite containing this test

## Migration from Current Structure

### Current Issues (Based on Review)

```
Current Structure:
├─ UI 冒烟测试 - 基础功能验证 (1)        ❌ Mixed language
├─ API 契约 - 一致性验证 (7)            ❌ Chinese
├─ Mail Sync API Contract (13)       ❌ Inconsistent
├─ 渐进式同步 - 完整流程验证 (1)          ❌ Chinese
├─ 邮件同步 - 渐进式同步功能验证 (1)      ❌ Chinese
├─ UI 邮件同步显示验证 (6)              ❌ Chinese
└─ sync ux (4)                       ❌ Lowercase
```

### Recommended Migration

**Step 1: Map existing to new structure**

```
Current → New Structure

"UI 冒烟测试" → UI Tests / Smoke Tests
"API 契约" → API Tests / Contract Validation
"Mail Sync API Contract" → API Tests / Mail Sync Endpoints
"渐进式同步 - 完整流程" → E2E Tests / Progressive Sync / Complete Flow
"邮件同步 - 渐进式功能" → E2E Tests / Progressive Sync / Two-Phase Logic
"UI 邮件同步显示" → UI Tests / Sync Display
"sync ux" → UI Tests / UX Validation
```

**Step 2: Create new suite structure**

```
📦 API Tests (Tier 1)
  ├─ Contract Validation (Tier 2)
  │   └─ [7 test cases from "API 契约"]
  └─ Mail Sync Endpoints (Tier 2)
      └─ [13 test cases from "Mail Sync API Contract"]

📦 E2E Tests (Tier 1)
  └─ Progressive Sync (Tier 2)
      ├─ Complete Flow (Tier 3)
      │   └─ [1 test case from "渐进式同步 - 完整流程"]
      └─ Two-Phase Logic (Tier 3)
          └─ [1 test case from "邮件同步 - 渐进式功能"]

📦 UI Tests (Tier 1)
  ├─ Smoke Tests (Tier 2)
  │   └─ [1 test case from "UI 冒烟测试"]
  ├─ Sync Display (Tier 2)
  │   └─ [6 test cases from "UI 邮件同步显示"]
  └─ UX Validation (Tier 2)
      └─ [4 test cases from "sync ux"]
```

**Step 3: Add missing test files**

Based on code review, add these suites:

```
📦 E2E Tests
  ├─ Core Workflows
  ├─ Archive & Cleanup
  ├─ Tag Management
  └─ Edge Cases

📦 UI Tests
  └─ AI Features

📦 Integration Tests (if applicable)
  └─ Search & Filter
```

**Step 4: Update CSV and sync**

```bash
# Backup current CSV
cp e2e/qase/qase-test-cases.csv e2e/qase/qase-test-cases.backup.csv

# Update suite structure in CSV manually or regenerate
node ~/.claude/skills/qase-testops-manager/scripts/generate-csv.js

# Review changes
diff e2e/qase/qase-test-cases.backup.csv e2e/qase/qase-test-cases.csv

# Sync to Qase
node ~/.claude/skills/qase-testops-manager/scripts/sync-to-qase.js
```

## Recommended Suite Structure for Current Project

Based on the test files analysis, here's the complete recommended structure:

```
📦 API Tests
  ├─ Contract Validation (7 tests)
  │   ├─ TC-API-CONTRACT-001: Workspace API structure
  │   ├─ TC-API-CONTRACT-002: Email data fields
  │   ├─ TC-API-CONTRACT-003: Mock vs real API
  │   ├─ TC-API-CONTRACT-004: AI API format
  │   ├─ TC-API-CONTRACT-005: Email update API
  │   ├─ TC-API-CONTRACT-006: Folder structure
  │   └─ TC-API-CONTRACT-007: Error response format
  │
  └─ Mail Sync Endpoints (13 tests)
      ├─ TC-API-SYNC-001 to TC-API-SYNC-013
      └─ [Progressive sync, job status, emails API, etc.]

📦 E2E Tests
  ├─ Core Workflows (from core-workflow.spec.ts)
  ├─ Progressive Sync
  │   ├─ Complete Flow (TC-API-SYNC-015)
  │   └─ Two-Phase Logic (TC-API-SYNC-014)
  ├─ Archive & Cleanup (from archive.spec.ts)
  ├─ Tag Management (from tag-management.spec.ts)
  └─ Edge Cases (from edge-cases.spec.ts)

📦 UI Tests
  ├─ Smoke Tests (1 test)
  │   └─ TC-UI-SMOKE-001: Workspace load validation
  ├─ Sync Display (6 tests)
  │   ├─ TC-UI-SYNC-001: Page load
  │   ├─ TC-UI-SYNC-002: Email list display
  │   ├─ TC-UI-SYNC-003: Content accuracy
  │   ├─ TC-UI-SYNC-004: Click interaction
  │   ├─ TC-UI-SYNC-005: Unread count
  │   └─ TC-UI-SYNC-006: Sync button
  ├─ UX Validation (4 tests)
  │   ├─ TC-UI-SYNC-007: Status bar display
  │   ├─ TC-UI-SYNC-008: Toast notifications
  │   ├─ TC-UI-SYNC-009: Account status popover
  │   └─ TC-UI-SYNC-010: Relative time format
  └─ AI Features (from ai-features.spec.ts)

📦 Integration Tests
  └─ Search & Filter (from search.spec.ts)
```

## Configuration Updates

### Update `.qase-config.json`

```json
{
  "e2eDir": "e2e/specs",
  "outputDir": "e2e/qase",
  "csvFileName": "qase-test-cases.csv",
  "testIdPattern": "TC-(?:API|UI|E2E|INT|PERF)-(?:SYNC|INBOX|ACCOUNT|SEARCH|TAG|ARCHIVE|AI|CONTRACT|SMOKE|WORKFLOW|AUTH|SETTINGS|SYNCDISPLAY|PROGRESSIVE|EDGE)-\\d{3}",
  "defaultSuite": "E2E Tests",
  "defaultPriority": "medium",
  "defaultSeverity": "normal",
  "suiteMapping": {
    "API-CONTRACT": "API Tests / Contract Validation",
    "API-SYNC": "API Tests / Mail Sync Endpoints",
    "E2E-WORKFLOW": "E2E Tests / Core Workflows",
    "E2E-PROGRESSIVE": "E2E Tests / Progressive Sync",
    "UI-SMOKE": "UI Tests / Smoke Tests",
    "UI-SYNCDISPLAY": "UI Tests / Sync Display",
    "UI-SYNC": "UI Tests / UX Validation"
  },
  "qase": {
    "apiToken": "your_api_token_here",
    "projectCode": "EA"
  }
}
```

## Maintenance Guidelines

### Regular Reviews

**Monthly:**
- Review suite structure for clarity
- Check for orphaned test cases
- Validate tag usage consistency

**Quarterly:**
- Reassess priority/severity assignments
- Update suite structure for new features
- Archive deprecated suites

### Quality Checks

**Before Sync:**
1. All test cases have Custom IDs
2. Suite names follow conventions
3. Priority/severity appropriate
4. Tags applied consistently

**After Sync:**
1. Verify suite hierarchy in Qase UI
2. Check test case counts match
3. Validate search/filter functionality
4. Review test run configurations

## Best Practices Summary

### ✅ DO

- Use English for suite names
- Follow three-tier structure
- Map Custom IDs to suites logically
- Apply priority/severity consistently
- Use tags for cross-cutting concerns
- Keep CSV as single source of truth
- Review before syncing to Qase

### ❌ DON'T

- Mix languages in suite names
- Create flat suite structures
- Use lowercase or inconsistent naming
- Skip priority/severity assignment
- Create suites without test cases
- Sync without review
- Reuse suite names across layers

## Related Documentation

- [Custom ID Standards](./custom-id-standards.md) - Test case ID format
- [Qase V2 Format](./qase-v2-format.md) - CSV format specification
- [Workflows](./workflows.md) - Complete workflow guides
- [README](../skill.md) - Skill overview and quick start

## Version History

- **v1.0** (2025-11-01): Initial suite organization standards
