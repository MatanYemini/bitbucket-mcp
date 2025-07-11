export const WORKSPACE_SCHEMA = {
    type: "string" as const,
    description: "Bitbucket workspace name",
};

export const REPO_SLUG_SCHEMA = {
    type: "string" as const,
    description: "Repository slug",
};

export const PULL_REQUEST_ID_SCHEMA = {
    type: "string" as const,
    description: "Pull request ID",
};

export const PROJECT_KEY_SCHEMA = {
    type: "string" as const,
    description: "Project key",
};
