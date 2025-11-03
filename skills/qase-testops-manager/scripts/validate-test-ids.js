#!/usr/bin/env node

/**
 * Validate Test IDs
 *
 * Scans E2E test files and validates Custom IDs against standards.
 * Reports non-compliant IDs and suggests corrections.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load configuration
const projectRoot = process.cwd();
const configPath = path.join(projectRoot, '.qase-config.json');

if (!fs.existsSync(configPath)) {
  console.error('❌ .qase-config.json not found in project root');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Standard ID pattern: TC-{LAYER}-{MODULE}-{NUMBER}
// LAYER: 2-8 uppercase letters (API, UI, E2E, INT, PERF, etc.)
// MODULE: 2-12 uppercase letters (SYNC, INBOX, ACCOUNT, etc.)
// NUMBER: 3 digits (001-999)
const STANDARD_PATTERN = /^TC-[A-Z]{2,8}-[A-Z]{2,12}-\d{3}$/;

/**
 * Extract test IDs from a file
 */
function extractTestIds(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const testIds = [];

  // Match test IDs in test names (various formats)
  const patterns = [
    /test\(['"`]([^:]+):/g,  // test('ID: ...')
    /test\(['"`]([^\s]+)\s/g, // test('ID ...')
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const potentialId = match[1].trim();
      // Only include if it looks like an ID (contains hyphens and numbers)
      if (/[A-Z]+-.*\d+/.test(potentialId)) {
        testIds.push({
          id: potentialId,
          file: path.relative(projectRoot, filePath),
          line: content.substring(0, match.index).split('\n').length
        });
      }
    }
  }

  return testIds;
}

/**
 * Validate a single test ID
 */
function validateTestId(testId) {
  if (!STANDARD_PATTERN.test(testId)) {
    return {
      valid: false,
      issues: [parseNonStandardId(testId)]
    };
  }

  return {
    valid: true,
    issues: []
  };
}

/**
 * Parse non-standard ID and suggest corrections
 */
function parseNonStandardId(testId) {
  // Common patterns and suggestions
  if (/^[A-Z]+-\d+$/.test(testId)) {
    return `Simple format detected. Needs layer and module. Example: TC-E2E-SMOKE-001`;
  }

  if (/^TC-[A-Z]+-\d+$/.test(testId)) {
    const parts = testId.split('-');
    return `Missing layer or module. Format: TC-{LAYER}-${parts[1]}-${parts[2].padStart(3, '0')}`;
  }

  if (testId.toLowerCase().startsWith('tc-')) {
    return `Lowercase detected. IDs must be uppercase: ${testId.toUpperCase()}`;
  }

  return `Does not match standard format: TC-{LAYER}-{MODULE}-{NUMBER}`;
}

/**
 * Suggest correction for invalid ID
 */
function suggestCorrection(testId, fileName) {
  // Try to infer from file name
  const fileBaseName = path.basename(fileName, '.spec.ts').toLowerCase();

  let suggestedModule = 'WORKFLOW';
  if (fileBaseName.includes('sync')) suggestedModule = 'SYNC';
  else if (fileBaseName.includes('api') || fileBaseName.includes('contract')) suggestedModule = 'CONTRACT';
  else if (fileBaseName.includes('search')) suggestedModule = 'SEARCH';
  else if (fileBaseName.includes('tag')) suggestedModule = 'TAG';
  else if (fileBaseName.includes('archive')) suggestedModule = 'ARCHIVE';
  else if (fileBaseName.includes('ai')) suggestedModule = 'AI';
  else if (fileBaseName.includes('smoke')) suggestedModule = 'SMOKE';
  else if (fileBaseName.includes('inbox')) suggestedModule = 'INBOX';
  else if (fileBaseName.includes('account')) suggestedModule = 'ACCOUNT';

  let suggestedLayer = 'E2E';
  if (fileBaseName.includes('api')) suggestedLayer = 'API';
  else if (fileBaseName.includes('ui')) suggestedLayer = 'UI';

  // Extract number if present
  const numberMatch = testId.match(/\d+/);
  const number = numberMatch ? numberMatch[0].padStart(3, '0') : '001';

  return `TC-${suggestedLayer}-${suggestedModule}-${number}`;
}

/**
 * Main validation
 */
function main() {
  console.log('🔍 Validating Test IDs...\n');

  const e2eDir = path.join(projectRoot, config.e2eDir || 'e2e/specs');

  if (!fs.existsSync(e2eDir)) {
    console.error(`❌ E2E directory not found: ${e2eDir}`);
    process.exit(1);
  }

  // Find all spec files
  const specFiles = fs.readdirSync(e2eDir)
    .filter(file => file.endsWith('.spec.ts'))
    .map(file => path.join(e2eDir, file));

  let totalIds = 0;
  let validIds = 0;
  let invalidIds = 0;
  const allIssues = [];

  // Extract and validate IDs
  for (const file of specFiles) {
    const testIds = extractTestIds(file);

    for (const { id, file: relFile, line } of testIds) {
      totalIds++;
      const validation = validateTestId(id);

      if (validation.valid) {
        validIds++;
        console.log(`✅ ${id} (${relFile}:${line})`);
      } else {
        invalidIds++;
        console.log(`❌ ${id} (${relFile}:${line})`);
        validation.issues.forEach(issue => {
          console.log(`   └─ ${issue}`);
        });

        const suggestion = suggestCorrection(id, relFile);
        console.log(`   💡 Suggested: ${suggestion}\n`);

        allIssues.push({
          id,
          file: relFile,
          line,
          issues: validation.issues,
          suggestion
        });
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Validation Summary');
  console.log('='.repeat(60));
  console.log(`Total Test IDs: ${totalIds}`);
  console.log(`Valid IDs: ${validIds} ✅`);
  console.log(`Invalid IDs: ${invalidIds} ❌`);

  if (invalidIds > 0) {
    console.log('\n⚠️  Validation failed. Please fix the issues above.');
    console.log('\n📖 For ID standards, see:');
    console.log('   ~/.claude/skills/qase-testops-manager/references/custom-id-standards.md');
    process.exit(1);
  } else {
    console.log('\n✨ All test IDs are valid!');
    process.exit(0);
  }
}

main();
