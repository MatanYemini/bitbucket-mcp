/**
 * Simple Bitbucket authentication test - CommonJS version
 */

// Load environment variables first (override system env vars)
require("dotenv").config({ override: true });

console.log("🔐 Starting Bitbucket authentication test...\n");

// Check environment variables
const config = {
    baseUrl: process.env.BITBUCKET_URL || "https://api.bitbucket.org/2.0",
    username: process.env.BITBUCKET_USERNAME,
    password: process.env.BITBUCKET_PASSWORD,
    workspace: process.env.BITBUCKET_WORKSPACE,
};

console.log("📋 Configuration:");
console.log(`   Base URL: ${config.baseUrl}`);
console.log(
    `   Username: ${config.username ? "[CONFIGURED]" : "[NOT CONFIGURED]"}`
);
console.log(
    `   Password: ${config.password ? "[CONFIGURED]" : "[NOT CONFIGURED]"}`
);
console.log(
    `   Workspace: ${config.workspace ? "[CONFIGURED]" : "[NOT CONFIGURED]"}`
);
console.log("");

if (!config.username || !config.password) {
    console.error("❌ Error: Missing credentials");
    console.error("   BITBUCKET_USERNAME:", config.username ? "✓" : "✗");
    console.error("   BITBUCKET_PASSWORD:", config.password ? "✓" : "✗");
    process.exit(1);
}

// Basic test with axios
console.log("📡 Testing connection with Bitbucket API...");

const axios = require("axios");

const api = axios.create({
    baseURL: config.baseUrl,
    auth: {
        username: config.username,
        password: config.password,
    },
    timeout: 30000,
});

async function testAuth() {
    try {
        console.log("   Sending request to /user...");
        const response = await api.get("/user");

        console.log("✅ Authentication successful!");
        console.log(`   Status: ${response.status}`);
        console.log(
            `   User: ${response.data.display_name || response.data.username}`
        );
        console.log(`   Account ID: ${response.data.account_id}`);

        if (config.workspace) {
            console.log("\n🏢 Testing workspace access...");
            try {
                const wsResponse = await api.get(
                    `/workspaces/${config.workspace}`
                );
                console.log("✅ Workspace access successful!");
                console.log(`   Workspace: ${wsResponse.data.name}`);
            } catch (wsError) {
                console.error(
                    "❌ Error accessing workspace:",
                    wsError.response?.status,
                    wsError.response?.statusText
                );
            }
        }

        console.log("\n🎉 All tests passed!");
    } catch (error) {
        console.error("\n❌ Authentication error:");
        if (error.response) {
            console.error(
                `   Status: ${error.response.status} ${error.response.statusText}`
            );
            console.error(
                `   Error: ${JSON.stringify(error.response.data, null, 2)}`
            );

            if (error.response.status === 401) {
                console.error("\n💡 Suggestions for 401 error:");
                console.error("   - Check your username and app password");
                console.error(
                    "   - Make sure the app password has the correct permissions"
                );
            }
        } else {
            console.error(`   ${error.message}`);
        }
        process.exit(1);
    }
}

testAuth();
