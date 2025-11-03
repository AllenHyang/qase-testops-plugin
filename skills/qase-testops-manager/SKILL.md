---
name: qase-testops-manager
version: "3.6"
description: Manages Qase TestOps integration. Sync Playwright tests, review test standards, cleanup suites, query and delete test cases. Code First approach with bidirectional updates between code and Qase Repository.
---

# Qase TestOps Manager

Manage Qase TestOps integration for Playwright tests with Code First approach.

## When to Use This Skill

Use this skill when working with Qase TestOps integration:
- **Creating/updating** test cases from Playwright code
- **Maintaining** test quality and organization
- **Querying** or managing test data in Qase

## Core Principles

**Code First Architecture**:
- Test code (`test.describe()` nesting) is the single source of truth
- Automatically extracts Suite hierarchy from code structure
- Syncs to Qase Repository with bidirectional updates

**Dual Process Design**:
- **TestOps Manager**: Creates/updates test case structure (from code)
- **Playwright Reporter**: Reports test execution results (createCase: false)

## Quick Start

### Full Sync (Most Common)

Extract tests from code → Sync to Qase → Update qase.id() in code:

```bash
node ~/.claude/skills/qase-testops-manager/scripts/full-sync.js
```

### Other Common Operations

```bash
# Sync single test (by Qase ID or Custom ID)
./scripts/sync-single-case.js EA-955
./scripts/sync-single-case.js TC-UI-SYNC-001

# Review test standards (with scoring)
./scripts/review-test-standards.js

# Cleanup empty suites
./scripts/cleanup-empty-suites.js --yes

# Compare local vs Qase
./scripts/compare-with-qase.js
```

**Base Path**: `~/.claude/skills/qase-testops-manager/`

## Example Test Structure

```typescript
test.describe('API Tests', () => {              // Suite Level 1
  test.describe('Contract Validation', () => {  // Suite Level 2
    test('TC-API-CONTRACT-001: Validate response', async () => {
      qase.id(545);  // Auto-added by sync
      await test.step('Call API', async () => {
        // Test logic
      });
    });
  });
});
```

## Configuration

Create `.qase-config.json` in project root:

```json
{
  "e2eDir": "e2e/specs",
  "outputDir": "e2e/qase",
  "qase": {
    "apiToken": "<QASE_API_TOKEN>",
    "projectCode": "YOUR_PROJECT_CODE"
  }
}
```

**Setup**:
1. Get API token: Qase → Personal Settings → API Tokens
2. Get project code from URL: `https://app.qase.io/project/ABC` → use `ABC`

## Available Scripts

### Most Used

| Script | Purpose |
|--------|---------|
| `full-sync.js` | Complete sync pipeline (extract → sync → update) |
| `sync-single-case.js` | Sync one test case (supports EA-955 or TC-UI-SYNC-001) |
| `review-test-standards.js` | Audit test code with scoring (90+ = ready) |
| `cleanup-empty-suites.js` | Remove empty Suites from Qase |
| `compare-with-qase.js` | Compare local tests vs Qase Repository |

**Total**: 21 scripts available. See [workflow.md](references/workflow.md) for complete list.

## Test Standards

Each test should include:
- **Custom ID**: `TC-{LAYER}-{MODULE}-{NUMBER}` (e.g., TC-API-SYNC-001)
- **qase.id()**: Link to Qase (auto-added by sync)
- **test.describe()**: Define Suite hierarchy (Code First)
- **test.step()**: Organize test steps (recommended)

**Scoring**: Run `review-test-standards.js` to check compliance
- 90+ ✅ Excellent (ready to commit)
- 80-89 🟡 Good (consider fixing warnings)
- < 80 ❌ Needs work (fix errors)

## Key Workflows

**Full Sync Pipeline**:
```
Code → Extract → CSV → Qase Repository → Update qase.id() → CSV snapshot
```

**Duration**: 20-30 seconds (depends on test count)

See detailed workflows: `cat references/workflow.md`

## Best Practices

**DO** ✅:
- Use `test.describe()` nesting for Suite hierarchy
- Run `full-sync.js` before committing
- Use `sync-single-case.js` for quick single test updates

**DON'T** ❌:
- Manually edit CSV Qase ID column (sync overwrites)
- Manually modify `qase.id()` (let sync handle it)
- Create test cases in Qase UI (always sync from code)

## Quick FAQ

**Q: When to run full-sync vs sync-single-case?**
- `full-sync`: New tests, title changes, Suite changes
- `sync-single-case`: Quick update for one modified test

**Q: Does sync overwrite Qase edits?**
- Overwrites: titles, steps, descriptions (Code First)
- Preserves: other fields (priority, custom fields)

## Documentation

**Core References**:
- `references/workflow.md` - Complete workflows and troubleshooting
- `references/test-standards.md` - Detailed coding standards
- `references/suite-organization-standards.md` - Suite structure guide

**Access**: `cat ~/.claude/skills/qase-testops-manager/references/<filename>`

---

**Version**: 3.6 (Optimized: concise description, 3 high-level scenarios, streamlined content)
**Last Updated**: 2025-11-03
