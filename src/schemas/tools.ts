import {
    WORKSPACE_SCHEMA,
    REPO_SLUG_SCHEMA,
    PULL_REQUEST_ID_SCHEMA,
    PROJECT_KEY_SCHEMA,
} from "./common.js";

export const TOOL_DEFINITIONS = [
    {
        name: "listRepositories",
        description: "List Bitbucket repositories",
        inputSchema: {
            type: "object",
            properties: {
                workspace: WORKSPACE_SCHEMA,
                limit: {
                    type: "number",
                    description: "Maximum number of repositories to return",
                },
            },
        },
    },
    {
        name: "getRepository",
        description: "Get repository details",
        inputSchema: {
            type: "object",
            properties: {
                workspace: WORKSPACE_SCHEMA,
                repo_slug: REPO_SLUG_SCHEMA,
            },
            required: ["workspace", "repo_slug"],
        },
    },
    {
        name: "getPullRequests",
        description: "Get pull requests for a repository",
        inputSchema: {
            type: "object",
            properties: {
                workspace: WORKSPACE_SCHEMA,
                repo_slug: REPO_SLUG_SCHEMA,
                state: {
                    type: "string",
                    enum: ["OPEN", "MERGED", "DECLINED", "SUPERSEDED"],
                    description: "Pull request state",
                },
                limit: {
                    type: "number",
                    description: "Maximum number of pull requests to return",
                },
            },
            required: ["workspace", "repo_slug"],
        },
    },
    {
        name: "createPullRequest",
        description: "Create a new pull request",
        inputSchema: {
            type: "object",
            properties: {
                workspace: WORKSPACE_SCHEMA,
                repo_slug: REPO_SLUG_SCHEMA,
                title: {
                    type: "string",
                    description: "Pull request title",
                },
                description: {
                    type: "string",
                    description: "Pull request description",
                },
                sourceBranch: {
                    type: "string",
                    description: "Source branch name",
                },
                targetBranch: {
                    type: "string",
                    description: "Target branch name",
                },
                reviewers: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of reviewer usernames",
                },
            },
            required: [
                "workspace",
                "repo_slug",
                "title",
                "description",
                "sourceBranch",
                "targetBranch",
            ],
        },
    },
    {
        name: "getPullRequest",
        description: "Get details for a specific pull request",
        inputSchema: {
            type: "object",
            properties: {
                workspace: WORKSPACE_SCHEMA,
                repo_slug: REPO_SLUG_SCHEMA,
                pull_request_id: PULL_REQUEST_ID_SCHEMA,
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
        },
    },
    {
        name: "updatePullRequest",
        description: "Update a pull request",
        inputSchema: {
            type: "object",
            properties: {
                workspace: WORKSPACE_SCHEMA,
                repo_slug: REPO_SLUG_SCHEMA,
                pull_request_id: PULL_REQUEST_ID_SCHEMA,
                title: {
                    type: "string",
                    description: "New pull request title",
                },
                description: {
                    type: "string",
                    description: "New pull request description",
                },
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
        },
    },
    {
        name: "getPullRequestActivity",
        description: "Get activity log for a pull request",
        inputSchema: {
            type: "object",
            properties: {
                workspace: WORKSPACE_SCHEMA,
                repo_slug: REPO_SLUG_SCHEMA,
                pull_request_id: PULL_REQUEST_ID_SCHEMA,
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
        },
    },
    {
        name: "approvePullRequest",
        description: "Approve a pull request",
        inputSchema: {
            type: "object",
            properties: {
                workspace: WORKSPACE_SCHEMA,
                repo_slug: REPO_SLUG_SCHEMA,
                pull_request_id: PULL_REQUEST_ID_SCHEMA,
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
        },
    },
    {
        name: "unapprovePullRequest",
        description: "Remove approval from a pull request",
        inputSchema: {
            type: "object",
            properties: {
                workspace: WORKSPACE_SCHEMA,
                repo_slug: REPO_SLUG_SCHEMA,
                pull_request_id: PULL_REQUEST_ID_SCHEMA,
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
        },
    },
    {
        name: "declinePullRequest",
        description: "Decline a pull request",
        inputSchema: {
            type: "object",
            properties: {
                workspace: WORKSPACE_SCHEMA,
                repo_slug: REPO_SLUG_SCHEMA,
                pull_request_id: PULL_REQUEST_ID_SCHEMA,
                message: {
                    type: "string",
                    description: "Reason for declining",
                },
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
        },
    },
    {
        name: "mergePullRequest",
        description: "Merge a pull request",
        inputSchema: {
            type: "object",
            properties: {
                workspace: WORKSPACE_SCHEMA,
                repo_slug: REPO_SLUG_SCHEMA,
                pull_request_id: PULL_REQUEST_ID_SCHEMA,
                message: {
                    type: "string",
                    description: "Merge commit message",
                },
                strategy: {
                    type: "string",
                    enum: ["merge-commit", "squash", "fast-forward"],
                    description: "Merge strategy",
                },
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
        },
    },
    {
        name: "getPullRequestComments",
        description: "List comments on a pull request",
        inputSchema: {
            type: "object",
            properties: {
                workspace: WORKSPACE_SCHEMA,
                repo_slug: REPO_SLUG_SCHEMA,
                pull_request_id: PULL_REQUEST_ID_SCHEMA,
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
        },
    },
    {
        name: "getPullRequestDiff",
        description: "Get diff for a pull request",
        inputSchema: {
            type: "object",
            properties: {
                workspace: WORKSPACE_SCHEMA,
                repo_slug: REPO_SLUG_SCHEMA,
                pull_request_id: PULL_REQUEST_ID_SCHEMA,
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
        },
    },
    {
        name: "getPullRequestCommits",
        description: "Get commits on a pull request",
        inputSchema: {
            type: "object",
            properties: {
                workspace: WORKSPACE_SCHEMA,
                repo_slug: REPO_SLUG_SCHEMA,
                pull_request_id: PULL_REQUEST_ID_SCHEMA,
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
        },
    },
    {
        name: "getRepositoryBranchingModel",
        description: "Get the branching model for a repository",
        inputSchema: {
            type: "object",
            properties: {
                workspace: WORKSPACE_SCHEMA,
                repo_slug: REPO_SLUG_SCHEMA,
            },
            required: ["workspace", "repo_slug"],
        },
    },
    {
        name: "getRepositoryBranchingModelSettings",
        description: "Get the branching model config for a repository",
        inputSchema: {
            type: "object",
            properties: {
                workspace: WORKSPACE_SCHEMA,
                repo_slug: REPO_SLUG_SCHEMA,
            },
            required: ["workspace", "repo_slug"],
        },
    },
    {
        name: "updateRepositoryBranchingModelSettings",
        description: "Update the branching model config for a repository",
        inputSchema: {
            type: "object",
            properties: {
                workspace: WORKSPACE_SCHEMA,
                repo_slug: REPO_SLUG_SCHEMA,
                development: {
                    type: "object",
                    description: "Development branch settings",
                    properties: {
                        name: {
                            type: "string",
                            description: "Branch name",
                        },
                        use_mainbranch: {
                            type: "boolean",
                            description: "Use main branch",
                        },
                    },
                },
                production: {
                    type: "object",
                    description: "Production branch settings",
                    properties: {
                        name: {
                            type: "string",
                            description: "Branch name",
                        },
                        use_mainbranch: {
                            type: "boolean",
                            description: "Use main branch",
                        },
                        enabled: {
                            type: "boolean",
                            description: "Enable production branch",
                        },
                    },
                },
                branch_types: {
                    type: "array",
                    description: "Branch types configuration",
                    items: {
                        type: "object",
                        properties: {
                            kind: {
                                type: "string",
                                description:
                                    "Branch type kind (e.g., bugfix, feature)",
                            },
                            prefix: {
                                type: "string",
                                description: "Branch prefix",
                            },
                            enabled: {
                                type: "boolean",
                                description: "Enable this branch type",
                            },
                        },
                        required: ["kind"],
                    },
                },
            },
            required: ["workspace", "repo_slug"],
        },
    },
    {
        name: "getEffectiveRepositoryBranchingModel",
        description: "Get the effective branching model for a repository",
        inputSchema: {
            type: "object",
            properties: {
                workspace: WORKSPACE_SCHEMA,
                repo_slug: REPO_SLUG_SCHEMA,
            },
            required: ["workspace", "repo_slug"],
        },
    },
    {
        name: "getProjectBranchingModel",
        description: "Get the branching model for a project",
        inputSchema: {
            type: "object",
            properties: {
                workspace: WORKSPACE_SCHEMA,
                project_key: PROJECT_KEY_SCHEMA,
            },
            required: ["workspace", "project_key"],
        },
    },
    {
        name: "getProjectBranchingModelSettings",
        description: "Get the branching model config for a project",
        inputSchema: {
            type: "object",
            properties: {
                workspace: WORKSPACE_SCHEMA,
                project_key: PROJECT_KEY_SCHEMA,
            },
            required: ["workspace", "project_key"],
        },
    },
    {
        name: "updateProjectBranchingModelSettings",
        description: "Update the branching model config for a project",
        inputSchema: {
            type: "object",
            properties: {
                workspace: WORKSPACE_SCHEMA,
                project_key: PROJECT_KEY_SCHEMA,
                development: {
                    type: "object",
                    description: "Development branch settings",
                    properties: {
                        name: {
                            type: "string",
                            description: "Branch name",
                        },
                        use_mainbranch: {
                            type: "boolean",
                            description: "Use main branch",
                        },
                    },
                },
                production: {
                    type: "object",
                    description: "Production branch settings",
                    properties: {
                        name: {
                            type: "string",
                            description: "Branch name",
                        },
                        use_mainbranch: {
                            type: "boolean",
                            description: "Use main branch",
                        },
                        enabled: {
                            type: "boolean",
                            description: "Enable production branch",
                        },
                    },
                },
                branch_types: {
                    type: "array",
                    description: "Branch types configuration",
                    items: {
                        type: "object",
                        properties: {
                            kind: {
                                type: "string",
                                description:
                                    "Branch type kind (e.g., bugfix, feature)",
                            },
                            prefix: {
                                type: "string",
                                description: "Branch prefix",
                            },
                            enabled: {
                                type: "boolean",
                                description: "Enable this branch type",
                            },
                        },
                        required: ["kind"],
                    },
                },
            },
            required: ["workspace", "project_key"],
        },
    },
] as const;
