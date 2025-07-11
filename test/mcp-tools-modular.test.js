/**
 * Updated tests for modular Bitbucket MCP server
 */

import { describe, test, expect } from "@jest/globals";
import fs from "fs";
import path from "path";

describe("Bitbucket MCP Server - Modular Architecture", () => {
    let indexFileContent;
    let toolsSchemaContent;
    let serviceFiles;

    beforeEach(() => {
        // Read the main index.ts file
        const indexPath = path.resolve(__dirname, "..", "src", "index.ts");
        indexFileContent = fs.readFileSync(indexPath, "utf-8");

        // Read the tools schema file
        const toolsSchemaPath = path.resolve(
            __dirname,
            "..",
            "src",
            "schemas",
            "tools.ts"
        );
        toolsSchemaContent = fs.readFileSync(toolsSchemaPath, "utf-8");

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

    describe("Tool Definitions", () => {
        test("should define all expected MCP tools", () => {
            const expectedTools = [
                "listRepositories",
                "getRepository",
                "getPullRequests",
                "createPullRequest",
                "getPullRequest",
                "updatePullRequest",
                "getPullRequestActivity",
                "approvePullRequest",
                "unapprovePullRequest",
                "declinePullRequest",
                "mergePullRequest",
                "getPullRequestComments",
                "getPullRequestDiff",
                "getPullRequestCommits",
                "getRepositoryBranchingModel",
                "getRepositoryBranchingModelSettings",
                "updateRepositoryBranchingModelSettings",
                "getEffectiveRepositoryBranchingModel",
                "getProjectBranchingModel",
                "getProjectBranchingModelSettings",
                "updateProjectBranchingModelSettings",
            ];

            expectedTools.forEach((toolName) => {
                expect(toolsSchemaContent).toContain(`name: "${toolName}"`);
            });
        });

        test("should have modular service architecture", () => {
            // Verify main index imports services
            expect(indexFileContent).toContain("import { RepositoryService }");
            expect(indexFileContent).toContain("import { PullRequestService }");
            expect(indexFileContent).toContain(
                "import { BranchingModelService }"
            );
            expect(indexFileContent).toContain("import { TOOL_DEFINITIONS }");

            // Verify services are instantiated
            expect(indexFileContent).toContain("new RepositoryService");
            expect(indexFileContent).toContain("new PullRequestService");
            expect(indexFileContent).toContain("new BranchingModelService");
        });

        test("should have service methods implemented", () => {
            // Repository service methods
            expect(serviceFiles.repository).toContain("listRepositories");
            expect(serviceFiles.repository).toContain("getRepository");

            // Pull request service methods
            expect(serviceFiles.pullrequest).toContain("getPullRequests");
            expect(serviceFiles.pullrequest).toContain("createPullRequest");
            expect(serviceFiles.pullrequest).toContain("approvePullRequest");

            // Branching model service methods
            expect(serviceFiles.branchingmodel).toContain(
                "getRepositoryBranchingModel"
            );
            expect(serviceFiles.branchingmodel).toContain(
                "getProjectBranchingModel"
            );
        });
    });

    describe("Modular Components", () => {
        test("should have secure logger configuration", () => {
            const utilsLoggerPath = path.resolve(
                __dirname,
                "..",
                "src",
                "utils",
                "logger.ts"
            );
            const loggerContent = fs.readFileSync(utilsLoggerPath, "utf-8");

            expect(loggerContent).toContain("winston.createLogger");
            expect(loggerContent).toContain("maxsize:");
            expect(loggerContent).toContain("maxFiles:");
            expect(loggerContent).toContain("sanitizeError");
        });

        test("should have configuration management", () => {
            const configPath = path.resolve(
                __dirname,
                "..",
                "src",
                "config",
                "bitbucket.ts"
            );
            const configContent = fs.readFileSync(configPath, "utf-8");

            expect(configContent).toContain("createBitbucketConfig");
            expect(configContent).toContain("validateConfig");
            expect(configContent).toContain("BITBUCKET_URL");
        });

        test("should have centralized schemas", () => {
            expect(toolsSchemaContent).toContain("TOOL_DEFINITIONS");

            const commonSchemaPath = path.resolve(
                __dirname,
                "..",
                "src",
                "schemas",
                "common.ts"
            );
            const commonSchemaContent = fs.readFileSync(
                commonSchemaPath,
                "utf-8"
            );

            expect(commonSchemaContent).toContain("WORKSPACE_SCHEMA");
            expect(commonSchemaContent).toContain("REPO_SLUG_SCHEMA");
        });
    });

    describe("API Integration", () => {
        test("should use correct Bitbucket API endpoints", () => {
            const allServiceContent = Object.values(serviceFiles).join("\n");
            const apiEndpoints = [
                "/repositories/",
                "/pullrequests",
                "/branching-model",
                "/workspaces/",
            ];

            apiEndpoints.forEach((endpoint) => {
                expect(allServiceContent).toContain(endpoint);
            });
        });

        test("should handle HTTP methods correctly", () => {
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

        test("should return consistent response format in services", () => {
            const allServiceContent = Object.values(serviceFiles).join("\n");
            const responsePattern =
                /return\s*{\s*content:\s*\[\s*{\s*type:\s*"text"/g;
            const matches = [...allServiceContent.matchAll(responsePattern)];

            expect(matches.length).toBeGreaterThan(15);
        });
    });

    describe("Security", () => {
        test("should have proper error sanitization", () => {
            const allServiceContent = Object.values(serviceFiles).join("\n");
            expect(allServiceContent).toContain("sanitizeError");
            expect(allServiceContent).toContain("McpError");
        });

        test("should have proper authentication setup", () => {
            const configPath = path.resolve(
                __dirname,
                "..",
                "src",
                "config",
                "bitbucket.ts"
            );
            const configContent = fs.readFileSync(configPath, "utf-8");

            expect(configContent).toContain("BITBUCKET_TOKEN");
            expect(configContent).toContain("BITBUCKET_USERNAME");
            expect(configContent).toContain("BITBUCKET_PASSWORD");
        });
    });
});
