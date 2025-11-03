# Security Guidelines

## Credentials Management

This plugin **does NOT** contain any hardcoded credentials or API tokens. All sensitive information must be configured by the user.

## Configuration File

### DO NOT commit these files:
- `.qase-config.json` (production config with real API tokens)
- `.env` files
- Any file containing real credentials

### Safe to commit:
- `.qase-config.example.json` (example config with placeholders)
- Documentation with placeholder values

## Setting Up Configuration

1. Copy the example config:
```bash
cp .qase-config.example.json .qase-config.json
```

2. Edit `.qase-config.json` with your real credentials:
```json
{
  "qase": {
    "apiToken": "your_real_api_token_here",
    "projectCode": "YOUR_PROJECT"
  }
}
```

3. **NEVER commit `.qase-config.json`** - it's already in `.gitignore`

## Getting Your API Token

1. Log in to Qase: https://app.qase.io
2. Go to **Personal Settings** → **API Tokens**
3. Create a new token or copy an existing one
4. Add it to your `.qase-config.json` file

## Checking for Leaked Credentials

Before committing:
```bash
# Check what files will be committed
git status

# Verify no config files are staged
git diff --cached --name-only | grep -E "(config.json|.env)"

# If found, remove from staging
git reset HEAD .qase-config.json
```

## Environment Variables (Alternative)

You can also use environment variables:

```javascript
// In your code
apiToken: process.env.QASE_API_TOKEN
```

```bash
# In your shell
export QASE_API_TOKEN="your_token_here"
```

## Reporting Security Issues

If you discover a security vulnerability, please report it to:
- GitHub Security Advisories (recommended)
- Or email the maintainer directly

**DO NOT** create a public issue for security vulnerabilities.

## Best Practices

✅ **DO**:
- Use `.gitignore` to exclude config files
- Use environment variables for CI/CD
- Rotate API tokens regularly
- Use separate tokens for different environments

❌ **DON'T**:
- Commit real credentials
- Share tokens in chat/email
- Use production tokens in development
- Hardcode credentials in code

---

**Last Updated**: 2025-11-03
