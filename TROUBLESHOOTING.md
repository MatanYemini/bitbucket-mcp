# Troubleshooting Guide - Bitbucket MCP

## ✅ Solved Issues

### 1. **Build Script on Windows**

-   **Problem**: The `chmod` command doesn't exist on Windows
-   **Solution**: Created separate scripts for Windows and Unix
-   **Usage**: `npm run build` (for Windows) or `npm run build:unix` (for Unix/Linux)

### 2. **Test Client**

-   **Problem**: Attempted to connect via HTTP instead of STDIO
-   **Solution**: Reconfigured to use `StdioClientTransport`

### 3. **ES6 vs CommonJS Modules**

-   **Problem**: Conflict between `import` and `require`
-   **Solution**: Created `.cjs` files for test scripts

### 4. **Authentication**

-   **Problem**: Inadequate authentication error handling
-   **Solution**: Added detailed logs and axios interceptors

## 🔧 Available Scripts

### For Development:

```bash
# Compile the project
npm run build

# Test authentication
node test-simple.cjs

# Test MCP client
node test-mcp-client.js

# Start MCP server
node dist/index.js
```

### For Production:

```bash
# With environment variables configured:
node dist/index.js
```

## 🔐 Authentication Configuration

### Required Environment Variables:

```bash
BITBUCKET_URL=https://api.bitbucket.org/2.0
BITBUCKET_USERNAME=your-username
BITBUCKET_PASSWORD=your-app-password
BITBUCKET_WORKSPACE=your-workspace
```

### Create App Password in Bitbucket:

1. Go to https://bitbucket.org/account/settings/app-passwords/
2. Create a new App Password
3. Select permissions:
    - Repositories: Read
    - Pull requests: Read, Write
4. Copy the generated password

## 🧪 Verify Authentication

### Quick Test Script:

```bash
node test-simple.cjs
```

This script will verify:

-   ✓ Connectivity with Bitbucket API
-   ✓ Credential validity
-   ✓ Workspace access
-   ✓ Repository listing

## 📋 Troubleshooting

### Error 401 (Unauthorized):

-   Verify username and app password
-   Ensure correct permissions on app password
-   Check for extra spaces in credentials

### Error 403 (Forbidden):

-   Verify workspace access
-   Confirm app password permissions
-   Contact workspace admin if necessary

### Error 404 (Not Found):

-   Verify workspace name
-   Confirm workspace exists
-   Check API URL

### Module Errors:

-   Use `.cjs` files for CommonJS scripts
-   Verify `type: "module"` is in package.json
-   Use `import` instead of `require` in .js files

## 🎯 Current Status

### ✅ Working:

-   Authentication with Bitbucket Cloud ✓
-   Access to "Chat Center Network" workspace ✓
-   Error-free compilation ✓
-   Test scripts working ✓

### 🔄 Next Steps:

1. Integrate with Cursor or MCP client
2. Test all available tools
3. Configure as persistent service if needed

## 📞 Support

If you encounter additional problems:

1. Run `node test-simple.cjs` for diagnostics
2. Check logs in `bitbucket.log`
3. Verify environment variables
4. Consult Bitbucket API documentation
