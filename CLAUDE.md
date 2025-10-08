# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server that provides AI assistants with programmatic access to Bitbucket Cloud and Server APIs. It's published as an npm package (`bitbucket-mcp`) and enables operations on repositories, pull requests, pipelines, and more through a standardized MCP interface.

**Safety First**: No DELETE operations are used to prevent accidental data loss. Every PR is analyzed with CodeQL for security.

## Development Commands

### Build and Run
```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/ (also sets executable permission)
npm start            # Run compiled server from dist/index.js
npm run dev          # Run in development mode with watch (uses tsx)
```

### Testing and Quality
```bash
npm test             # Run Jest tests
npm run lint         # Run ESLint on src/**/*.ts
```

### MCP Inspector
```bash
npm run inspector    # Launch MCP inspector for debugging tools
```

### Publishing
```bash
npm run publish:patch   # Bump patch version and publish
npm run publish:minor   # Bump minor version and publish
npm run publish:major   # Bump major version and publish
npm run release         # Alias for publish:patch
```

## Architecture

### Single-File Design
The entire server implementation lives in `src/index.ts` (~4,500 lines). This includes:
- Type definitions for Bitbucket API entities
- BitbucketClient class with all API methods
- MCP server setup and tool registration
- Logging configuration

### Core Components

**BitbucketClient Class**: Main API wrapper that handles:
- Axios-based HTTP client with authentication (token or username/password)
- URL normalization (converts web URLs like `bitbucket.org/workspace` to API URLs)
- All Bitbucket API operations grouped by category:
  - Repository operations (list, get details)
  - Pull request operations (CRUD, approve, merge, decline, etc.)
  - PR comments (general and inline)
  - PR tasks (TODO items)
  - PR diffs and patches
  - Pipeline operations (list, run, stop, get logs)

**Environment Configuration**:
- `BITBUCKET_URL`: API base URL (defaults to https://api.bitbucket.org/2.0)
- `BITBUCKET_TOKEN` OR `BITBUCKET_USERNAME` + `BITBUCKET_PASSWORD`: Authentication
- `BITBUCKET_WORKSPACE`: Default workspace (auto-extracted from URL if not provided)
- `BITBUCKET_ENABLE_DANGEROUS`: Enable destructive operations (disabled by default)
- `BITBUCKET_LOG_*`: Logging configuration (file, directory, disable, per-CWD)

**Logging**: Uses Winston with file-based logging to OS-specific directories:
- macOS: `~/Library/Logs/bitbucket-mcp/`
- Windows: `%LOCALAPPDATA%/bitbucket-mcp/`
- Linux: `~/.local/state/bitbucket-mcp/` or `$XDG_STATE_HOME/bitbucket-mcp/`

### MCP Tool Registration

All tools are registered in the `ListToolsRequestSchema` handler with JSON schemas for input validation. Tools are then routed to corresponding BitbucketClient methods in the `CallToolRequestSchema` handler.

### URL Normalization Logic

The `normalizeBitbucketConfig()` function handles backward compatibility:
- Converts `https://bitbucket.org/<workspace>` → `https://api.bitbucket.org/2.0` (auto-extracts workspace)
- Ensures `https://api.bitbucket.org` always has `/2.0` suffix
- Removes trailing slashes for consistent axios baseURL

## Key Implementation Details

### Authentication
Supports two methods (checked in order):
1. Token authentication via `BITBUCKET_TOKEN`
2. Basic auth via `BITBUCKET_USERNAME` + `BITBUCKET_PASSWORD`

Note: `BITBUCKET_USERNAME` is typically your email address for Bitbucket Cloud.

### Inline PR Comments
Uses special inline parameter format:
```typescript
{
  path: "src/file.ts",
  to: 15,    // Line in NEW version (for added/modified lines)
  from: 10   // Line in OLD version (for deleted/modified lines)
}
```

### Pipeline Operations
Requires "Pipelines: Read" permission in Bitbucket app password. Target configuration uses:
- `ref_type` + `ref_name` for branch/tag
- Optional `commit_hash` for specific commit
- Optional `selector_type` + `selector_pattern` for pipeline selection

### Dangerous Operations
When `BITBUCKET_ENABLE_DANGEROUS` is `true`, enables tools like:
- `deletePullRequestComment`
- `deletePullRequestTask`

## Build System

- **TypeScript**: Compiles ES2020 with strict mode to `dist/`
- **Module System**: ESM (type: "module" in package.json)
- **Entry Point**: `dist/index.js` (has shebang for CLI usage)
- **Bin**: Package exposes `bitbucket-mcp` command globally

## Integration

Designed to be used via:
1. **NPX**: `npx -y bitbucket-mcp@latest` (recommended)
2. **Global install**: `npm install -g bitbucket-mcp`
3. **Project install**: Add to MCP client config pointing to local or global install
4. **Docker**: Dockerfile provided for containerized deployment

MCP clients (like Cursor) communicate via stdio transport using the MCP protocol.

## Important Notes

- Single source file makes navigation straightforward but requires discipline with organization
- All API responses are returned as JSON-stringified text content in MCP format
- Error handling uses McpError with appropriate ErrorCodes
- Logger writes structured JSON logs (not console output, which would break stdio transport)
- No test files currently exist in the repository
