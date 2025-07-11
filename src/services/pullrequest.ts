import {
    ErrorCode,
    McpError,
    CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { BaseService } from "./base.js";
import { logger, sanitizeError } from "../utils/logger.js";

export class PullRequestService extends BaseService {
    async getPullRequests(
        workspace: string,
        repo_slug: string,
        state?: "OPEN" | "MERGED" | "DECLINED" | "SUPERSEDED",
        limit: number = 10
    ): Promise<CallToolResult> {
        try {
            logger.info("Getting Bitbucket pull requests", {
                workspace,
                repo_slug,
                state,
                limit,
            });

            const response = await this.api.get(
                `/repositories/${workspace}/${repo_slug}/pullrequests`,
                {
                    params: {
                        state: state,
                        limit,
                    },
                }
            );

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data.values, null, 2),
                    },
                ],
            };
        } catch (error) {
            logger.error("Error getting pull requests", {
                error: sanitizeError(error),
                workspace,
                repo_slug,
            });
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get pull requests: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    async createPullRequest(
        workspace: string,
        repo_slug: string,
        title: string,
        description: string,
        sourceBranch: string,
        targetBranch: string,
        reviewers?: string[]
    ): Promise<CallToolResult> {
        try {
            logger.info("Creating Bitbucket pull request", {
                workspace,
                repo_slug,
                title,
                sourceBranch,
                targetBranch,
            });

            // Prepare reviewers format if provided
            const reviewersArray =
                reviewers?.map((username) => ({
                    username,
                })) || [];

            // Create the pull request
            const response = await this.api.post(
                `/repositories/${workspace}/${repo_slug}/pullrequests`,
                {
                    title,
                    description,
                    source: {
                        branch: {
                            name: sourceBranch,
                        },
                    },
                    destination: {
                        branch: {
                            name: targetBranch,
                        },
                    },
                    reviewers: reviewersArray,
                    close_source_branch: true,
                }
            );

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data, null, 2),
                    },
                ],
            };
        } catch (error) {
            logger.error("Error creating pull request", {
                error: sanitizeError(error),
                workspace,
                repo_slug,
            });
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to create pull request: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    async getPullRequest(
        workspace: string,
        repo_slug: string,
        pull_request_id: string
    ): Promise<CallToolResult> {
        try {
            logger.info("Getting Bitbucket pull request details", {
                workspace,
                repo_slug,
                pull_request_id,
            });

            const response = await this.api.get(
                `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}`
            );

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data, null, 2),
                    },
                ],
            };
        } catch (error) {
            logger.error("Error getting pull request details", {
                error: sanitizeError(error),
                workspace,
                repo_slug,
                pull_request_id,
            });
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get pull request details: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    async updatePullRequest(
        workspace: string,
        repo_slug: string,
        pull_request_id: string,
        title?: string,
        description?: string
    ): Promise<CallToolResult> {
        try {
            logger.info("Updating Bitbucket pull request", {
                workspace,
                repo_slug,
                pull_request_id,
            });

            // Only include fields that are provided
            const updateData: Record<string, any> = {};
            if (title !== undefined) updateData.title = title;
            if (description !== undefined) updateData.description = description;

            const response = await this.api.put(
                `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}`,
                updateData
            );

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data, null, 2),
                    },
                ],
            };
        } catch (error) {
            logger.error("Error updating pull request", {
                error: sanitizeError(error),
                workspace,
                repo_slug,
                pull_request_id,
            });
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to update pull request: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    async getPullRequestActivity(
        workspace: string,
        repo_slug: string,
        pull_request_id: string
    ): Promise<CallToolResult> {
        try {
            logger.info("Getting Bitbucket pull request activity", {
                workspace,
                repo_slug,
                pull_request_id,
            });

            const response = await this.api.get(
                `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}/activity`
            );

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data.values, null, 2),
                    },
                ],
            };
        } catch (error) {
            logger.error("Error getting pull request activity", {
                error: sanitizeError(error),
                workspace,
                repo_slug,
                pull_request_id,
            });
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get pull request activity: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    async approvePullRequest(
        workspace: string,
        repo_slug: string,
        pull_request_id: string
    ): Promise<CallToolResult> {
        try {
            logger.info("Approving Bitbucket pull request", {
                workspace,
                repo_slug,
                pull_request_id,
            });

            const response = await this.api.post(
                `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}/approve`
            );

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data, null, 2),
                    },
                ],
            };
        } catch (error) {
            logger.error("Error approving pull request", {
                error: sanitizeError(error),
                workspace,
                repo_slug,
                pull_request_id,
            });
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to approve pull request: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    async unapprovePullRequest(
        workspace: string,
        repo_slug: string,
        pull_request_id: string
    ): Promise<CallToolResult> {
        try {
            logger.info("Unapproving Bitbucket pull request", {
                workspace,
                repo_slug,
                pull_request_id,
            });

            await this.api.delete(
                `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}/approve`
            );

            return {
                content: [
                    {
                        type: "text",
                        text: "Pull request approval removed successfully.",
                    },
                ],
            };
        } catch (error) {
            logger.error("Error unapproving pull request", {
                error: sanitizeError(error),
                workspace,
                repo_slug,
                pull_request_id,
            });
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to unapprove pull request: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    async declinePullRequest(
        workspace: string,
        repo_slug: string,
        pull_request_id: string,
        message?: string
    ): Promise<CallToolResult> {
        try {
            logger.info("Declining Bitbucket pull request", {
                workspace,
                repo_slug,
                pull_request_id,
            });

            // Include message if provided
            const data = message ? { message } : {};

            const response = await this.api.post(
                `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}/decline`,
                data
            );

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data, null, 2),
                    },
                ],
            };
        } catch (error) {
            logger.error("Error declining pull request", {
                error: sanitizeError(error),
                workspace,
                repo_slug,
                pull_request_id,
            });
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to decline pull request: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    async mergePullRequest(
        workspace: string,
        repo_slug: string,
        pull_request_id: string,
        message?: string,
        strategy?: "merge-commit" | "squash" | "fast-forward"
    ): Promise<CallToolResult> {
        try {
            logger.info("Merging Bitbucket pull request", {
                workspace,
                repo_slug,
                pull_request_id,
                strategy,
            });

            // Build request data
            const data: Record<string, any> = {};
            if (message) data.message = message;
            if (strategy) data.merge_strategy = strategy;

            const response = await this.api.post(
                `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}/merge`,
                data
            );

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data, null, 2),
                    },
                ],
            };
        } catch (error) {
            logger.error("Error merging pull request", {
                error: sanitizeError(error),
                workspace,
                repo_slug,
                pull_request_id,
            });
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to merge pull request: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    async getPullRequestComments(
        workspace: string,
        repo_slug: string,
        pull_request_id: string
    ): Promise<CallToolResult> {
        try {
            logger.info("Getting Bitbucket pull request comments", {
                workspace,
                repo_slug,
                pull_request_id,
            });

            const response = await this.api.get(
                `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}/comments`
            );

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data.values, null, 2),
                    },
                ],
            };
        } catch (error) {
            logger.error("Error getting pull request comments", {
                error: sanitizeError(error),
                workspace,
                repo_slug,
                pull_request_id,
            });
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get pull request comments: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    async getPullRequestDiff(
        workspace: string,
        repo_slug: string,
        pull_request_id: string
    ): Promise<CallToolResult> {
        try {
            logger.info("Getting Bitbucket pull request diff", {
                workspace,
                repo_slug,
                pull_request_id,
            });

            const response = await this.api.get(
                `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}/diff`,
                {
                    headers: {
                        Accept: "text/plain",
                    },
                    responseType: "text",
                }
            );

            return {
                content: [
                    {
                        type: "text",
                        text: response.data,
                    },
                ],
            };
        } catch (error) {
            logger.error("Error getting pull request diff", {
                error: sanitizeError(error),
                workspace,
                repo_slug,
                pull_request_id,
            });
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get pull request diff: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    async getPullRequestCommits(
        workspace: string,
        repo_slug: string,
        pull_request_id: string
    ): Promise<CallToolResult> {
        try {
            logger.info("Getting Bitbucket pull request commits", {
                workspace,
                repo_slug,
                pull_request_id,
            });

            const response = await this.api.get(
                `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}/commits`
            );

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data.values, null, 2),
                    },
                ],
            };
        } catch (error) {
            logger.error("Error getting pull request commits", {
                error: sanitizeError(error),
                workspace,
                repo_slug,
                pull_request_id,
            });
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get pull request commits: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }
}
