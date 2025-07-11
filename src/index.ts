#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    CallToolResult,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { isAxiosError } from "axios";

// Import modular components
import { createBitbucketConfig, validateConfig } from "./config/bitbucket.js";
import { logger, sanitizeError } from "./utils/logger.js";
import { RepositoryService } from "./services/repository.js";
import { PullRequestService } from "./services/pullrequest.js";
import { BranchingModelService } from "./services/branchingmodel.js";
import { TOOL_DEFINITIONS } from "./schemas/tools.js";
import {
    ToolHandlerMap,
    BitbucketConfig,
    RepositoryArgs,
    PullRequestArgs,
    BranchingModelArgs,
} from "./types/index.js";

/**
 * Modular Bitbucket MCP Server
 *
 * This server has been refactored from a monolithic structure to improve
 * maintainability, readability, and testability. Key improvements:
 *
 * - Separated concerns into dedicated service classes
 * - Extracted configuration and logging utilities
 * - Centralized tool definitions and schemas
 * - Improved error handling and security
 */
class BitbucketServer {
    private readonly server: Server;
    private readonly config: BitbucketConfig;
    private readonly toolHandlers: ToolHandlerMap;

    // Service instances
    private readonly repositoryService: RepositoryService;
    private readonly pullRequestService: PullRequestService;
    private readonly branchingModelService: BranchingModelService;

    constructor() {
        // Initialize MCP server
        this.server = new Server(
            {
                name: "bitbucket-mcp-server",
                version: "1.0.0",
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        // Load and validate configuration
        this.config = createBitbucketConfig();
        validateConfig(this.config);

        // Log configuration (sanitized - no sensitive data)
        logger.info("Bitbucket MCP Configuration", {
            baseUrl: this.config.baseUrl,
            hasToken: !!this.config.token,
            hasUsername: !!this.config.username,
            hasPassword: !!this.config.password,
            defaultWorkspace: this.config.defaultWorkspace,
        });

        // Initialize services
        this.repositoryService = new RepositoryService(this.config);
        this.pullRequestService = new PullRequestService(this.config);
        this.branchingModelService = new BranchingModelService(this.config);

        // Initialize tool handlers
        this.toolHandlers = this.initializeToolHandlers();

        // Setup MCP handlers
        this.setupToolHandlers();
    }

    /**
     * Initialize tool handlers map to reduce switch statement complexity
     */
    private initializeToolHandlers(): ToolHandlerMap {
        return {
            // Repository operations
            listRepositories: async (args: unknown) => {
                const repoArgs = args as RepositoryArgs;
                return this.repositoryService.listRepositories(
                    repoArgs.workspace,
                    repoArgs.limit
                );
            },

            getRepository: async (args: unknown) => {
                const repoArgs = args as RepositoryArgs;
                return this.repositoryService.getRepository(
                    repoArgs.workspace!,
                    repoArgs.repo_slug!
                );
            },

            // Pull request operations
            getPullRequests: async (args: unknown) => {
                const prArgs = args as PullRequestArgs;
                return this.pullRequestService.getPullRequests(
                    prArgs.workspace,
                    prArgs.repo_slug,
                    prArgs.state,
                    prArgs.limit
                );
            },

            createPullRequest: async (args: unknown) => {
                const prArgs = args as unknown as PullRequestArgs;
                return this.pullRequestService.createPullRequest(
                    prArgs.workspace,
                    prArgs.repo_slug,
                    prArgs.title!,
                    prArgs.description!,
                    prArgs.sourceBranch!,
                    prArgs.targetBranch!,
                    prArgs.reviewers
                );
            },

            getPullRequest: async (args: unknown) => {
                const prArgs = args as PullRequestArgs;
                return this.pullRequestService.getPullRequest(
                    prArgs.workspace,
                    prArgs.repo_slug,
                    prArgs.pull_request_id!
                );
            },

            updatePullRequest: async (args: unknown) => {
                const prArgs = args as PullRequestArgs;
                return this.pullRequestService.updatePullRequest(
                    prArgs.workspace,
                    prArgs.repo_slug,
                    prArgs.pull_request_id!,
                    prArgs.title,
                    prArgs.description
                );
            },

            getPullRequestActivity: async (args: unknown) => {
                const prArgs = args as PullRequestArgs;
                return this.pullRequestService.getPullRequestActivity(
                    prArgs.workspace,
                    prArgs.repo_slug,
                    prArgs.pull_request_id!
                );
            },

            approvePullRequest: async (args: unknown) => {
                const prArgs = args as PullRequestArgs;
                return this.pullRequestService.approvePullRequest(
                    prArgs.workspace,
                    prArgs.repo_slug,
                    prArgs.pull_request_id!
                );
            },

            unapprovePullRequest: async (args: unknown) => {
                const prArgs = args as PullRequestArgs;
                return this.pullRequestService.unapprovePullRequest(
                    prArgs.workspace,
                    prArgs.repo_slug,
                    prArgs.pull_request_id!
                );
            },

            declinePullRequest: async (args: unknown) => {
                const prArgs = args as PullRequestArgs;
                return this.pullRequestService.declinePullRequest(
                    prArgs.workspace,
                    prArgs.repo_slug,
                    prArgs.pull_request_id!,
                    prArgs.message
                );
            },

            mergePullRequest: async (args: unknown) => {
                const prArgs = args as PullRequestArgs;
                return this.pullRequestService.mergePullRequest(
                    prArgs.workspace,
                    prArgs.repo_slug,
                    prArgs.pull_request_id!,
                    prArgs.message,
                    prArgs.strategy
                );
            },

            getPullRequestComments: async (args: unknown) => {
                const prArgs = args as PullRequestArgs;
                return this.pullRequestService.getPullRequestComments(
                    prArgs.workspace,
                    prArgs.repo_slug,
                    prArgs.pull_request_id!
                );
            },

            getPullRequestDiff: async (args: unknown) => {
                const prArgs = args as PullRequestArgs;
                return this.pullRequestService.getPullRequestDiff(
                    prArgs.workspace,
                    prArgs.repo_slug,
                    prArgs.pull_request_id!
                );
            },

            getPullRequestCommits: async (args: unknown) => {
                const prArgs = args as PullRequestArgs;
                return this.pullRequestService.getPullRequestCommits(
                    prArgs.workspace,
                    prArgs.repo_slug,
                    prArgs.pull_request_id!
                );
            },

            // Branching model operations
            getRepositoryBranchingModel: async (args: unknown) => {
                const bmArgs = args as BranchingModelArgs;
                return this.branchingModelService.getRepositoryBranchingModel(
                    bmArgs.workspace,
                    bmArgs.repo_slug!
                );
            },

            getRepositoryBranchingModelSettings: async (args: unknown) => {
                const bmArgs = args as BranchingModelArgs;
                return this.branchingModelService.getRepositoryBranchingModelSettings(
                    bmArgs.workspace,
                    bmArgs.repo_slug!
                );
            },

            updateRepositoryBranchingModelSettings: async (args: unknown) => {
                const bmArgs = args as BranchingModelArgs;
                return this.branchingModelService.updateRepositoryBranchingModelSettings(
                    bmArgs.workspace,
                    bmArgs.repo_slug!,
                    bmArgs.development,
                    bmArgs.production,
                    bmArgs.branch_types
                );
            },

            getEffectiveRepositoryBranchingModel: async (args: unknown) => {
                const bmArgs = args as BranchingModelArgs;
                return this.branchingModelService.getEffectiveRepositoryBranchingModel(
                    bmArgs.workspace,
                    bmArgs.repo_slug!
                );
            },

            getProjectBranchingModel: async (args: unknown) => {
                const bmArgs = args as BranchingModelArgs;
                return this.branchingModelService.getProjectBranchingModel(
                    bmArgs.workspace,
                    bmArgs.project_key!
                );
            },

            getProjectBranchingModelSettings: async (args: unknown) => {
                const bmArgs = args as BranchingModelArgs;
                return this.branchingModelService.getProjectBranchingModelSettings(
                    bmArgs.workspace,
                    bmArgs.project_key!
                );
            },

            updateProjectBranchingModelSettings: async (args: unknown) => {
                const bmArgs = args as BranchingModelArgs;
                return this.branchingModelService.updateProjectBranchingModelSettings(
                    bmArgs.workspace,
                    bmArgs.project_key!,
                    bmArgs.development,
                    bmArgs.production,
                    bmArgs.branch_types
                );
            },
        };
    }

    private setupToolHandlers() {
        // Register the list tools handler
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: TOOL_DEFINITIONS,
        }));

