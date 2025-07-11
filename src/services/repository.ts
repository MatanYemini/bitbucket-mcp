import {
    ErrorCode,
    McpError,
    CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { BaseService } from "./base.js";
import { logger, sanitizeError } from "../utils/logger.js";

export class RepositoryService extends BaseService {
    async listRepositories(
        workspace?: string,
        limit: number = 10
    ): Promise<CallToolResult> {
        try {
            // Use default workspace if not provided
            const wsName = workspace || this.config.defaultWorkspace;

            if (!wsName) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "Workspace must be provided either as a parameter or through BITBUCKET_WORKSPACE environment variable"
                );
            }

            logger.info("Listing Bitbucket repositories", {
                workspace: wsName,
                limit,
            });

            const response = await this.api.get(`/repositories/${wsName}`, {
                params: { limit },
            });

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data.values, null, 2),
                    },
                ],
            };
        } catch (error) {
            logger.error("Error listing repositories", {
                error: sanitizeError(error),
                workspace: workspace,
            });
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to list repositories: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    async getRepository(
        workspace: string,
        repo_slug: string
    ): Promise<CallToolResult> {
        try {
            logger.info("Getting Bitbucket repository info", {
                workspace,
                repo_slug,
            });

            const response = await this.api.get(
                `/repositories/${workspace}/${repo_slug}`
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
            logger.error("Error getting repository", {
                error: sanitizeError(error),
                workspace,
                repo_slug,
            });
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get repository: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }
}
