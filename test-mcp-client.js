#!/usr/bin/env node
/**
 * Simple MCP client test using proper StdioClientTransport
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config"; // Load environment variables

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    try {
        console.log("🚀 Starting MCP Client Test...\n");

        // Create MCP client with proper configuration
        console.log("Creating MCP client...");
        const client = new Client(
            {
                name: "test-client",
                version: "1.0.0",
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        // Prepare server configuration for StdioClientTransport
        const serverPath = path.join(__dirname, "dist", "index.js");
        console.log("Server path:", serverPath);

        const serverConfig = {
            command: process.execPath, // node executable
            args: [serverPath],
            env: {
                BITBUCKET_URL:
                    process.env.BITBUCKET_URL ||
                    "https://api.bitbucket.org/2.0",
                BITBUCKET_USERNAME: process.env.BITBUCKET_USERNAME,
                BITBUCKET_PASSWORD: process.env.BITBUCKET_PASSWORD,
                BITBUCKET_WORKSPACE: process.env.BITBUCKET_WORKSPACE,
                PATH: process.env.PATH,
                // Add Windows-specific env vars if needed
                ...(process.platform === "win32" && {
                    SYSTEMROOT: process.env.SYSTEMROOT,
                    SYSTEMDRIVE: process.env.SYSTEMDRIVE,
                    USERPROFILE: process.env.USERPROFILE,
                }),
            },
        };

        // Validate required environment variables
        if (
            !serverConfig.env.BITBUCKET_USERNAME ||
            !serverConfig.env.BITBUCKET_PASSWORD ||
            !serverConfig.env.BITBUCKET_WORKSPACE
        ) {
            throw new Error(
                "Missing required environment variables. Please set:\n" +
                    "  - BITBUCKET_USERNAME\n" +
                    "  - BITBUCKET_PASSWORD\n" +
                    "  - BITBUCKET_WORKSPACE\n" +
                    "\nCreate a .env file or set them in your environment."
            );
        }

        console.log("Environment configuration:");
        console.log(`  - BITBUCKET_URL: ${serverConfig.env.BITBUCKET_URL}`);
        console.log(
            `  - BITBUCKET_USERNAME: ${
                serverConfig.env.BITBUCKET_USERNAME
                    ? "[CONFIGURED]"
                    : "[NOT CONFIGURED]"
            }`
        );
        console.log(
            `  - BITBUCKET_PASSWORD: ${
                serverConfig.env.BITBUCKET_PASSWORD
                    ? "[CONFIGURED]"
                    : "[NOT CONFIGURED]"
            }`
        );
        console.log(
            `  - BITBUCKET_WORKSPACE: ${
                serverConfig.env.BITBUCKET_WORKSPACE
                    ? "[CONFIGURED]"
                    : "[NOT CONFIGURED]"
            }`
        );
        console.log("");

        console.log("Creating transport...");
        const transport = new StdioClientTransport(serverConfig);

        console.log("Connecting to MCP server...");
        await client.connect(transport);
        console.log("✅ Connected to MCP server!");

        // List available tools
        console.log("\n📋 Listing available tools...");
        const tools = await client.listTools();
        console.log(`Found ${tools.tools.length} tools:`);
        tools.tools.forEach((tool, index) => {
            console.log(`  ${index + 1}. ${tool.name} - ${tool.description}`);
        });

        // Test listRepositories tool
        const listReposTool = tools.tools.find(
            (tool) => tool.name === "listRepositories"
        );
        if (listReposTool) {
            console.log("\n🧪 Testing listRepositories tool...");
            try {
                const result = await client.callTool({
                    name: "listRepositories",
                    arguments: {
                        workspace: process.env.BITBUCKET_WORKSPACE,
                        limit: 3,
                    },
                });

                console.log("✅ Tool execution successful!");
                if (result.content && result.content.length > 0) {
                    const content = result.content[0];
                    if (content.type === "text") {
                        try {
                            const data = JSON.parse(content.text);
                            console.log(
                                "Response data:",
                                JSON.stringify(data, null, 2)
                            );

                            if (data.values && Array.isArray(data.values)) {
                                console.log(
                                    `Found ${data.values.length} repositories:`
                                );
                                data.values.forEach((repo, index) => {
                                    console.log(
                                        `  ${index + 1}. ${repo.full_name} (${
                                            repo.is_private
                                                ? "Private"
                                                : "Public"
                                        })`
                                    );
                                });
                            } else {
                                console.log(
                                    "No repositories found or unexpected data format"
                                );
                            }
                        } catch (parseError) {
                            console.log("Raw response:", content.text);
                        }
                    }
                }
            } catch (toolError) {
                console.error("❌ Tool execution failed:", toolError.message);
                console.error("Tool error details:", toolError);
            }
        }

        console.log("\n🎉 Test completed successfully!");

        // Close connection
        await client.close();
    } catch (error) {
        console.error("\n❌ Test failed:", error.message);
        if (error.stack) {
            console.error("Stack trace:", error.stack);
        }
        process.exit(1);
    }
}

// Handle process termination
process.on("SIGINT", () => {
    console.log("\n⏹️ Received SIGINT, shutting down...");
    process.exit(0);
});

main().catch((error) => {
    console.error("💥 Unexpected error:", error);
    process.exit(1);
});
