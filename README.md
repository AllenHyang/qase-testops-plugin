# Qase TestOps Plugin

A Claude Code plugin for managing Qase TestOps integration with Playwright tests.

## Overview

This plugin provides comprehensive Qase TestOps management capabilities through the `qase-testops-manager` skill, enabling seamless synchronization between your Playwright test code and Qase Repository.

## Features

- **Code First Approach**: Test code is the single source of truth
- **Bidirectional Sync**: Sync test cases from code to Qase and back
- **Test Standards Review**: Automated test quality scoring and validation
- **Suite Management**: Cleanup and organize test suites
- **Playwright Integration**: Native support for Playwright test structure

## Installation

### Option 1: Install from GitHub (Recommended)

```bash
# Clone the repository
git clone https://github.com/AllenHyang/qase-testops-plugin.git ~/.claude/plugins/qase-testops-plugin

# Restart Claude Code
```

### Option 2: Local Installation

```bash
# Copy to Claude plugins directory
cp -r /path/to/qase-testops-plugin ~/.claude/plugins/

# Restart Claude Code
```

## Quick Start

The `qase-testops-manager` skill will be automatically available after installation. Claude will use it when you mention tasks related to:

- Syncing Qase tests
- Reviewing test standards
- Managing test cases
- Cleaning up test suites
- Querying Qase data

### Example Usage

Simply ask Claude:

```
"Sync my Playwright tests to Qase"
"Review test standards for my test suite"
"Cleanup empty suites in Qase"
"Compare local tests with Qase repository"
```

## Configuration

Create a `.qase-config.json` file in your project root:

```bash
# Copy the example config
cp .qase-config.example.json .qase-config.json

# Edit with your real credentials
# IMPORTANT: Never commit .qase-config.json (it's in .gitignore)
```

```json
{
  "e2eDir": "e2e/specs",
  "outputDir": "e2e/qase",
  "qase": {
    "apiToken": "<YOUR_REAL_API_TOKEN>",
    "projectCode": "YOUR_PROJECT_CODE"
  }
}
```

**Setup Steps**:
1. Get API token: Qase → Personal Settings → API Tokens
2. Get project code from Qase URL: `https://app.qase.io/project/ABC` → use `ABC`

**Security**: See [SECURITY.md](SECURITY.md) for credential management best practices.

## Skills Included

### qase-testops-manager (v3.6)

Manages Qase TestOps integration with the following capabilities:

- Full sync pipeline (code → Qase → code annotations)
- Single test case sync
- Test standards review with scoring
- Empty suite cleanup
- Local vs Qase comparison
- 21 utility scripts for various operations

For detailed documentation, see the [skill documentation](skills/qase-testops-manager/SKILL.md).

## Plugin Structure

```
qase-testops-plugin/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest
├── skills/
│   └── qase-testops-manager/  # Main skill directory
│       ├── SKILL.md           # Skill definition
│       ├── scripts/           # Utility scripts
│       ├── lib/              # Core libraries
│       ├── references/       # Documentation
│       └── ...
└── README.md                 # This file
```

## Requirements

- Node.js (for running sync scripts)
- Qase TestOps account
- Playwright tests (for test sync features)

## Support

For issues, questions, or contributions:

- GitHub Issues: [https://github.com/AllenHyang/qase-testops-plugin/issues](https://github.com/AllenHyang/qase-testops-plugin/issues)
- Documentation: See `skills/qase-testops-manager/references/` directory

## License

MIT

## Version

3.6.0 - Aligned with qase-testops-manager skill version

## Author

Allen
