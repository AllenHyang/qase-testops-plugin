# Custom ID Standards

## Overview

This document defines the standard format for test case Custom IDs in Qase. Following these standards ensures consistency, clarity, and maintainability across the test suite.

## Recommended Format

### Structure: `TC-{LAYER}-{MODULE}-{NUMBER}`

**Examples:**
- `TC-API-SYNC-001` - API layer sync test
- `TC-UI-INBOX-001` - UI layer inbox test
- `TC-E2E-WORKFLOW-001` - End-to-end workflow test

## Components

### 1. Prefix: `TC`
- **TC** = Test Case
- Always uppercase
- Followed by hyphen

### 2. Layer (LAYER)
Identifies the testing layer or scope:

| Layer | Description | Use Case |
|-------|-------------|----------|
| `API` | Pure API testing | Backend endpoints, no UI interaction |
| `UI` | Pure UI testing | Frontend components, visual validation |
| `E2E` | End-to-end testing | Complete user scenarios, full stack |
| `INT` | Integration testing | Component/service integration |
| `PERF` | Performance testing | Load, stress, scalability tests |

### 3. Module (MODULE)
Identifies the functional area:

| Module | Description |
|--------|-------------|
| `SYNC` | Mail synchronization |
| `INBOX` | Inbox functionality |
| `ACCOUNT` | Account management |
| `SEARCH` | Search functionality |
| `TAG` | Tag/label management |
| `ARCHIVE` | Archive functionality |
| `AI` | AI-powered features |
| `CONTRACT` | API contract validation |
| `SMOKE` | Smoke tests |
| `WORKFLOW` | Core user workflows |
| `AUTH` | Authentication |
| `SETTINGS` | Settings and preferences |

**Adding New Modules:**
- Use 2-8 uppercase letters
- Keep names concise and descriptive
- Document new modules in this table

### 4. Number (NUMBER)
Sequential identifier within layer-module combination:

- **Format:** 3-digit zero-padded (001-999)
- **Scope:** Independent per layer-module pair
- **Example:** `TC-API-SYNC-001`, `TC-API-SYNC-002`, `TC-UI-SYNC-001` (different layer)

## Benefits

### ✅ Clear Hierarchy
Instantly identify test layer and functional area

### ✅ Easy Filtering
Filter by layer (`TC-API-*`) or module (`TC-*-SYNC-*`)

### ✅ Scalable
Supports 999 tests per layer-module combination

### ✅ Industry Standard
Similar to Jira, TestRail, and other ALM tools

### ✅ Search-Friendly
Easy to search, sort, and organize in Qase

## Validation Rules

### Valid IDs
```
✅ TC-API-SYNC-001
✅ TC-UI-INBOX-042
✅ TC-E2E-WORKFLOW-100
✅ TC-PERF-SEARCH-005
```

### Invalid IDs
```
❌ EA-140              (no layer/module)
❌ TC-SYNC-001         (missing layer)
❌ TC-API-001          (missing module)
❌ tc-api-sync-001     (lowercase)
❌ TC-API-SYNC-1       (not zero-padded)
❌ TC-API-LONGNAMEHERE-001  (module too long)
```

## Migration Guide

### From Simple Format (e.g., EA-XXX)

**Step 1: Analyze existing tests**
```bash
# List all test IDs
grep -r "EA-[0-9]" e2e/specs/
```

**Step 2: Map to new format**
```
EA-140 (smoke test)     → TC-UI-SMOKE-001
EA-112 (API contract)   → TC-API-CONTRACT-001
```

**Step 3: Update test files**
Replace old IDs with new format in test names

**Step 4: Update configuration**
```json
{
  "testIdPattern": "TC-(?:API|UI|E2E|INT|PERF)-(?:SYNC|INBOX|ACCOUNT|SEARCH|TAG|ARCHIVE|AI|CONTRACT|SMOKE|WORKFLOW|AUTH|SETTINGS)-\\d{3}"
}
```

## Validation Workflow

### Automatic Validation
Run validation before generating CSV:

```bash
node scripts/validate-test-ids.js
```

**Output:**
- Lists all test IDs found in code
- Flags non-compliant IDs
- Suggests corrections
- Exits with error if validation fails

### Manual Review
Review generated CSV for ID consistency:

```bash
node scripts/generate-csv.js --validate
```

Includes validation report in console output.

## Best Practices

### 1. Assign IDs Early
Add Custom ID when writing the test, not retroactively

### 2. Keep Modules Focused
Each module should represent a distinct functional area

### 3. Don't Reuse Numbers
Once assigned, don't reuse a number even if test is deleted

### 4. Document Special Cases
If deviating from standard, document reason in test description

### 5. Review Before Sync
Always validate IDs before syncing to Qase

## Examples by Test Type

### API Tests
```typescript
test('TC-API-SYNC-001: Workspace API returns valid structure', async ({ request }) => {
  await test.step('Send GET request to /api/mail/workspace', async () => {
    // ...
  })
})
```

### UI Tests
```typescript
test('TC-UI-INBOX-001: Display email list on load', async ({ page }) => {
  await test.step('Navigate to inbox', async () => {
    // ...
  })
})
```

### E2E Tests
```typescript
test('TC-E2E-WORKFLOW-001: Complete email management workflow', async ({ page }) => {
  await test.step('Login and navigate to inbox', async () => {
    // ...
  })
})
```

## FAQs

**Q: Can I use custom layers beyond API/UI/E2E?**
A: Yes, but document them in this file and update the regex pattern.

**Q: What if a test spans multiple modules?**
A: Use the primary module, or create a composite module (e.g., `WORKFLOW`).

**Q: How do I handle deprecated tests?**
A: Mark as deprecated in Qase, don't delete the ID. Helps with historical tracking.

**Q: Can numbers exceed 999?**
A: Consider splitting into sub-modules (e.g., `SYNC-BASIC`, `SYNC-ADV`).

## Related Documentation

- [Qase V2 Format](./qase-v2-format.md) - CSV format specification
- [Workflows](./workflows.md) - Complete workflow guides
- [README](../skill.md) - Skill overview and quick start
