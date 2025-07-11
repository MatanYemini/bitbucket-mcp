# Security Guidelines

## Overview

This document outlines security measures implemented in the Bitbucket MCP server to prevent sensitive data leakage and maintain secure operations.

## Security Measures Implemented

### 1. Credential Protection

-   **Environment Variables**: All sensitive credentials are stored in environment variables, never hardcoded
-   **Logging Sanitization**: Passwords, tokens, and authentication headers are never logged
-   **Error Sanitization**: Error messages are sanitized to prevent credential exposure

### 2. Logging Security

-   **Sensitive Data Filtering**: Automatic filtering of sensitive keys in logs
-   **Log Rotation**: Automatic log rotation with size limits (5MB per file, 5 files max)
-   **Separate Error Logs**: Critical errors are logged separately for better monitoring

### 3. API Security

-   **Request Sanitization**: HTTP requests are logged without sensitive headers
-   **Response Filtering**: API responses are not logged to prevent data exposure
-   **Error Handling**: Standardized error handling prevents information leakage

### 4. Data Handling

-   **No DELETE Operations**: The server only performs read and write operations, no destructive actions
-   **Input Validation**: All user inputs are validated before processing
-   **Safe Defaults**: Secure defaults are used throughout the application

## Security Best Practices

### For Developers

1. **Never log sensitive data** - Use the provided sanitization methods
2. **Validate all inputs** - Check parameters before using them
3. **Use secure defaults** - Prefer security over convenience
4. **Regular security reviews** - Review code for potential vulnerabilities

### For Users

1. **Use App Passwords** - Create dedicated app passwords instead of using main account passwords
2. **Limit Permissions** - Only grant necessary permissions to app passwords
3. **Regular Rotation** - Rotate credentials regularly
4. **Environment Variables** - Use environment variables in production, not .env files
5. **Monitor Logs** - Review logs regularly for suspicious activity

## Threat Model

### Potential Threats

-   **Credential Exposure**: Through logs, error messages, or console output
-   **API Abuse**: Unauthorized access to Bitbucket resources
-   **Data Leakage**: Sensitive repository or user data exposure
-   **Man-in-the-Middle**: Interception of API communications

### Mitigations

-   **HTTPS Only**: All API communications use HTTPS
-   **Credential Sanitization**: Automatic filtering of sensitive data
-   **Limited Scope**: Only necessary permissions are requested
-   **Error Handling**: Standardized error responses without sensitive details

## Security Configuration

### Environment Variables

```bash
# Required (choose one authentication method)
BITBUCKET_USERNAME=your-username    # With BITBUCKET_PASSWORD
BITBUCKET_PASSWORD=your-app-password # With BITBUCKET_USERNAME
BITBUCKET_TOKEN=your-access-token   # Alternative to username/password

# Required
BITBUCKET_WORKSPACE=your-workspace

# Optional
BITBUCKET_URL=https://api.bitbucket.org/2.0  # Default for Bitbucket Cloud
NODE_ENV=production  # Reduces log verbosity in production
```

### Logging Configuration

-   **Development**: Info level logging to file
-   **Production**: Error level logging only
-   **Log Files**: Automatically rotated, size-limited
-   **Sensitive Data**: Automatically filtered

## Incident Response

### If Credentials Are Compromised

1. **Immediately revoke** the compromised credentials in Bitbucket
2. **Generate new** app password or access token
3. **Update** environment variables with new credentials
4. **Review logs** for any suspicious activity
5. **Rotate** any other related credentials

### If Data Leakage Is Suspected

1. **Stop the server** immediately
2. **Review logs** for sensitive data exposure
3. **Notify** relevant stakeholders
4. **Implement** additional security measures
5. **Resume** operations after verification

## Compliance

### Standards Followed

-   **OWASP** security guidelines
-   **NIST** cybersecurity framework
-   **Industry best practices** for API security

### Regular Security Actions

-   **Dependency Updates**: Automated dependency scanning and updates
-   **Code Scanning**: Automated security scanning with CodeQL
-   **Vulnerability Assessment**: Regular security reviews

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do not** create a public issue
2. **Email** security concerns to the maintainers
3. **Provide** detailed information about the vulnerability
4. **Allow** reasonable time for response and fix

## Security Checklist

-   [ ] Environment variables are properly configured
-   [ ] App passwords have minimal required permissions
-   [ ] Logs are regularly reviewed and rotated
-   [ ] Dependencies are kept up to date
-   [ ] Network communications use HTTPS
-   [ ] Error handling doesn't expose sensitive information
-   [ ] Regular security reviews are conducted