        // Register the call tool handler
        this.server.setRequestHandler(
            CallToolRequestSchema,
            async (request) => {
                const { name, arguments: toolArgs } = request.params;

                try {
                    // Secure property access to prevent prototype pollution
                    const handler = Object.prototype.hasOwnProperty.call(
                        this.toolHandlers,
                        name
                    )
                        ? this.toolHandlers[name]
                        : undefined;
                    if (!handler) {
                        throw new McpError(
                            ErrorCode.MethodNotFound,
                            `Unknown tool: ${name}`
                        );
                    }

                    const result = await handler(toolArgs ?? {});
                    return result;
                } catch (error) {
                    logger.error("Tool execution error", sanitizeError(error));
                    if (isAxiosError(error)) {
                        // Never expose full error details that might contain sensitive data
                        const errorMessage =
                            error.response?.data?.error?.message ||
                            error.response?.data?.message ||
                            error.message ||
                            "Unknown API error";
                        throw new McpError(
                            ErrorCode.InternalError,
                            `Bitbucket API error: ${errorMessage}`
                        );
                    }
                    throw error;
                }
            }
        );
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        logger.info("Bitbucket MCP server running on stdio");
    }
}

// Create and start the server
const server = new BitbucketServer();
server.run().catch((error) => {
    logger.error("Server error", error);
    process.exit(1);
});

// Export for testing
export { BitbucketServer };
