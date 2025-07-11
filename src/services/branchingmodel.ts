import {
    ErrorCode,
    McpError,
    CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { BaseService } from "./base.js";
import { logger, sanitizeError } from "../utils/logger.js";

export class BranchingModelService extends BaseService {
    async getRepositoryBranchingModel(
        workspace: string,
        repo_slug: string
    ): Promise<CallToolResult> {
        try {
            logger.info("Getting repository branching model", {
                workspace,
                repo_slug,
            });

            const response = await this.api.get(
                `/repositories/${workspace}/${repo_slug}/branching-model`
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
            logger.error("Error getting repository branching model", {
                error: sanitizeError(error),
                workspace,
                repo_slug,
            });
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get repository branching model: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    async getRepositoryBranchingModelSettings(
        workspace: string,
        repo_slug: string
    ): Promise<CallToolResult> {
        try {
            logger.info("Getting repository branching model settings", {
                workspace,
                repo_slug,
            });

            const response = await this.api.get(
                `/repositories/${workspace}/${repo_slug}/branching-model/settings`
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
            logger.error("Error getting repository branching model settings", {
                error: sanitizeError(error),
                workspace,
                repo_slug,
            });
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get repository branching model settings: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    async updateRepositoryBranchingModelSettings(
        workspace: string,
        repo_slug: string,
        development?: Record<string, any>,
        production?: Record<string, any>,
        branch_types?: Array<Record<string, any>>
    ): Promise<CallToolResult> {
        try {
            logger.info("Updating repository branching model settings", {
                workspace,
                repo_slug,
                development,
                production,
                branch_types,
            });

            // Build request data with only the fields that are provided
            const updateData: Record<string, any> = {};
            if (development) updateData.development = development;
            if (production) updateData.production = production;
            if (branch_types) updateData.branch_types = branch_types;

            const response = await this.api.put(
                `/repositories/${workspace}/${repo_slug}/branching-model/settings`,
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
            logger.error("Error updating repository branching model settings", {
                error: sanitizeError(error),
                workspace,
                repo_slug,
            });
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to update repository branching model settings: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    async getEffectiveRepositoryBranchingModel(
        workspace: string,
        repo_slug: string
    ): Promise<CallToolResult> {
        try {
            logger.info("Getting effective repository branching model", {
                workspace,
                repo_slug,
            });

            const response = await this.api.get(
                `/repositories/${workspace}/${repo_slug}/effective-branching-model`
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
            logger.error("Error getting effective repository branching model", {
                error: sanitizeError(error),
                workspace,
                repo_slug,
            });
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get effective repository branching model: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    async getProjectBranchingModel(
        workspace: string,
        project_key: string
    ): Promise<CallToolResult> {
        try {
            logger.info("Getting project branching model", {
                workspace,
                project_key,
            });

            const response = await this.api.get(
                `/workspaces/${workspace}/projects/${project_key}/branching-model`
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
            logger.error("Error getting project branching model", {
                error: sanitizeError(error),
                workspace,
                project_key,
            });
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get project branching model: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    async getProjectBranchingModelSettings(
        workspace: string,
        project_key: string
    ): Promise<CallToolResult> {
        try {
            logger.info("Getting project branching model settings", {
                workspace,
                project_key,
            });

            const response = await this.api.get(
                `/workspaces/${workspace}/projects/${project_key}/branching-model/settings`
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
            logger.error("Error getting project branching model settings", {
                error: sanitizeError(error),
                workspace,
                project_key,
            });
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get project branching model settings: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    async updateProjectBranchingModelSettings(
        workspace: string,
        project_key: string,
        development?: Record<string, any>,
        production?: Record<string, any>,
        branch_types?: Array<Record<string, any>>
    ): Promise<CallToolResult> {
        try {
            logger.info("Updating project branching model settings", {
                workspace,
                project_key,
                development,
                production,
                branch_types,
            });

            // Build request data with only the fields that are provided
            const updateData: Record<string, any> = {};
            if (development) updateData.development = development;
            if (production) updateData.production = production;
            if (branch_types) updateData.branch_types = branch_types;

            const response = await this.api.put(
                `/workspaces/${workspace}/projects/${project_key}/branching-model/settings`,
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
            logger.error("Error updating project branching model settings", {
                error: sanitizeError(error),
                workspace,
                project_key,
            });
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to update project branching model settings: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }
}
