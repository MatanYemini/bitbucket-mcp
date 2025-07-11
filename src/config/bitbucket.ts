import { BitbucketConfig } from "../types/index.js";

export function createBitbucketConfig(): BitbucketConfig {
    return {
        baseUrl: process.env.BITBUCKET_URL ?? "https://api.bitbucket.org/2.0",
        token: process.env.BITBUCKET_TOKEN,
        username: process.env.BITBUCKET_USERNAME,
        password: process.env.BITBUCKET_PASSWORD,
        defaultWorkspace: process.env.BITBUCKET_WORKSPACE,
    };
}

export function validateConfig(config: BitbucketConfig): void {
    if (!config.baseUrl) {
        throw new Error("BITBUCKET_URL is required");
    }

    if (!config.token && !(config.username && config.password)) {
        throw new Error(
            "Either BITBUCKET_TOKEN or BITBUCKET_USERNAME/PASSWORD is required"
        );
    }
}
