# Testing

This project includes comprehensive tests for the security audit functionality.

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Test Coverage

The test suite includes:

-   **Pattern Detection Tests**: Validates that security patterns (hardcoded passwords, tokens, secrets) are correctly identified
-   **File Security Analysis**: Tests safe vs unsafe content detection
-   **Critical Files Validation**: Ensures required project files exist
-   **Security Report Generation**: Validates the structure and content of security reports

## Security Audit

The security audit script (`security-audit.js`) includes automated checks for:

-   Hardcoded passwords, tokens, and secrets
-   Bitbucket app passwords (ATB format)
-   GitHub tokens (ghp format)
-   Environment configuration validation
-   Critical file existence and security

To run the security audit:

```bash
npm run security-audit
```

The audit will exit with code 1 if any security issues are found, making it suitable for CI/CD pipelines.
