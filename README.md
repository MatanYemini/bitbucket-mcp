# Bitbucket MCP

A Model Context Protocol (MCP) server for integrating with Bitbucket Cloud and Server APIs. This MCP server enables AI assistants like Cursor to interact with your Bitbucket repositories, pull requests, and other resources.

## Safety First

This is a safe and responsible package — no DELETE operations are used, so there's no risk of data loss.
Every pull request is analyzed with CodeQL to ensure the code remains secure.

[![CodeQL](https://github.com/MatanYemini/bitbucket-mcp/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/MatanYemini/bitbucket-mcp/actions/workflows/github-code-scanning/codeql)
[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-blue.svg)](https://github.com/MatanYemini/bitbucket-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/bitbucket-mcp.svg)](https://www.npmjs.com/package/bitbucket-mcp)

## Overview

This server implements the Model Context Protocol standard to provide AI assistants with access to Bitbucket data and operations. It includes tools for:

- **Repository Management**: List and retrieve repository details
- **Pull Request Operations**: Create, update, approve, merge, and decline pull requests
- **Collaboration**: Manage comments, reviewers, and activity logs
- **Branching Models**: Configure and manage repository branching strategies
- **Safe Operations**: No destructive DELETE operations

## Quick Start

### 1. Environment Setup

Create a `.env` file in your project root:

```bash
# Copy .env.example to .env and configure your values
BITBUCKET_URL=https://api.bitbucket.org/2.0
BITBUCKET_USERNAME=your-username
BITBUCKET_PASSWORD=your-app-password
BITBUCKET_WORKSPACE=your-workspace
```

### 2. Installation & Build

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

### 3. Test Authentication

```bash
# Test your Bitbucket credentials
node test-simple.cjs
```

### 4. Run MCP Server

```bash
# Start the MCP server
node dist/index.js
```

### 5. Test Complete MCP Client

```bash
# Test the complete MCP functionality
node test-mcp-client.js
```

## Configuration

### Environment Variables

Configure the server using environment variables in your `.env` file:

| Variable              | Description                                   | Required |
| --------------------- | --------------------------------------------- | -------- |
| `BITBUCKET_URL`       | Bitbucket API URL                            | Yes      |
| `BITBUCKET_USERNAME`  | Your Bitbucket username                       | Yes*     |
| `BITBUCKET_PASSWORD`  | Your Bitbucket app password                   | Yes*     |
| `BITBUCKET_TOKEN`     | Alternative: Personal Access Token            | No       |
| `BITBUCKET_WORKSPACE` | Default workspace to use                      | Yes      |

*Either `BITBUCKET_TOKEN` or both `BITBUCKET_USERNAME` and `BITBUCKET_PASSWORD` must be provided.

### Creating a Bitbucket App Password

**For Bitbucket Cloud (recommended):**

1. Log in to your Bitbucket account
2. Go to **Personal Settings > App Passwords**
3. Create a new app password with permissions:
   - **Repositories**: Read
   - **Pull requests**: Read, Write
4. Copy the generated password to use as `BITBUCKET_PASSWORD`

**For Bitbucket Server:**

Check with your administrator for Personal Access Token setup and API URL.

## Integration with Cursor

Configure Cursor to use this MCP server:

```json
{
  "bitbucket": {
    "command": "node",
    "args": ["/absolute/path/to/your/bitbucket-mcp/dist/index.js"],
    "env": {
      "BITBUCKET_URL": "https://api.bitbucket.org/2.0",
      "BITBUCKET_USERNAME": "your-username",
      "BITBUCKET_PASSWORD": "your-app-password",
      "BITBUCKET_WORKSPACE": "your-workspace"
    }
  }
}
```

## Available Tools (21 Total)

### Repository Operations
- `listRepositories` - List repositories in a workspace
- `getRepository` - Get repository details

### Pull Request Management
- `getPullRequests` - List pull requests
- `createPullRequest` - Create new pull request
- `getPullRequest` - Get pull request details
- `updatePullRequest` - Update pull request
- `getPullRequestActivity` - Get activity log
- `getPullRequestCommits` - Get commits
- `getPullRequestComments` - Get comments
- `getPullRequestDiff` - Get diff

### Pull Request Actions
- `approvePullRequest` - Approve pull request
- `unapprovePullRequest` - Remove approval
- `declinePullRequest` - Decline pull request
- `mergePullRequest` - Merge pull request

### Branching Model Management
- `getRepositoryBranchingModel` - Get branching model
- `getRepositoryBranchingModelSettings` - Get branching config
- `updateRepositoryBranchingModelSettings` - Update branching config
- `getEffectiveRepositoryBranchingModel` - Get effective model
- `getProjectBranchingModel` - Get project model
- `getProjectBranchingModelSettings` - Get project settings
- `updateProjectBranchingModelSettings` - Update project settings

## Development

### Prerequisites
- Node.js 18 or higher
- npm

### Setup

```bash
# Clone and setup
git clone <repository-url>
cd bitbucket-mcp
npm install

# Build
npm run build

# Development mode
npm run dev
```

### Testing

```bash
# Test authentication only
node test-simple.cjs

# Test full MCP client
node test-mcp-client.js
```

## Project Structure

```
bitbucket-mcp/
├── src/
│   └── index.ts          # Main MCP server
├── dist/                 # Compiled output
├── test-simple.cjs       # Authentication test
├── test-mcp-client.js    # Full MCP client test
├── .env.example          # Environment template
├── .env                  # Your credentials (git-ignored)
└── TROUBLESHOOTING.md    # Common issues & solutions
```

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Links

- Original Repository: [GitHub Repository](https://github.com/MatanYemini/bitbucket-mcp)
- [npm Package](https://www.npmjs.com/package/bitbucket-mcp)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Bitbucket REST API](https://developer.atlassian.com/cloud/bitbucket/rest/)
