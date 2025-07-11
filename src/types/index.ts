import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export interface BitbucketConfig {
    baseUrl: string;
    token?: string;
    username?: string;
    password?: string;
    defaultWorkspace?: string;
}

// Specific argument types for different tool categories
export interface RepositoryArgs {
    workspace?: string;
    repo_slug?: string;
    limit?: number;
}

export interface PullRequestArgs {
    workspace: string;
    repo_slug: string;
    pull_request_id?: string;
    title?: string;
    description?: string;
    sourceBranch?: string;
    targetBranch?: string;
    reviewers?: string[];
    state?: "OPEN" | "MERGED" | "DECLINED" | "SUPERSEDED";
    limit?: number;
    message?: string;
    strategy?: "merge-commit" | "squash" | "fast-forward";
}

export interface BranchingModelArgs {
    workspace: string;
    repo_slug?: string;
    project_key?: string;
    development?: Record<string, unknown>;
    production?: Record<string, unknown>;
    branch_types?: Array<Record<string, unknown>>;
}

// Union type for all possible tool arguments
export type ToolArgs = RepositoryArgs | PullRequestArgs | BranchingModelArgs;

export type ToolHandler = (
    args: Record<string, unknown>
) => Promise<CallToolResult>;

export type ToolHandlerMap = {
    [key: string]: ToolHandler;
};

export interface McpResponse {
    content: Array<{
        type: "text";
        text: string;
    }>;
}
