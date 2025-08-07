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
Checkout out the [official npm package](https://www.npmjs.com/package/bitbucket-mcp)
This server implements the Model Context Protocol standard to provide AI assistants with access to Bitbucket data and operations. It includes tools for:

- Listing and retrieving repositories
- Getting repository details
- Fetching pull requests
- And more...

## Installation

### Using NPX (Recommended)

The easiest way to use this MCP server is via NPX, which allows you to run it without installing it globally:

```bash
# Run with environment variables
BITBUCKET_URL="https://bitbucket.org/your-workspace" \
BITBUCKET_USERNAME="your-username" \
BITBUCKET_PASSWORD="your-app-password" \
npx -y bitbucket-mcp@latest
```

### Manual Installation

Alternatively, you can install it globally or as part of your project:

```bash
# Install globally
npm install -g bitbucket-mcp

# Or install in your project
npm install bitbucket-mcp
```

Then run it with:

```bash
# If installed globally
BITBUCKET_URL="https://bitbucket.org/your-workspace" \
BITBUCKET_USERNAME="your-username" \
BITBUCKET_PASSWORD="your-app-password" \
bitbucket-mcp

# If installed in your project
BITBUCKET_URL="https://bitbucket.org/your-workspace" \
BITBUCKET_USERNAME="your-username" \
BITBUCKET_PASSWORD="your-app-password" \
npx bitbucket-mcp
```

## Configuration

### Environment Variables

Configure the server using the following environment variables:

| Variable              | Description                                                       | Required |
| --------------------- | ----------------------------------------------------------------- | -------- |
| `BITBUCKET_URL`       | Bitbucket base URL (e.g., "https://bitbucket.org/your-workspace") | Yes      |
| `BITBUCKET_USERNAME`  | Your Bitbucket username                                           | Yes\*    |
| `BITBUCKET_PASSWORD`  | Your Bitbucket app password                                       | Yes\*    |
| `BITBUCKET_TOKEN`     | Your Bitbucket access token (alternative to username/password)    | No       |
| `BITBUCKET_WORKSPACE` | Default workspace to use when not specified                       | No       |

\* Either `BITBUCKET_TOKEN` or both `BITBUCKET_USERNAME` and `BITBUCKET_PASSWORD` must be provided.

### Creating a Bitbucket App Password

1. Log in to your Bitbucket account
2. Go to Personal Settings > App Passwords
3. Create a new app password with the following permissions:
   - Repositories: Read
   - Pull requests: Read, Write
   - Pipelines: Read (required for pipeline operations)
4. Copy the generated password and use it as the `BITBUCKET_PASSWORD` environment variable

## Troubleshooting

### 401 Authentication Errors

If you're getting 401 authentication errors, check the following:

1. **Verify your app password**: Make sure you're using an App Password, not your regular Bitbucket password
2. **Verify app password permissions**: Your app password needs at least "Repositories: Read" permission
3. **Try the API URL format**: If you're still getting 401 errors, try using the direct API URL format:
   ```bash
   BITBUCKET_URL="https://api.bitbucket.org/2.0"
   ```
4. **Test API access**: Verify your credentials work by testing the Bitbucket API directly:
   ```bash
   # Test with curl (replace with your actual values)
   curl -u "your-username:your-app-password" \
     "https://api.bitbucket.org/2.0/repositories/your-workspace"
   ```

### Getting Help

If you encounter issues:

1. Check the [Bitbucket REST API documentation](https://developer.atlassian.com/cloud/bitbucket/rest/intro/) for API details
2. Review the [Bitbucket Cloud documentation](https://support.atlassian.com/bitbucket-cloud/) for general help

## Integration with Cursor

To integrate this MCP server with Cursor:

1. Open Cursor
2. Go to Settings > Extensions
3. Click on "Model Context Protocol"
4. Add a new MCP configuration:

```json
"bitbucket": {
  "command": "npx",
  "env": {
    "BITBUCKET_URL": "https://bitbucket.org/your-workspace",
    "BITBUCKET_USERNAME": "your-username",
    "BITBUCKET_PASSWORD": "your-app-password"
  },
  "args": ["-y", "bitbucket-mcp@latest"]
}
```

5. Save the configuration
6. Use the "/bitbucket" command in Cursor to access Bitbucket repositories and pull requests

### Using a Local Build with Cursor

If you're developing locally and want to test your changes:

```json
"bitbucket-local": {
  "command": "node",
  "env": {
    "BITBUCKET_URL": "https://bitbucket.org/your-workspace",
    "BITBUCKET_USERNAME": "your-username",
    "BITBUCKET_PASSWORD": "your-app-password"
  },
  "args": ["/path/to/your/local/bitbucket-mcp/dist/index.js"]
}
```

## Available Tools

This MCP server provides tools for interacting with Bitbucket repositories and pull requests. Below is a comprehensive list of the available operations:

### Repository Operations

#### `listRepositories`

Lists repositories in a workspace.

**Parameters:**

- `workspace` (optional): Bitbucket workspace name
- `limit` (optional): Maximum number of repositories to return

#### `getRepository`

Gets details for a specific repository.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug

### Pull Request Operations

#### `getPullRequests`

Gets pull requests for a repository.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `state` (optional): Pull request state (`OPEN`, `MERGED`, `DECLINED`, `SUPERSEDED`)
- `limit` (optional): Maximum number of pull requests to return

#### `createPullRequest`

Creates a new pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `title`: Pull request title
- `description`: Pull request description
- `sourceBranch`: Source branch name
- `targetBranch`: Target branch name
- `reviewers` (optional): List of reviewer usernames
- `draft` (optional): Whether to create the pull request as a draft

#### `getPullRequest`

Gets details for a specific pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID

#### `updatePullRequest`

Updates a pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID
- Various optional update parameters (title, description, etc.)

#### `getPullRequestActivity`

Gets the activity log for a pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID

#### `approvePullRequest`

Approves a pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID

#### `unapprovePullRequest`

Removes an approval from a pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID

#### `declinePullRequest`

Declines a pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID
- `message` (optional): Reason for declining

#### `mergePullRequest`

Merges a pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID
- `message` (optional): Merge commit message
- `strategy` (optional): Merge strategy (`merge-commit`, `squash`, `fast-forward`)

#### `requestChanges`

Requests changes on a pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID

#### `removeChangeRequest`

Removes a change request from a pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID

#### `createDraftPullRequest`

Creates a new draft pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `title`: Pull request title
- `description`: Pull request description
- `sourceBranch`: Source branch name
- `targetBranch`: Target branch name
- `reviewers` (optional): List of reviewer usernames

**Note:** This is equivalent to calling `createPullRequest` with `draft: true`.

#### `publishDraftPullRequest`

Publishes a draft pull request to make it ready for review.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID

#### `convertTodraft`

Converts a regular pull request to draft status.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID

### Pull Request Comment Operations

#### `getPullRequestComments`

Lists comments on a pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID

#### `addPullRequestComment`

Creates a comment on a pull request (general or inline).

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID
- `content`: Comment content in markdown format
- `inline` (optional): Inline comment information for commenting on specific lines

**Inline Comment Format:**

The `inline` parameter allows you to create comments on specific lines of code in the pull request diff:

```json
{
  "path": "src/file.ts",
  "to": 15,     // Line number in NEW version (for added/modified lines)
  "from": 10    // Line number in OLD version (for deleted/modified lines) 
}
```

**Examples:**

- **General comment**: Omit the `inline` parameter for a general pull request comment
- **Comment on new line**: Use only `to` parameter
- **Comment on deleted line**: Use only `from` parameter  
- **Comment on modified line**: Use both `from` and `to` parameters

**Usage:**
```javascript
// General comment
addPullRequestComment(workspace, repo, pr_id, "Great work!")

// Inline comment on new line 25
addPullRequestComment(workspace, repo, pr_id, "Consider error handling here", {
  path: "src/service.ts",
  to: 25
})
```

#### `getPullRequestComment`

Gets a specific comment on a pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID
- `comment_id`: Comment ID

#### `updatePullRequestComment`

Updates a comment on a pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID
- `comment_id`: Comment ID
- `content`: Updated comment content

#### `deletePullRequestComment`

Deletes a comment on a pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID
- `comment_id`: Comment ID

#### `resolveComment`

Resolves a comment thread on a pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID
- `comment_id`: Comment ID

#### `reopenComment`

Reopens a resolved comment thread on a pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID
- `comment_id`: Comment ID

### Pull Request Diff Operations

#### `getPullRequestDiff`

Gets the diff for a pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID

#### `getPullRequestDiffStat`

Gets the diff statistics for a pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID

#### `getPullRequestPatch`

Gets the patch for a pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID

### Pull Request Task Operations

#### `getPullRequestTasks`

Lists tasks on a pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID

#### `createPullRequestTask`

Creates a task on a pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID
- `content`: Task content
- `comment` (optional): Comment ID to associate with the task
- `pending` (optional): Whether the task is pending

#### `getPullRequestTask`

Gets a specific task on a pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID
- `task_id`: Task ID

#### `updatePullRequestTask`

Updates a task on a pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID
- `task_id`: Task ID
- `content` (optional): Updated task content
- `state` (optional): Updated task state

#### `deletePullRequestTask`

Deletes a task on a pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID
- `task_id`: Task ID

### Other Pull Request Operations

#### `getPullRequestCommits`

Lists commits on a pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID

#### `getPullRequestStatuses`

Lists commit statuses for a pull request.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pull_request_id`: Pull request ID

### Pipeline Operations

#### `listPipelineRuns`

Lists pipeline runs for a repository.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `limit` (optional): Maximum number of pipelines to return
- `status` (optional): Filter pipelines by status (`PENDING`, `IN_PROGRESS`, `SUCCESSFUL`, `FAILED`, `ERROR`, `STOPPED`)
- `target_branch` (optional): Filter pipelines by target branch
- `trigger_type` (optional): Filter pipelines by trigger type (`manual`, `push`, `pullrequest`, `schedule`)

#### `getPipelineRun`

Gets details for a specific pipeline run.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pipeline_uuid`: Pipeline UUID

#### `runPipeline`

Triggers a new pipeline run.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `target`: Pipeline target configuration (object with `ref_type`, `ref_name`, and optional `commit_hash`, `selector_type`, `selector_pattern`)
- `variables` (optional): Array of pipeline variables (objects with `key`, `value`, and optional `secured` fields)

#### `stopPipeline`

Stops a running pipeline.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pipeline_uuid`: Pipeline UUID

#### `getPipelineSteps`

Lists steps for a pipeline run.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pipeline_uuid`: Pipeline UUID

#### `getPipelineStep`

Gets details for a specific pipeline step.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pipeline_uuid`: Pipeline UUID
- `step_uuid`: Step UUID

#### `getPipelineStepLogs`

Gets logs for a specific pipeline step.

**Parameters:**

- `workspace`: Bitbucket workspace name
- `repo_slug`: Repository slug
- `pipeline_uuid`: Pipeline UUID
- `step_uuid`: Step UUID

## Development

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/MatanYemini/bitbucket-mcp.git
cd bitbucket-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Links

- [GitHub Repository](https://github.com/MatanYemini/bitbucket-mcp)
- [npm Package](https://www.npmjs.com/package/bitbucket-mcp)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Bitbucket REST API Documentation](https://developer.atlassian.com/cloud/bitbucket/rest/intro/)
- [Bitbucket Cloud Documentation](https://support.atlassian.com/bitbucket-cloud/)