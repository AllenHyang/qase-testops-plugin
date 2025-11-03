# Qase v2 CSV Format Reference

## CSV File Format Specification

### Required Fields

- `v2.id`: Test case ID (leave empty for auto-assignment by Qase)
- `title`: Test case title (required)

### Important Fields

- `description`: Test case description
- `preconditions`: Prerequisites before test execution
- `postconditions`: Expected state after test execution
- `suite`: Test suite name
- `suite_id`: Suite ID (numeric)
- `suite_parent_id`: Parent suite ID for nested suites
- `priority`: Priority level (not set, high, medium, low)
- `severity`: Severity level (blocker, critical, major, normal, minor, trivial)
- `type`: Test type (functional, smoke, regression, security, usability, performance, acceptance)
- `layer`: Test layer (e2e, api, unit)
- `automation`: Automation status (automated, to-be-automated, is-not-automated)
- `status`: Test status (draft, actual, deprecated)
- `tags`: Comma-separated tags
- `behavior`: Test behavior (positive, negative, destructive)
- `is_flaky`: Flaky test indicator (yes, no)
- `is_muted`: Muted test indicator (yes, no)

### Test Steps Fields

- `steps_actions`: Step actions (required, wrap in double quotes)
- `steps_data`: Step data (optional, wrap in double quotes)
- `steps_result`: Expected result (optional, wrap in double quotes)

**Step Format Example:**
```csv
"1. Navigate to page
2. Get API response
3. Verify data structure"
```

## Field Mapping

| Test Information | CSV Field | Default Value |
|-----------------|-----------|---------------|
| Test ID | v2.id | (empty, Qase auto-assigns) |
| Test Title | title | Extracted from test name |
| Description | description | Extracted from comments |
| Test Suite | suite | Extracted from file name |
| Test Type | type | functional |
| Automation Status | automation | automated |
| Test Layer | layer | e2e |
| Test Status | status | actual |
| Priority | priority | medium |
| Severity | severity | normal |

## CSV Structure Example

### Suite Definition Row

```csv
,,,,,1,,Suite Name,1,,,,,,,,,,,,,
```

Fields:
- `suite_id`: 1
- `suite`: "Suite Name"
- `suite_without_cases`: 1 (indicates this is a suite-only row)

### Test Case Row

```csv
,Test Title,Test Description,,,1,,Suite Name,,medium,normal,functional,e2e,automated,actual,no,,positive,tag1;tag2,"1. Step one
2. Step two
3. Step three",,
```

## Test Case ID Management

### Code Test ID
Format: `TC-{MODULE}-{NUMBER}:`
- Example: `TC-API-001:`, `TC-SYNC-001:`
- Used in test code for organization
- Appears in test title

### Qase Case ID
- Numeric ID or `PROJECT-123` format
- Auto-assigned by Qase
- Match via `title.startsWith('TC-XXX-NNN')`

## Import Notes

1. **Step Format**: v2 format requires all step content wrapped in double quotes
2. **Suite Structure**: Define suite rows before test case rows
3. **Custom Fields**: Use Qase API to get custom field IDs if needed
4. **Tags**: Non-existent tags are auto-created
5. **Data Source**: Use CSV as single source of truth, keep in version control

## Common Issues

### Line Breaks in Steps
- Use actual line breaks within double-quoted strings
- Do not use `\n` or other escape sequences

### Special Characters
- Wrap fields containing commas in double quotes
- Double quotes inside fields must be escaped as `""`

### Suite Hierarchy
- Set `suite_parent_id` for nested suites
- Parent suites must be defined before child suites
