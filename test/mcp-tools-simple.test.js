/**
 * Tests for modular Bitbucket MCP server
 * Verifies that the modular structure is working correctly
 */

import { describe, test, expect } from "@jest/globals";
import fs from "fs";
import path from "path";

describe("Modular Bitbucket MCP Server", () => {
    let indexFileContent;
    let serviceFiles;

    beforeEach(() => {
        // Read the main index.ts file
        const indexPath = path.resolve(__dirname, "..", "src", "index.ts");
        indexFileContent = fs.readFileSync(indexPath, "utf-8");

        // Read service files
        const servicesDir = path.resolve(__dirname, "..", "src", "services");
        serviceFiles = {
            repository: fs.readFileSync(
                path.join(servicesDir, "repository.ts"),
                "utf-8"
            ),
            pullrequest: fs.readFileSync(
                path.join(servicesDir, "pullrequest.ts"),
                "utf-8"
            ),
            branchingmodel: fs.readFileSync(
                path.join(servicesDir, "branchingmodel.ts"),
                "utf-8"
            ),
        };
    });

    describe("Modular Architecture", () => {
        test("should import modular components", () => {
            expect(indexFileContent).toContain("import { RepositoryService }");
            expect(indexFileContent).toContain("import { PullRequestService }");
            expect(indexFileContent).toContain(
                "import { BranchingModelService }"
            );
            expect(indexFileContent).toContain("import { TOOL_DEFINITIONS }");
        });

        test("should initialize service instances", () => {
            expect(indexFileContent).toContain(
                "repositoryService: RepositoryService"
            );
            expect(indexFileContent).toContain(
                "pullRequestService: PullRequestService"
            );
            expect(indexFileContent).toContain(
                "branchingModelService: BranchingModelService"
            );
        });

        test("should delegate to services in tool handlers", () => {
            expect(indexFileContent).toContain(
                "this.repositoryService.listRepositories"
            );
            expect(indexFileContent).toContain(
                "this.pullRequestService.getPullRequests"
            );
            expect(indexFileContent).toContain(
                "this.branchingModelService.getRepositoryBranchingModel"
            );
        });
    });

    describe("Service Implementation", () => {
        test("should implement repository methods in RepositoryService", () => {
            const repositoryMethods = [
                "async listRepositories(",
                "async getRepository(",
            ];

            repositoryMethods.forEach((method) => {
                expect(serviceFiles.repository).toContain(method);
            });
        });

        test("should implement pull request methods in PullRequestService", () => {
            const pullRequestMethods = [
                "async getPullRequests(",
                "async createPullRequest(",
                "async approvePullRequest(",
                "async mergePullRequest(",
            ];

            pullRequestMethods.forEach((method) => {
                expect(serviceFiles.pullrequest).toContain(method);
            });
        });

        test("should implement branching model methods in BranchingModelService", () => {
            const branchingMethods = [
                "async getRepositoryBranchingModel(",
                "async updateRepositoryBranchingModelSettings(",
            ];

            branchingMethods.forEach((method) => {
                expect(serviceFiles.branchingmodel).toContain(method);
            });
        });
    });

    describe("API Integration", () => {
        test("should use correct Bitbucket API endpoints in services", () => {
            const allServiceContent = Object.values(serviceFiles).join("\n");
            const apiEndpoints = [
                "/repositories/",
                "/pullrequests/",
                "/branching-model/",
            ];

            apiEndpoints.forEach((endpoint) => {
                expect(allServiceContent).toContain(endpoint);
            });
        });

        test("should handle HTTP methods correctly in services", () => {
            const allServiceContent = Object.values(serviceFiles).join("\n");
            const httpMethods = [
                "this.api.get(",
                "this.api.post(",
                "this.api.put(",
                "this.api.delete(",
            ];

            httpMethods.forEach((method) => {
                expect(allServiceContent).toContain(method);
            });
        });
    });

    describe("Tool Handler Map", () => {
        test("should define tool handlers for all tools", () => {
            const expectedHandlers = [
                "listRepositories:",
                "getRepository:",
                "getPullRequests:",
                "createPullRequest:",
                "approvePullRequest:",
                "mergePullRequest:",
            ];

            expectedHandlers.forEach((handler) => {
                expect(indexFileContent).toContain(handler);
            });
        });
    });

    describe("Configuration and Setup", () => {
        test("should use modular configuration", () => {
            expect(indexFileContent).toContain("createBitbucketConfig()");
            expect(indexFileContent).toContain("validateConfig(this.config)");
        });

        test("should use modular logger", () => {
            expect(indexFileContent).toContain("import { logger");
            expect(indexFileContent).toContain("logger.info");
        });

        test("should use centralized tool definitions", () => {
            expect(indexFileContent).toContain("tools: TOOL_DEFINITIONS");
        });
    });

    describe("Error Handling", () => {
        test("should have error handling in services", () => {
            const allServiceContent = Object.values(serviceFiles).join("\n");
            const errorHandlingPatterns = [
                "sanitizeError(error)",
                "McpError(",
                "ErrorCode.InternalError",
            ];

            errorHandlingPatterns.forEach((pattern) => {
                expect(allServiceContent).toContain(pattern);
            });
        });
    });
});
