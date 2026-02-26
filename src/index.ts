#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance, AxiosError } from "axios";
import winston from "winston";
import os from "os";
import path from "path";
import fs from "fs";
import {
  BitbucketPaginator,
  BITBUCKET_ALL_ITEMS_CAP,
  BITBUCKET_DEFAULT_PAGELEN,
  BITBUCKET_MAX_PAGELEN,
} from "./pagination.js";

// =========== LOGGER SETUP ==========
// File-based logging with sensible defaults and ability to disable
function getDefaultLogDirectory(): string {
  if (process.platform === "win32") {
    const base =
      process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    return path.join(base, "bitbucket-mcp");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Logs", "bitbucket-mcp");
  }
  const xdgStateHome = process.env.XDG_STATE_HOME;
  if (xdgStateHome && xdgStateHome.length > 0) {
    return path.join(xdgStateHome, "bitbucket-mcp");
  }
  return path.join(os.homedir(), ".local", "state", "bitbucket-mcp");
}

function isTruthyEnv(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  const normalized = String(value).toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function getLogFilePath(): string | undefined {
  if (isTruthyEnv(process.env.BITBUCKET_LOG_DISABLE)) {
    return undefined;
  }

  const explicitFile = process.env.BITBUCKET_LOG_FILE;
  if (explicitFile && explicitFile.trim().length > 0) {
    return explicitFile;
  }

  const baseDir =
    process.env.BITBUCKET_LOG_DIR &&
    process.env.BITBUCKET_LOG_DIR.trim().length > 0
      ? process.env.BITBUCKET_LOG_DIR!
      : getDefaultLogDirectory();

  let effectiveDir = baseDir as string;
  if (isTruthyEnv(process.env.BITBUCKET_LOG_PER_CWD)) {
    const sanitizedCwd = process
      .cwd()
      .replace(/[\\/]/g, "_")
      .replace(/[:*?"<>|]/g, "");
    effectiveDir = path.join(baseDir as string, sanitizedCwd);
  }

  try {
    fs.mkdirSync(effectiveDir, { recursive: true });
  } catch {
    return undefined; // If we cannot create the directory, disable file logging rather than polluting CWD
  }

  return path.join(effectiveDir, "bitbucket.log");
}

const resolvedLogFile = getLogFilePath();
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: resolvedLogFile
    ? [new winston.transports.File({ filename: resolvedLogFile })]
    : [],
});

const PAGINATION_BASE_SCHEMA = {
  pagelen: {
    type: "number",
    minimum: 1,
    maximum: BITBUCKET_MAX_PAGELEN,
    description: `Number of items per page (Bitbucket pagelen). Defaults to ${BITBUCKET_DEFAULT_PAGELEN} and caps at ${BITBUCKET_MAX_PAGELEN}.`,
  },
  page: {
    type: "number",
    minimum: 1,
    description: "Bitbucket page number to fetch (1-based).",
  },
};

const PAGINATION_ALL_SCHEMA = {
  type: "boolean",
  description: `When true (and no page is provided), automatically follows Bitbucket next links to return all items up to ${BITBUCKET_ALL_ITEMS_CAP}.`,
};

const LEGACY_LIMIT_SCHEMA = {
  type: "number",
  description:
    "Deprecated alias for pagelen. Use pagelen/page/all for pagination control.",
};

// =========== TYPE DEFINITIONS ===========
/**
 * Represents a Bitbucket repository
 */
interface BitbucketRepository {
  uuid: string;
  name: string;
  full_name: string;
  description: string;
  is_private: boolean;
  created_on: string;
  updated_on: string;
  size: number;
  language: string;
  has_issues: boolean;
  has_wiki: boolean;
  fork_policy: string;
  owner: BitbucketAccount;
  workspace: BitbucketWorkspace;
  project: BitbucketProject;
  mainbranch?: BitbucketBranch;
  website?: string;
  scm: string;
  links: Record<string, BitbucketLink[]>;
}

/**
 * Represents a Bitbucket account (user or team)
 */
interface BitbucketAccount {
  uuid: string;
  display_name: string;
  account_id: string;
  nickname?: string;
  type: "user" | "team";
  links: Record<string, BitbucketLink[]>;
}

/**
 * Represents a Bitbucket workspace
 */
interface BitbucketWorkspace {
  uuid: string;
  name: string;
  slug: string;
  type: "workspace";
  links: Record<string, BitbucketLink[]>;
}

/**
 * Represents a Bitbucket project
 */
interface BitbucketProject {
  uuid: string;
  key: string;
  name: string;
  description?: string;
  is_private: boolean;
  type: "project";
  links: Record<string, BitbucketLink[]>;
}

/**
 * Represents a Bitbucket branch reference
 */
interface BitbucketBranch {
  name: string;
  type: "branch";
}

/**
 * Represents a hyperlink in Bitbucket API responses
 */
interface BitbucketLink {
  href: string;
  name?: string;
}

/**
 * Represents a Bitbucket pull request
 */
interface BitbucketPullRequest {
  id: number;
  title: string;
  description: string;
  state: "OPEN" | "MERGED" | "DECLINED" | "SUPERSEDED";
  author: BitbucketAccount;
  source: BitbucketBranchReference;
  destination: BitbucketBranchReference;
  created_on: string;
  updated_on: string;
  closed_on?: string;
  comment_count: number;
  task_count: number;
  close_source_branch: boolean;
  reviewers: BitbucketAccount[];
  participants: BitbucketParticipant[];
  links: Record<string, BitbucketLink[]>;
  summary?: {
    raw: string;
    markup: string;
    html: string;
  };
}

/**
 * Represents a branch reference in a pull request
 */
interface BitbucketBranchReference {
  branch: {
    name: string;
  };
  commit: {
    hash: string;
  };
  repository: BitbucketRepository;
}

/**
 * Represents a participant in a pull request
 */
interface BitbucketParticipant {
  user: BitbucketAccount;
  role: "PARTICIPANT" | "REVIEWER";
  approved: boolean;
  state?: "approved" | "changes_requested" | null;
  participated_on: string;
}

/**
 * Represents inline comment positioning information
 */
interface InlineCommentInline {
  path: string;
  from?: number;
  to?: number;
}

/**
 * Represents a Bitbucket branching model
 */
interface BitbucketBranchingModel {
  type: "branching_model";
  development: {
    name: string;
    branch?: BitbucketBranch;
    use_mainbranch: boolean;
  };
  production?: {
    name: string;
    branch?: BitbucketBranch;
    use_mainbranch: boolean;
  };
  branch_types: Array<{
    kind: string;
    prefix: string;
  }>;
  links: Record<string, BitbucketLink[]>;
}

/**
 * Represents a Bitbucket branching model settings
 */
interface BitbucketBranchingModelSettings {
  type: "branching_model_settings";
  development: {
    name: string;
    use_mainbranch: boolean;
    is_valid?: boolean;
  };
  production: {
    name: string;
    use_mainbranch: boolean;
    enabled: boolean;
    is_valid?: boolean;
  };
  branch_types: Array<{
    kind: string;
    prefix: string;
    enabled: boolean;
  }>;
  links: Record<string, BitbucketLink[]>;
}

/**
 * Represents a Bitbucket project branching model
 */
interface BitbucketProjectBranchingModel {
  type: "project_branching_model";
  development: {
    name: string;
    use_mainbranch: boolean;
  };
  production?: {
    name: string;
    use_mainbranch: boolean;
  };
  branch_types: Array<{
    kind: string;
    prefix: string;
  }>;
  links: Record<string, BitbucketLink[]>;
}

interface BitbucketConfig {
  baseUrl: string;
  token?: string;
  username?: string;
  password?: string;
  defaultWorkspace?: string;
  allowDangerousCommands?: boolean;
}

// Normalize Bitbucket configuration for backward compatibility and DX
function normalizeBitbucketConfig(rawConfig: BitbucketConfig): BitbucketConfig {
  let normalizedConfig = { ...rawConfig };
  try {
    const parsed = new URL(rawConfig.baseUrl);
    const host = parsed.hostname.toLowerCase();

    // If users provide a web URL like https://bitbucket.org/<workspace>,
    // extract the workspace and switch to the public API base URL
    if (host === "bitbucket.org" || host === "www.bitbucket.org") {
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (!normalizedConfig.defaultWorkspace && segments.length >= 1) {
        normalizedConfig.defaultWorkspace = segments[0];
      }
      normalizedConfig.baseUrl = "https://api.bitbucket.org/2.0";
    }

    // If users provide https://api.bitbucket.org (without /2.0), ensure /2.0
    if (host === "api.bitbucket.org") {
      const pathname = parsed.pathname.replace(/\/+$/, "");
      if (!pathname.startsWith("/2.0")) {
        normalizedConfig.baseUrl = "https://api.bitbucket.org/2.0";
      } else {
        normalizedConfig.baseUrl = "https://api.bitbucket.org/2.0";
      }
    }

    // Remove trailing slashes for a consistent axios baseURL
    normalizedConfig.baseUrl = normalizedConfig.baseUrl.replace(/\/+$/, "");
  } catch {
    // If baseUrl is not a valid absolute URL, keep as-is (custom/self-hosted cases)
  }

  return normalizedConfig;
}

/**
 * Represents a Bitbucket pipeline
 */
interface BitbucketPipeline {
  uuid: string;
  type: "pipeline";
  build_number: number;
  creator: BitbucketAccount;
  repository: BitbucketRepository;
  target: BitbucketPipelineTarget;
  trigger: BitbucketPipelineTrigger;
  state: BitbucketPipelineState;
  created_on: string;
  completed_on?: string;
  build_seconds_used?: number;
  variables?: BitbucketPipelineVariable[];
  configuration_sources?: BitbucketPipelineConfigurationSource[];
  links: Record<string, BitbucketLink[]>;
}

/**
 * Represents a pipeline target
 */
interface BitbucketPipelineTarget {
  type: string;
  ref_type?: string;
  ref_name?: string;
  commit?: {
    type: "commit";
    hash: string;
  };
  selector?: {
    type: string;
    pattern: string;
  };
}

/**
 * Represents a pipeline trigger
 */
interface BitbucketPipelineTrigger {
  type: string;
  name?: string;
}

/**
 * Represents a pipeline state
 */
interface BitbucketPipelineState {
  type: string;
  name:
    | "PENDING"
    | "IN_PROGRESS"
    | "SUCCESSFUL"
    | "FAILED"
    | "ERROR"
    | "STOPPED";
  result?: {
    type: string;
    name: "SUCCESSFUL" | "FAILED" | "ERROR" | "STOPPED";
  };
}

/**
 * Represents a pipeline variable
 */
interface BitbucketPipelineVariable {
  type: "pipeline_variable";
  key: string;
  value: string;
  secured?: boolean;
}

/**
 * Represents a pipeline configuration source
 */
interface BitbucketPipelineConfigurationSource {
  source: string;
  uri: string;
}

/**
 * Represents a pipeline step
 */
interface BitbucketPipelineStep {
  uuid: string;
  type: "pipeline_step";
  name?: string;
  started_on?: string;
  completed_on?: string;
  state: BitbucketPipelineState;
  image?: {
    name: string;
    username?: string;
    password?: string;
    email?: string;
  };
  setup_commands?: BitbucketPipelineCommand[];
  script_commands?: BitbucketPipelineCommand[];
}

/**
 * Represents a pipeline command
 */
interface BitbucketPipelineCommand {
  name?: string;
  command: string;
}

// =========== MCP SERVER ===========
class BitbucketServer {
  private readonly server: Server;
  private readonly api: AxiosInstance;
  private readonly config: BitbucketConfig;
  private readonly paginator: BitbucketPaginator;
  private readonly dangerousToolNames = new Set<string>([
    "deletePullRequestComment",
    "deletePullRequestTask",
  ]);
  private isDangerousTool(name: string): boolean {
    // Explicitly dangerous or conservative prefix match (delete*)
    if (this.dangerousToolNames.has(name)) return true;
    if (/^delete/i.test(name)) return true;
    return false;
  }

  constructor() {
    // Initialize with the older Server class pattern
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

    // Configuration from environment variables
    const initialConfig: BitbucketConfig = {
      baseUrl: process.env.BITBUCKET_URL ?? "https://api.bitbucket.org/2.0",
      token: process.env.BITBUCKET_TOKEN,
      username: process.env.BITBUCKET_USERNAME,
      password: process.env.BITBUCKET_PASSWORD,
      defaultWorkspace: process.env.BITBUCKET_WORKSPACE,
    };

    const normalizedConfig = normalizeBitbucketConfig(initialConfig);

    if (
      normalizedConfig.baseUrl !== initialConfig.baseUrl ||
      normalizedConfig.defaultWorkspace !== initialConfig.defaultWorkspace
    ) {
      logger.info("Normalized Bitbucket configuration", {
        fromBaseUrl: initialConfig.baseUrl,
        toBaseUrl: normalizedConfig.baseUrl,
        defaultWorkspace: normalizedConfig.defaultWorkspace,
      });
    }

    // Parse dangerous commands toggle (off by default)
    const enableDangerousEnv = (
      process.env.BITBUCKET_ENABLE_DANGEROUS ??
      process.env.BITBUCKET_ALLOW_DANGEROUS ??
      ""
    )
      .toString()
      .toLowerCase();
    const allowDangerousCommands = ["1", "true", "yes", "on"].includes(
      enableDangerousEnv
    );

    this.config = { ...normalizedConfig, allowDangerousCommands };

    // Validate required config
    if (!this.config.baseUrl) {
      throw new Error("BITBUCKET_URL is required");
    }

    if (!this.config.token && !(this.config.username && this.config.password)) {
      throw new Error(
        "Either BITBUCKET_TOKEN or BITBUCKET_USERNAME/PASSWORD is required"
      );
    }

    // Setup Axios instance
    const headers: Record<string, string> = {};
    if (this.config.token) {
      headers.Authorization = `Bearer ${this.config.token}`;
    }
    this.api = axios.create({
      baseURL: this.config.baseUrl,
      headers,
      auth:
        this.config.username && this.config.password
          ? { username: this.config.username, password: this.config.password }
          : undefined,
    });

    this.paginator = new BitbucketPaginator(this.api, logger);

    // Setup tool handlers using the request handler pattern
    this.setupToolHandlers();

    // Add error handler - CRITICAL for stability
    this.server.onerror = (error) => logger.error("[MCP Error]", error);
  }

  private setupToolHandlers() {
    // Register the list tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "listRepositories",
          description: "List Bitbucket repositories",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              name: {
                type: "string",
                description:
                  "Filter repositories by name (partial match supported)",
              },
              ...PAGINATION_BASE_SCHEMA,
              all: PAGINATION_ALL_SCHEMA,
              limit: LEGACY_LIMIT_SCHEMA,
            },
          },
        },
        {
          name: "getRepository",
          description: "Get repository details",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
            },
            required: ["workspace", "repo_slug"],
          },
        },
        {
          name: "getPullRequests",
          description: "Get pull requests for a repository",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              state: {
                type: "string",
                enum: ["OPEN", "MERGED", "DECLINED", "SUPERSEDED"],
                description: "Pull request state",
              },
              ...PAGINATION_BASE_SCHEMA,
              all: PAGINATION_ALL_SCHEMA,
              limit: LEGACY_LIMIT_SCHEMA,
            },
            required: ["workspace", "repo_slug"],
          },
        },
        {
          name: "createPullRequest",
          description: "Create a new pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              title: { type: "string", description: "Pull request title" },
              description: {
                type: "string",
                description: "Pull request description",
              },
              sourceBranch: {
                type: "string",
                description: "Source branch name",
              },
              targetBranch: {
                type: "string",
                description: "Target branch name",
              },
              reviewers: {
                type: "array",
                items: { type: "string" },
                description:
                  "List of reviewer UUIDs (e.g., '{04776764-62c7-453b-b97e-302f60395ceb}')",
              },
              draft: {
                type: "boolean",
                description: "Whether to create the pull request as a draft",
              },
            },
            required: [
              "workspace",
              "repo_slug",
              "title",
              "description",
              "sourceBranch",
              "targetBranch",
            ],
          },
        },
        {
          name: "getPullRequest",
          description: "Get details for a specific pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
              ...PAGINATION_BASE_SCHEMA,
              all: PAGINATION_ALL_SCHEMA,
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
          },
        },
        {
          name: "updatePullRequest",
          description: "Update a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
              title: { type: "string", description: "New pull request title" },
              description: {
                type: "string",
                description: "New pull request description",
              },
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
          },
        },
        {
          name: "getPullRequestActivity",
          description: "Get activity log for a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
              ...PAGINATION_BASE_SCHEMA,
              all: PAGINATION_ALL_SCHEMA,
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
          },
        },
        {
          name: "approvePullRequest",
          description: "Approve a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
              ...PAGINATION_BASE_SCHEMA,
              all: PAGINATION_ALL_SCHEMA,
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
          },
        },
        {
          name: "unapprovePullRequest",
          description: "Remove approval from a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
              ...PAGINATION_BASE_SCHEMA,
              all: PAGINATION_ALL_SCHEMA,
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
          },
        },
        {
          name: "declinePullRequest",
          description: "Decline a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
              message: { type: "string", description: "Reason for declining" },
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
          },
        },
        {
          name: "mergePullRequest",
          description: "Merge a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
              message: { type: "string", description: "Merge commit message" },
              strategy: {
                type: "string",
                enum: ["merge-commit", "squash", "fast-forward"],
                description: "Merge strategy",
              },
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
          },
        },
        {
          name: "getPullRequestComments",
          description: "List comments on a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
              ...PAGINATION_BASE_SCHEMA,
              all: PAGINATION_ALL_SCHEMA,
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
          },
        },
        {
          name: "getPullRequestDiff",
          description: "Get diff for a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
          },
        },
        {
          name: "getPullRequestCommits",
          description: "Get commits on a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
              ...PAGINATION_BASE_SCHEMA,
              all: PAGINATION_ALL_SCHEMA,
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
          },
        },
        {
          name: "addPullRequestComment",
          description: "Add a comment to a pull request (general or inline)",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
              content: {
                type: "string",
                description: "Comment content in markdown format",
              },
              pending: {
                type: "boolean",
                description:
                  "Whether to create this comment as a pending comment (draft state)",
              },
              inline: {
                type: "object",
                description:
                  "Inline comment information for commenting on specific lines",
                properties: {
                  path: {
                    type: "string",
                    description: "Path to the file in the repository",
                  },
                  from: {
                    type: "number",
                    description:
                      "Line number in the old version of the file (for deleted or modified lines)",
                  },
                  to: {
                    type: "number",
                    description:
                      "Line number in the new version of the file (for added or modified lines)",
                  },
                },
                required: ["path"],
              },
            },
            required: ["workspace", "repo_slug", "pull_request_id", "content"],
          },
        },
        {
          name: "addPendingPullRequestComment",
          description:
            "Add a pending (draft) comment to a pull request that can be published later",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
              content: {
                type: "string",
                description: "Comment content in markdown format",
              },
              inline: {
                type: "object",
                description:
                  "Inline comment information for commenting on specific lines",
                properties: {
                  path: {
                    type: "string",
                    description: "Path to the file in the repository",
                  },
                  from: {
                    type: "number",
                    description:
                      "Line number in the old version of the file (for deleted or modified lines)",
                  },
                  to: {
                    type: "number",
                    description:
                      "Line number in the new version of the file (for added or modified lines)",
                  },
                },
                required: ["path"],
              },
            },
            required: ["workspace", "repo_slug", "pull_request_id", "content"],
          },
        },
        {
          name: "publishPendingComments",
          description: "Publish all pending comments for a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
          },
        },
        {
          name: "getRepositoryBranchingModel",
          description: "Get the branching model for a repository",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
            },
            required: ["workspace", "repo_slug"],
          },
        },
        {
          name: "getRepositoryBranchingModelSettings",
          description: "Get the branching model config for a repository",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
            },
            required: ["workspace", "repo_slug"],
          },
        },
        {
          name: "updateRepositoryBranchingModelSettings",
          description: "Update the branching model config for a repository",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              development: {
                type: "object",
                description: "Development branch settings",
                properties: {
                  name: { type: "string", description: "Branch name" },
                  use_mainbranch: {
                    type: "boolean",
                    description: "Use main branch",
                  },
                },
              },
              production: {
                type: "object",
                description: "Production branch settings",
                properties: {
                  name: { type: "string", description: "Branch name" },
                  use_mainbranch: {
                    type: "boolean",
                    description: "Use main branch",
                  },
                  enabled: {
                    type: "boolean",
                    description: "Enable production branch",
                  },
                },
              },
              branch_types: {
                type: "array",
                description: "Branch types configuration",
                items: {
                  type: "object",
                  properties: {
                    kind: {
                      type: "string",
                      description: "Branch type kind (e.g., bugfix, feature)",
                    },
                    prefix: { type: "string", description: "Branch prefix" },
                    enabled: {
                      type: "boolean",
                      description: "Enable this branch type",
                    },
                  },
                  required: ["kind"],
                },
              },
            },
            required: ["workspace", "repo_slug"],
          },
        },
        {
          name: "getEffectiveRepositoryBranchingModel",
          description: "Get the effective branching model for a repository",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
            },
            required: ["workspace", "repo_slug"],
          },
        },
        {
          name: "getProjectBranchingModel",
          description: "Get the branching model for a project",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              project_key: { type: "string", description: "Project key" },
            },
            required: ["workspace", "project_key"],
          },
        },
        {
          name: "getProjectBranchingModelSettings",
          description: "Get the branching model config for a project",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              project_key: { type: "string", description: "Project key" },
            },
            required: ["workspace", "project_key"],
          },
        },
        {
          name: "updateProjectBranchingModelSettings",
          description: "Update the branching model config for a project",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              project_key: { type: "string", description: "Project key" },
              development: {
                type: "object",
                description: "Development branch settings",
                properties: {
                  name: { type: "string", description: "Branch name" },
                  use_mainbranch: {
                    type: "boolean",
                    description: "Use main branch",
                  },
                },
              },
              production: {
                type: "object",
                description: "Production branch settings",
                properties: {
                  name: { type: "string", description: "Branch name" },
                  use_mainbranch: {
                    type: "boolean",
                    description: "Use main branch",
                  },
                  enabled: {
                    type: "boolean",
                    description: "Enable production branch",
                  },
                },
              },
              branch_types: {
                type: "array",
                description: "Branch types configuration",
                items: {
                  type: "object",
                  properties: {
                    kind: {
                      type: "string",
                      description: "Branch type kind (e.g., bugfix, feature)",
                    },
                    prefix: { type: "string", description: "Branch prefix" },
                    enabled: {
                      type: "boolean",
                      description: "Enable this branch type",
                    },
                  },
                  required: ["kind"],
                },
              },
            },
            required: ["workspace", "project_key"],
          },
        },
        {
          name: "createDraftPullRequest",
          description: "Create a new draft pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              title: { type: "string", description: "Pull request title" },
              description: {
                type: "string",
                description: "Pull request description",
              },
              sourceBranch: {
                type: "string",
                description: "Source branch name",
              },
              targetBranch: {
                type: "string",
                description: "Target branch name",
              },
              reviewers: {
                type: "array",
                items: { type: "string" },
                description:
                  "List of reviewer UUIDs (e.g., '{04776764-62c7-453b-b97e-302f60395ceb}')",
              },
            },
            required: [
              "workspace",
              "repo_slug",
              "title",
              "description",
              "sourceBranch",
              "targetBranch",
            ],
          },
        },
        {
          name: "publishDraftPullRequest",
          description:
            "Publish a draft pull request to make it ready for review",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
          },
        },
        {
          name: "convertTodraft",
          description: "Convert a regular pull request to draft status",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
          },
        },
        {
          name: "getPendingReviewPRs",
          description:
            "List all open pull requests in the workspace where the authenticated user is a reviewer and has not yet approved.",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description:
                  "Bitbucket workspace name (optional, defaults to BITBUCKET_WORKSPACE)",
              },
              limit: {
                type: "number",
                description: "Maximum number of PRs to return (optional)",
              },
              repositoryList: {
                type: "array",
                items: { type: "string" },
                description: "List of repository slugs to check (optional)",
              },
            },
          },
        },
        {
          name: "listPipelineRuns",
          description: "List pipeline runs for a repository",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              ...PAGINATION_BASE_SCHEMA,
              all: PAGINATION_ALL_SCHEMA,
              limit: LEGACY_LIMIT_SCHEMA,
              status: {
                type: "string",
                enum: [
                  "PENDING",
                  "IN_PROGRESS",
                  "SUCCESSFUL",
                  "FAILED",
                  "ERROR",
                  "STOPPED",
                ],
                description: "Filter pipelines by status",
              },
              target_branch: {
                type: "string",
                description: "Filter pipelines by target branch",
              },
              trigger_type: {
                type: "string",
                enum: ["manual", "push", "pullrequest", "schedule"],
                description: "Filter pipelines by trigger type",
              },
            },
            required: ["workspace", "repo_slug"],
          },
        },
        {
          name: "getPipelineRun",
          description: "Get details for a specific pipeline run",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pipeline_uuid: {
                type: "string",
                description: "Pipeline UUID",
              },
              ...PAGINATION_BASE_SCHEMA,
              all: PAGINATION_ALL_SCHEMA,
            },
            required: ["workspace", "repo_slug", "pipeline_uuid"],
          },
        },
        {
          name: "runPipeline",
          description: "Trigger a new pipeline run",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              target: {
                type: "object",
                description: "Pipeline target configuration",
                properties: {
                  ref_type: {
                    type: "string",
                    enum: ["branch", "tag", "bookmark", "named_branch"],
                    description: "Reference type",
                  },
                  ref_name: {
                    type: "string",
                    description: "Reference name (branch, tag, etc.)",
                  },
                  commit_hash: {
                    type: "string",
                    description: "Specific commit hash to run pipeline on",
                  },
                  selector_type: {
                    type: "string",
                    enum: ["default", "custom", "pull-requests"],
                    description: "Pipeline selector type",
                  },
                  selector_pattern: {
                    type: "string",
                    description:
                      "Pipeline selector pattern (for custom pipelines)",
                  },
                },
                required: ["ref_type", "ref_name"],
              },
              variables: {
                type: "array",
                description: "Pipeline variables",
                items: {
                  type: "object",
                  properties: {
                    key: { type: "string", description: "Variable name" },
                    value: { type: "string", description: "Variable value" },
                    secured: {
                      type: "boolean",
                      description: "Whether the variable is secured",
                    },
                  },
                  required: ["key", "value"],
                },
              },
            },
            required: ["workspace", "repo_slug", "target"],
          },
        },
        {
          name: "stopPipeline",
          description: "Stop a running pipeline",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pipeline_uuid: {
                type: "string",
                description: "Pipeline UUID",
              },
            },
            required: ["workspace", "repo_slug", "pipeline_uuid"],
          },
        },
        {
          name: "getPipelineSteps",
          description: "List steps for a pipeline run",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pipeline_uuid: {
                type: "string",
                description: "Pipeline UUID",
              },
            },
            required: ["workspace", "repo_slug", "pipeline_uuid"],
          },
        },
        {
          name: "getPipelineStep",
          description: "Get details for a specific pipeline step",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pipeline_uuid: {
                type: "string",
                description: "Pipeline UUID",
              },
              step_uuid: {
                type: "string",
                description: "Step UUID",
              },
            },
            required: ["workspace", "repo_slug", "pipeline_uuid", "step_uuid"],
          },
        },
        {
          name: "getPipelineStepLogs",
          description: "Get logs for a specific pipeline step",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pipeline_uuid: {
                type: "string",
                description: "Pipeline UUID",
              },
              step_uuid: {
                type: "string",
                description: "Step UUID",
              },
              max_lines: {
                type: "number",
                description:
                  "Maximum number of log lines to return (default 500)",
                minimum: 1,
                maximum: 5000,
              },
              tail: {
                type: "boolean",
                description:
                  "When true, returns the most recent lines instead of the first lines",
              },
              errors_only: {
                type: "boolean",
                description:
                  "When true, only include lines that look like errors (case-insensitive match on error keywords)",
              },
              search_term: {
                type: "string",
                description:
                  "Optional case-insensitive search term to filter log lines",
              },
              save_to_file: {
                type: "boolean",
                description:
                  "Save the full log to a temporary file and return the path for offline review",
              },
            },
            required: ["workspace", "repo_slug", "pipeline_uuid", "step_uuid"],
          },
        },
        {
          name: "getPullRequestComment",
          description: "Get a specific comment on a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
              comment_id: { type: "string", description: "Comment ID" },
            },
            required: [
              "workspace",
              "repo_slug",
              "pull_request_id",
              "comment_id",
            ],
          },
        },
        {
          name: "updatePullRequestComment",
          description: "Update a comment on a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
              comment_id: { type: "string", description: "Comment ID" },
              content: {
                type: "string",
                description: "Updated comment content",
              },
            },
            required: [
              "workspace",
              "repo_slug",
              "pull_request_id",
              "comment_id",
              "content",
            ],
          },
        },
        {
          name: "deletePullRequestComment",
          description: "Delete a comment on a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
              comment_id: { type: "string", description: "Comment ID" },
            },
            required: [
              "workspace",
              "repo_slug",
              "pull_request_id",
              "comment_id",
            ],
          },
        },
        {
          name: "resolveComment",
          description: "Resolve a comment thread on a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
              comment_id: { type: "string", description: "Comment ID" },
            },
            required: [
              "workspace",
              "repo_slug",
              "pull_request_id",
              "comment_id",
            ],
          },
        },
        {
          name: "reopenComment",
          description: "Reopen a resolved comment thread on a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
              comment_id: { type: "string", description: "Comment ID" },
            },
            required: [
              "workspace",
              "repo_slug",
              "pull_request_id",
              "comment_id",
            ],
          },
        },
        {
          name: "getPullRequestDiffStat",
          description: "Get diff statistics for a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
          },
        },
        {
          name: "getPullRequestPatch",
          description: "Get patch for a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
          },
        },
        {
          name: "getPullRequestTasks",
          description: "List tasks on a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
          },
        },
        {
          name: "createPullRequestTask",
          description: "Create a task on a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
              content: { type: "string", description: "Task content" },
              comment: {
                type: "number",
                description: "Optional comment ID to attach the task",
              },
              state: {
                type: "string",
                enum: ["OPEN", "RESOLVED"],
                description: "Initial task state",
              },
            },
            required: ["workspace", "repo_slug", "pull_request_id", "content"],
          },
        },
        {
          name: "getPullRequestTask",
          description: "Get a specific task on a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
              task_id: { type: "string", description: "Task ID" },
            },
            required: ["workspace", "repo_slug", "pull_request_id", "task_id"],
          },
        },
        {
          name: "updatePullRequestTask",
          description: "Update a task on a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
              task_id: { type: "string", description: "Task ID" },
              content: { type: "string", description: "Updated task content" },
              state: {
                type: "string",
                enum: ["OPEN", "RESOLVED"],
                description: "Updated task state",
              },
            },
            required: ["workspace", "repo_slug", "pull_request_id", "task_id"],
          },
        },
        {
          name: "deletePullRequestTask",
          description: "Delete a task from a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
              task_id: { type: "string", description: "Task ID" },
            },
            required: ["workspace", "repo_slug", "pull_request_id", "task_id"],
          },
        },
        {
          name: "getPullRequestStatuses",
          description: "List commit statuses associated with a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
              pull_request_id: {
                type: "string",
                description: "Pull request ID",
              },
            },
            required: ["workspace", "repo_slug", "pull_request_id"],
          },
        },
        {
          name: "getEffectiveDefaultReviewers",
          description: "Get effective default reviewers for a repository",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace name",
              },
              repo_slug: { type: "string", description: "Repository slug" },
            },
            required: ["workspace", "repo_slug"],
          },
        },
      ].filter(
        (tool) =>
          this.config.allowDangerousCommands === true ||
          !this.isDangerousTool(tool.name)
      ),
    }));

    // Register the call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        logger.info(`Called tool: ${request.params.name}`, {
          arguments: request.params.arguments,
        });
        const args = request.params.arguments ?? {};
        const toolName = request.params.name;

        // Guard dangerous tools when not enabled
        if (
          this.isDangerousTool(toolName) &&
          this.config.allowDangerousCommands !== true
        ) {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Tool ${toolName} is disabled. Set BITBUCKET_ENABLE_DANGEROUS=true to enable.`
          );
        }

        switch (request.params.name) {
          case "listRepositories":
            return await this.listRepositories(
              args.workspace as string,
              args.pagelen as number,
              args.page as number,
              args.all as boolean,
              args.name as string,
              args.limit as number
            );
          case "getRepository":
            return await this.getRepository(
              args.workspace as string,
              args.repo_slug as string
            );
          case "getPullRequests":
            return await this.getPullRequests(
              args.workspace as string,
              args.repo_slug as string,
              args.state as "OPEN" | "MERGED" | "DECLINED" | "SUPERSEDED",
              args.pagelen as number,
              args.page as number,
              args.all as boolean,
              args.limit as number
            );
          case "createPullRequest":
            return await this.createPullRequest(
              args.workspace as string,
              args.repo_slug as string,
              args.title as string,
              args.description as string,
              args.sourceBranch as string,
              args.targetBranch as string,
              args.reviewers as string[] | undefined,
              args.draft as boolean
            );
          case "getPullRequest":
            return await this.getPullRequest(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string
            );
          case "updatePullRequest":
            return await this.updatePullRequest(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string,
              args.title as string,
              args.description as string
            );
          case "getPullRequestActivity":
            return await this.getPullRequestActivity(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string,
              args.pagelen as number,
              args.page as number,
              args.all as boolean
            );
          case "approvePullRequest":
            return await this.approvePullRequest(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string
            );
          case "unapprovePullRequest":
            return await this.unapprovePullRequest(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string
            );
          case "declinePullRequest":
            return await this.declinePullRequest(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string,
              args.message as string
            );
          case "mergePullRequest":
            return await this.mergePullRequest(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string,
              args.message as string,
              args.strategy as "merge-commit" | "squash" | "fast-forward"
            );
          case "getPullRequestComments":
            return await this.getPullRequestComments(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string,
              args.pagelen as number,
              args.page as number,
              args.all as boolean
            );
          case "getPullRequestDiff":
            return await this.getPullRequestDiff(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string
            );
          case "getPullRequestCommits":
            return await this.getPullRequestCommits(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string,
              args.pagelen as number,
              args.page as number,
              args.all as boolean
            );
          case "addPullRequestComment":
            return await this.addPullRequestComment(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string,
              args.content as string,
              args.inline as InlineCommentInline,
              args.pending as boolean
            );
          case "addPendingPullRequestComment":
            return await this.addPendingPullRequestComment(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string,
              args.content as string,
              args.inline as InlineCommentInline
            );
          case "publishPendingComments":
            return await this.publishPendingComments(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string
            );
          case "getRepositoryBranchingModel":
            return await this.getRepositoryBranchingModel(
              args.workspace as string,
              args.repo_slug as string
            );
          case "getRepositoryBranchingModelSettings":
            return await this.getRepositoryBranchingModelSettings(
              args.workspace as string,
              args.repo_slug as string
            );
          case "updateRepositoryBranchingModelSettings":
            return await this.updateRepositoryBranchingModelSettings(
              args.workspace as string,
              args.repo_slug as string,
              args.development as Record<string, any>,
              args.production as Record<string, any>,
              args.branch_types as Array<Record<string, any>>
            );
          case "getEffectiveRepositoryBranchingModel":
            return await this.getEffectiveRepositoryBranchingModel(
              args.workspace as string,
              args.repo_slug as string
            );
          case "getProjectBranchingModel":
            return await this.getProjectBranchingModel(
              args.workspace as string,
              args.project_key as string
            );
          case "getProjectBranchingModelSettings":
            return await this.getProjectBranchingModelSettings(
              args.workspace as string,
              args.project_key as string
            );
          case "updateProjectBranchingModelSettings":
            return await this.updateProjectBranchingModelSettings(
              args.workspace as string,
              args.project_key as string,
              args.development as Record<string, any>,
              args.production as Record<string, any>,
              args.branch_types as Array<Record<string, any>>
            );
          case "createDraftPullRequest":
            return await this.createDraftPullRequest(
              args.workspace as string,
              args.repo_slug as string,
              args.title as string,
              args.description as string,
              args.sourceBranch as string,
              args.targetBranch as string,
              args.reviewers as string[]
            );
          case "publishDraftPullRequest":
            return await this.publishDraftPullRequest(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string
            );
          case "convertTodraft":
            return await this.convertTodraft(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string
            );
          case "getPendingReviewPRs":
            return await this.getPendingReviewPRs(
              args.workspace as string | undefined,
              args.limit as number,
              args.repositoryList as string[]
            );
          case "listPipelineRuns":
            return await this.listPipelineRuns(
              args.workspace as string,
              args.repo_slug as string,
              args.pagelen as number,
              args.page as number,
              args.all as boolean,
              args.status as
                | "PENDING"
                | "IN_PROGRESS"
                | "SUCCESSFUL"
                | "FAILED"
                | "ERROR"
                | "STOPPED",
              args.target_branch as string,
              args.trigger_type as
                | "manual"
                | "push"
                | "pullrequest"
                | "schedule",
              args.limit as number
            );
          case "getPipelineRun":
            return await this.getPipelineRun(
              args.workspace as string,
              args.repo_slug as string,
              args.pipeline_uuid as string
            );
          case "runPipeline":
            return await this.runPipeline(
              args.workspace as string,
              args.repo_slug as string,
              args.target as any,
              args.variables as any[]
            );
          case "stopPipeline":
            return await this.stopPipeline(
              args.workspace as string,
              args.repo_slug as string,
              args.pipeline_uuid as string
            );
          case "getPipelineSteps":
            return await this.getPipelineSteps(
              args.workspace as string,
              args.repo_slug as string,
              args.pipeline_uuid as string,
              args.pagelen as number,
              args.page as number,
              args.all as boolean
            );
          case "getPipelineStep":
            return await this.getPipelineStep(
              args.workspace as string,
              args.repo_slug as string,
              args.pipeline_uuid as string,
              args.step_uuid as string
            );
          case "getPipelineStepLogs":
            return await this.getPipelineStepLogs(
              args.workspace as string,
              args.repo_slug as string,
              args.pipeline_uuid as string,
              args.step_uuid as string,
              args.max_lines as number | undefined,
              args.tail as boolean | undefined,
              args.errors_only as boolean | undefined,
              args.search_term as string | undefined,
              args.save_to_file as boolean | undefined
            );
          case "getPullRequestComment":
            return await this.getPullRequestComment(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string,
              args.comment_id as string
            );
          case "updatePullRequestComment":
            return await this.updatePullRequestComment(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string,
              args.comment_id as string,
              args.content as string
            );
          case "deletePullRequestComment":
            return await this.deletePullRequestComment(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string,
              args.comment_id as string
            );
          case "resolveComment":
            return await this.setCommentResolved(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string,
              args.comment_id as string,
              true
            );
          case "reopenComment":
            return await this.setCommentResolved(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string,
              args.comment_id as string,
              false
            );
          case "getPullRequestDiffStat":
            return await this.getPullRequestDiffStat(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string,
              args.pagelen as number,
              args.page as number,
              args.all as boolean
            );
          case "getPullRequestPatch":
            return await this.getPullRequestPatch(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string
            );
          case "getPullRequestTasks":
            return await this.getPullRequestTasks(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string,
              args.pagelen as number,
              args.page as number,
              args.all as boolean
            );
          case "createPullRequestTask":
            return await this.createPullRequestTask(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string,
              args.content as string,
              args.comment as number,
              args.state as "OPEN" | "RESOLVED"
            );
          case "getPullRequestTask":
            return await this.getPullRequestTask(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string,
              args.task_id as string
            );
          case "updatePullRequestTask":
            return await this.updatePullRequestTask(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string,
              args.task_id as string,
              args.content as string | undefined,
              args.state as ("OPEN" | "RESOLVED") | undefined
            );
          case "deletePullRequestTask":
            return await this.deletePullRequestTask(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string,
              args.task_id as string
            );
          case "getPullRequestStatuses":
            return await this.getPullRequestStatuses(
              args.workspace as string,
              args.repo_slug as string,
              args.pull_request_id as string,
              args.pagelen as number,
              args.page as number,
              args.all as boolean
            );
          case "getEffectiveDefaultReviewers":
            return await this.getEffectiveDefaultReviewers(
              args.workspace as string,
              args.repo_slug as string
            );
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        logger.error("Tool execution error", { error });
        if (axios.isAxiosError(error)) {
          throw new McpError(
            ErrorCode.InternalError,
            `Bitbucket API error: ${
              error.response?.data.message ?? error.message
            }`
          );
        }
        throw error;
      }
    });
  }

  async listRepositories(
    workspace?: string,
    pagelen?: number,
    page?: number,
    all?: boolean,
    name?: string,
    legacyLimit?: number
  ) {
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
        pagelen: pagelen ?? legacyLimit,
        page,
        all,
        name,
      });

      const params: Record<string, any> = {};
      if (name) {
        params.q = `name~"${name}"`;
      }

      const repositories = await this.paginator.fetchValues<BitbucketRepository>(
        `/repositories/${wsName}`,
        {
          pagelen: pagelen ?? legacyLimit,
          page,
          all,
          params,
          description: "listRepositories",
        }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(repositories.values, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Error listing repositories", { error, workspace, name });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list repositories: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async getRepository(workspace: string, repo_slug: string) {
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
      logger.error("Error getting repository", { error, workspace, repo_slug });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get repository: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async getEffectiveDefaultReviewers(workspace: string, repo_slug: string) {
    try {
      logger.info("Getting effective default reviewers", {
        workspace,
        repo_slug,
      });

      const response = await this.api.get(
        `/repositories/${workspace}/${repo_slug}/effective-default-reviewers`
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
      logger.error("Error getting effective default reviewers", {
        error,
        workspace,
        repo_slug,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get effective default reviewers: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async getPullRequests(
    workspace: string,
    repo_slug: string,
    state?: "OPEN" | "MERGED" | "DECLINED" | "SUPERSEDED",
    pagelen?: number,
    page?: number,
    all?: boolean,
    legacyLimit?: number
  ) {
    try {
      logger.info("Getting Bitbucket pull requests", {
        workspace,
        repo_slug,
        state,
        pagelen: pagelen ?? legacyLimit,
        page,
        all,
      });

      const params: Record<string, any> = {};
      if (state) {
        params.state = state;
      }

      const result = await this.paginator.fetchValues<BitbucketPullRequest>(
        `/repositories/${workspace}/${repo_slug}/pullrequests`,
        {
          pagelen: pagelen ?? legacyLimit,
          page,
          all,
          params,
          description: "getPullRequests",
        }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.values, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Error getting pull requests", {
        error,
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
    reviewers?: string[],
    draft?: boolean
  ) {
    try {
      logger.info("Creating Bitbucket pull request", {
        workspace,
        repo_slug,
        title,
        sourceBranch,
        targetBranch,
      });

      // Prepare reviewers format if provided
      // Bitbucket API expects reviewers as array of objects: [{uuid: "{...}"}]
      // Input is string array of UUIDs: ["{04776764-62c7-453b-b97e-302f60395ceb}", ...]
      // Convert to API format: [{uuid: "{...}"}, ...]
      let reviewersArray: Array<{ uuid: string }> | undefined;

      if (reviewers && reviewers.length > 0) {
        reviewersArray = reviewers
          .filter((uuid) => typeof uuid === "string" && uuid.trim().length > 0)
          .map((uuid) => ({ uuid: uuid.trim() }));

        if (reviewersArray.length === 0) {
          reviewersArray = undefined;
        }
      }

      // Build request payload - only include reviewers if provided
      const requestPayload: Record<string, any> = {
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
        close_source_branch: true,
      };

      // Only include reviewers field if there are reviewers to add
      if (reviewersArray && reviewersArray.length > 0) {
        requestPayload.reviewers = reviewersArray;
      }

      // Only include draft field if explicitly set to true
      if (draft === true) {
        requestPayload.draft = true;
      }

      // Create the pull request
      const response = await this.api.post(
        `/repositories/${workspace}/${repo_slug}/pullrequests`,
        requestPayload
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
        error,
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
  ) {
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
        error,
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
  ) {
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
        error,
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
    pull_request_id: string,
    pagelen?: number,
    page?: number,
    all?: boolean
  ) {
    try {
      logger.info("Getting Bitbucket pull request activity", {
        workspace,
        repo_slug,
        pull_request_id,
        pagelen,
        page,
        all,
      });

      const result = await this.paginator.fetchValues(
        `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}/activity`,
        {
          pagelen,
          page,
          all,
          description: "getPullRequestActivity",
        }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.values, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Error getting pull request activity", {
        error,
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
  ) {
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
        error,
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
  ) {
    try {
      logger.info("Unapproving Bitbucket pull request", {
        workspace,
        repo_slug,
        pull_request_id,
      });

      const response = await this.api.delete(
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
        error,
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
  ) {
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
        error,
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
  ) {
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
        error,
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
    pull_request_id: string,
    pagelen?: number,
    page?: number,
    all?: boolean
  ) {
    try {
      logger.info("Getting Bitbucket pull request comments", {
        workspace,
        repo_slug,
        pull_request_id,
        pagelen,
        page,
        all,
      });

      const result = await this.paginator.fetchValues(
        `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}/comments`,
        {
          pagelen,
          page,
          all,
          description: "getPullRequestComments",
        }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.values, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Error getting pull request comments", {
        error,
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
  ) {
    try {
      logger.info("Getting Bitbucket pull request diff", {
        workspace,
        repo_slug,
        pull_request_id,
      });

      // First get the pull request details to extract commit information
      const prResponse = await this.api.get(
        `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}`
      );

      const sourceCommit = prResponse.data.source.commit.hash;
      const destinationCommit = prResponse.data.destination.commit.hash;

      // Construct the correct diff URL with the proper format
      // The format is: /repositories/{workspace}/{repo_slug}/diff/{source_repo}:{source_commit}%0D{destination_commit}?from_pullrequest_id={pr_id}&topic=true
      const diffUrl = `/repositories/${workspace}/${repo_slug}/diff/${workspace}/${repo_slug}:${sourceCommit}%0D${destinationCommit}?from_pullrequest_id=${pull_request_id}&topic=true`;

      const response = await this.api.get(diffUrl, {
        headers: {
          Accept: "text/plain",
        },
        responseType: "text",
        maxRedirects: 5, // Enable redirect following
      });

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
        error,
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
    pull_request_id: string,
    pagelen?: number,
    page?: number,
    all?: boolean
  ) {
    try {
      logger.info("Getting Bitbucket pull request commits", {
        workspace,
        repo_slug,
        pull_request_id,
        pagelen,
        page,
        all,
      });

      const result = await this.paginator.fetchValues(
        `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}/commits`,
        {
          pagelen,
          page,
          all,
          description: "getPullRequestCommits",
        }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.values, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Error getting pull request commits", {
        error,
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

  async addPullRequestComment(
    workspace: string,
    repo_slug: string,
    pull_request_id: string,
    content: string,
    inline?: InlineCommentInline,
    pending?: boolean
  ) {
    try {
      logger.info("Adding comment to Bitbucket pull request", {
        workspace,
        repo_slug,
        pull_request_id,
        inline: inline ? "inline comment" : "general comment",
      });

      // Prepare the comment data
      const commentData: any = {
        content: {
          raw: content,
        },
      };

      // Add pending flag if provided
      if (pending !== undefined) {
        commentData.pending = pending;
      }

      // Add inline information if provided
      if (inline) {
        commentData.inline = {
          path: inline.path,
        };

        // Add line number information based on the type
        if (inline.from !== undefined) {
          commentData.inline.from = inline.from;
        }
        if (inline.to !== undefined) {
          commentData.inline.to = inline.to;
        }
      }

      const response = await this.api.post(
        `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}/comments`,
        commentData
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
      logger.error("Error adding comment to pull request", {
        error,
        workspace,
        repo_slug,
        pull_request_id,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to add pull request comment: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async getRepositoryBranchingModel(workspace: string, repo_slug: string) {
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
        error,
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
  ) {
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
        error,
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
  ) {
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
        error,
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
  ) {
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
        error,
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

  async getProjectBranchingModel(workspace: string, project_key: string) {
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
        error,
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
  ) {
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
        error,
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
  ) {
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
        error,
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

  async addPendingPullRequestComment(
    workspace: string,
    repo_slug: string,
    pull_request_id: string,
    content: string,
    inline?: InlineCommentInline
  ) {
    try {
      logger.info("Adding pending comment to Bitbucket pull request", {
        workspace,
        repo_slug,
        pull_request_id,
        inline: inline ? "inline comment" : "general comment",
      });

      // Use the existing addPullRequestComment method with pending=true
      return await this.addPullRequestComment(
        workspace,
        repo_slug,
        pull_request_id,
        content,
        inline,
        true // Set pending to true for draft comment
      );
    } catch (error) {
      logger.error("Error adding pending comment to pull request", {
        error,
        workspace,
        repo_slug,
        pull_request_id,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to add pending pull request comment: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async publishPendingComments(
    workspace: string,
    repo_slug: string,
    pull_request_id: string
  ) {
    try {
      logger.info("Publishing pending comments for Bitbucket pull request", {
        workspace,
        repo_slug,
        pull_request_id,
      });

      // First, get all pending comments for the pull request
      const commentsResult = await this.paginator.fetchValues(
        `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}/comments`,
        {
          pagelen: BITBUCKET_MAX_PAGELEN,
          all: true,
          description: "publishPendingComments",
        }
      );

      type PendingComment = {
        id: number;
        content: { raw?: string; html?: string; markup?: string };
        inline?: InlineCommentInline;
        pending?: boolean;
      };

      const comments = (commentsResult.values || []) as PendingComment[];
      const pendingComments = comments.filter(
        (comment: any) => comment.pending === true
      ) as PendingComment[];

      if (pendingComments.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No pending comments found to publish.",
            },
          ],
        };
      }

      // Publish each pending comment by updating it with pending=false
      const publishResults = [];
      for (const comment of pendingComments) {
        try {
          const updateResponse = await this.api.put(
            `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}/comments/${comment.id}`,
            {
              content: comment.content,
              pending: false,
              ...(comment.inline && { inline: comment.inline }),
            }
          );
          publishResults.push({
            commentId: comment.id,
            status: "published",
            data: updateResponse.data,
          });
        } catch (error) {
          publishResults.push({
            commentId: comment.id,
            status: "error",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: `Published ${pendingComments.length} pending comments`,
                results: publishResults,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Error publishing pending comments", {
        error,
        workspace,
        repo_slug,
        pull_request_id,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to publish pending comments: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async createDraftPullRequest(
    workspace: string,
    repo_slug: string,
    title: string,
    description: string,
    sourceBranch: string,
    targetBranch: string,
    reviewers?: string[]
  ) {
    try {
      logger.info("Creating draft Bitbucket pull request", {
        workspace,
        repo_slug,
        title,
        sourceBranch,
        targetBranch,
      });

      // Use the existing createPullRequest method with draft=true
      return await this.createPullRequest(
        workspace,
        repo_slug,
        title,
        description,
        sourceBranch,
        targetBranch,
        reviewers,
        true // Set draft to true
      );
    } catch (error) {
      logger.error("Error creating draft pull request", {
        error,
        workspace,
        repo_slug,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to create draft pull request: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async publishDraftPullRequest(
    workspace: string,
    repo_slug: string,
    pull_request_id: string
  ) {
    try {
      logger.info("Publishing draft pull request", {
        workspace,
        repo_slug,
        pull_request_id,
      });

      // Update the pull request to set draft=false
      const response = await this.api.put(
        `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}`,
        {
          draft: false,
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
      logger.error("Error publishing draft pull request", {
        error,
        workspace,
        repo_slug,
        pull_request_id,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to publish draft pull request: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async convertTodraft(
    workspace: string,
    repo_slug: string,
    pull_request_id: string
  ) {
    try {
      logger.info("Converting pull request to draft", {
        workspace,
        repo_slug,
        pull_request_id,
      });

      // Update the pull request to set draft=true
      const response = await this.api.put(
        `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}`,
        {
          draft: true,
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
      logger.error("Error converting pull request to draft", {
        error,
        workspace,
        repo_slug,
        pull_request_id,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to convert pull request to draft: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async getPendingReviewPRs(
    workspace?: string,
    limit: number = 50,
    repositoryList?: string[]
  ) {
    try {
      const wsName = workspace || this.config.defaultWorkspace;
      if (!wsName) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "Workspace must be provided either as a parameter or through BITBUCKET_WORKSPACE environment variable"
        );
      }

      const currentUserNickname = this.config.username;
      if (!currentUserNickname) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "Username must be provided through BITBUCKET_USERNAME environment variable"
        );
      }

      logger.info("Getting pending review PRs", {
        workspace: wsName,
        username: currentUserNickname,
        repositoryList: repositoryList?.length || "all repositories",
        limit,
      });

      let repositoriesToCheck: string[] = [];

      if (repositoryList && repositoryList.length > 0) {
        // Use the provided repository list
        repositoriesToCheck = repositoryList;
        logger.info(
          `Checking specific repositories: ${repositoryList.join(", ")}`
        );
      } else {
        // Get all repositories in the workspace (existing behavior)
        logger.info("Getting all repositories in workspace...");
        const reposResponse = await this.paginator.fetchValues(
          `/repositories/${wsName}`,
          {
            pagelen: BITBUCKET_MAX_PAGELEN,
            all: true,
            description: "getPendingReviewPRs.repositories",
          }
        );

        if (!reposResponse.values) {
          throw new McpError(
            ErrorCode.InternalError,
            "Failed to fetch repositories"
          );
        }

        repositoriesToCheck = reposResponse.values.map((repo: any) => repo.name);
        logger.info(
          `Found ${repositoriesToCheck.length} repositories to check`
        );
      }

      const pendingPRs: any[] = [];
      const batchSize = 5; // Process repositories in batches to avoid overwhelming the API

      // Process repositories in batches
      for (let i = 0; i < repositoriesToCheck.length; i += batchSize) {
        const batch = repositoriesToCheck.slice(i, i + batchSize);

        // Process batch in parallel
        const batchPromises = batch.map(async (repoSlug) => {
          try {
            logger.info(`Checking repository: ${repoSlug}`);

            // Get open PRs for this repository with participants expanded
            const prsResponse = await this.api.get(
              `/repositories/${wsName}/${repoSlug}/pullrequests`,
              {
                params: {
                  state: "OPEN",
                  pagelen: Math.min(limit, 50), // Limit per repo to avoid too much data
                  fields:
                    "values.id,values.title,values.description,values.state,values.created_on,values.updated_on,values.author,values.source,values.destination,values.participants.user.nickname,values.participants.role,values.participants.approved,values.links",
                },
              }
            );

            if (!prsResponse.data.values) {
              return [];
            }

            // Filter PRs where current user is a reviewer and hasn't approved
            const reposPendingPRs = prsResponse.data.values.filter(
              (pr: any) => {
                if (!pr.participants || !Array.isArray(pr.participants)) {
                  logger.debug(`PR ${pr.id} has no participants array`);
                  return false;
                }

                logger.debug(
                  `PR ${pr.id} participants:`,
                  pr.participants.map((p: any) => ({
                    nickname: p.user?.nickname,
                    role: p.role,
                    approved: p.approved,
                  }))
                );

                // Check if current user is a reviewer who hasn't approved
                const userParticipant = pr.participants.find(
                  (participant: any) =>
                    participant.user?.nickname === currentUserNickname &&
                    participant.role === "REVIEWER" &&
                    participant.approved === false
                );

                logger.debug(
                  `PR ${pr.id} - User ${currentUserNickname} is pending reviewer:`,
                  !!userParticipant
                );

                return !!userParticipant;
              }
            );

            // Add repository info to each PR
            return reposPendingPRs.map((pr: any) => ({
              ...pr,
              repository: {
                name: repoSlug,
                full_name: `${wsName}/${repoSlug}`,
              },
            }));
          } catch (error) {
            logger.error(`Error checking repository ${repoSlug}:`, error);
            return [];
          }
        });

        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);

        // Flatten and add to results
        for (const repoPRs of batchResults) {
          pendingPRs.push(...repoPRs);

          // Stop if we've reached the limit
          if (pendingPRs.length >= limit) {
            break;
          }
        }

        // Stop processing if we've reached the limit
        if (pendingPRs.length >= limit) {
          break;
        }
      }

      // Trim to exact limit and sort by updated date
      const finalResults = pendingPRs
        .slice(0, limit)
        .sort(
          (a, b) =>
            new Date(b.updated_on).getTime() - new Date(a.updated_on).getTime()
        );

      logger.info(`Found ${finalResults.length} pending review PRs`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                pending_review_prs: finalResults,
                total_found: finalResults.length,
                searched_repositories: repositoriesToCheck.length,
                user: currentUserNickname,
                workspace: wsName,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Error getting pending review PRs:", error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get pending review PRs: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // =========== PIPELINE METHODS ===========

  async listPipelineRuns(
    workspace: string,
    repo_slug: string,
    pagelen?: number,
    page?: number,
    all?: boolean,
    status?:
      | "PENDING"
      | "IN_PROGRESS"
      | "SUCCESSFUL"
      | "FAILED"
      | "ERROR"
      | "STOPPED",
    target_branch?: string,
    trigger_type?: "manual" | "push" | "pullrequest" | "schedule",
    legacyLimit?: number
  ) {
    try {
      logger.info("Listing pipeline runs", {
        workspace,
        repo_slug,
        pagelen: pagelen ?? legacyLimit,
        page,
        all,
        status,
        target_branch,
        trigger_type,
      });

      const params: Record<string, any> = {};
      if (status) params.status = status;
      if (target_branch) params["target.branch"] = target_branch;
      if (trigger_type) params.trigger_type = trigger_type;

      const result = await this.paginator.fetchValues(
        `/repositories/${workspace}/${repo_slug}/pipelines`,
        {
          pagelen: pagelen ?? legacyLimit,
          page,
          all,
          params,
          description: "listPipelineRuns",
        }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.values, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Error listing pipeline runs", {
        error,
        workspace,
        repo_slug,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list pipeline runs: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async getPipelineRun(
    workspace: string,
    repo_slug: string,
    pipeline_uuid: string
  ) {
    try {
      logger.info("Getting pipeline run details", {
        workspace,
        repo_slug,
        pipeline_uuid,
      });

      const response = await this.api.get(
        `/repositories/${workspace}/${repo_slug}/pipelines/${pipeline_uuid}`
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
      logger.error("Error getting pipeline run", {
        error,
        workspace,
        repo_slug,
        pipeline_uuid,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get pipeline run: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async runPipeline(
    workspace: string,
    repo_slug: string,
    target: any,
    variables?: any[]
  ) {
    try {
      logger.info("Triggering pipeline run", {
        workspace,
        repo_slug,
        target,
        variables: variables?.length || 0,
      });

      // Build the target object based on the input
      const pipelineTarget: Record<string, any> = {
        type: target.commit_hash
          ? "pipeline_commit_target"
          : "pipeline_ref_target",
        ref_type: target.ref_type,
        ref_name: target.ref_name,
      };

      // Add commit if specified
      if (target.commit_hash) {
        pipelineTarget.commit = {
          type: "commit",
          hash: target.commit_hash,
        };
      }

      // Add selector if specified
      if (target.selector_type && target.selector_pattern) {
        pipelineTarget.selector = {
          type: target.selector_type,
          pattern: target.selector_pattern,
        };
      }

      // Build the request data
      const requestData: Record<string, any> = {
        target: pipelineTarget,
      };

      // Add variables if provided
      if (variables && variables.length > 0) {
        requestData.variables = variables.map((variable: any) => ({
          key: variable.key,
          value: variable.value,
          secured: variable.secured || false,
        }));
      }

      const response = await this.api.post(
        `/repositories/${workspace}/${repo_slug}/pipelines`,
        requestData
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
      logger.error("Error running pipeline", {
        error,
        workspace,
        repo_slug,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to run pipeline: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async stopPipeline(
    workspace: string,
    repo_slug: string,
    pipeline_uuid: string
  ) {
    try {
      logger.info("Stopping pipeline", {
        workspace,
        repo_slug,
        pipeline_uuid,
      });

      const response = await this.api.post(
        `/repositories/${workspace}/${repo_slug}/pipelines/${pipeline_uuid}/stop`
      );

      return {
        content: [
          {
            type: "text",
            text: "Pipeline stop signal sent successfully.",
          },
        ],
      };
    } catch (error) {
      logger.error("Error stopping pipeline", {
        error,
        workspace,
        repo_slug,
        pipeline_uuid,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to stop pipeline: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async getPipelineSteps(
    workspace: string,
    repo_slug: string,
    pipeline_uuid: string,
    pagelen?: number,
    page?: number,
    all?: boolean
  ) {
    try {
      logger.info("Getting pipeline steps", {
        workspace,
        repo_slug,
        pipeline_uuid,
        pagelen,
        page,
        all,
      });

      const result = await this.paginator.fetchValues(
        `/repositories/${workspace}/${repo_slug}/pipelines/${pipeline_uuid}/steps`,
        {
          pagelen,
          page,
          all,
          description: "getPipelineSteps",
        }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.values, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Error getting pipeline steps", {
        error,
        workspace,
        repo_slug,
        pipeline_uuid,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get pipeline steps: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async getPipelineStep(
    workspace: string,
    repo_slug: string,
    pipeline_uuid: string,
    step_uuid: string
  ) {
    try {
      logger.info("Getting pipeline step details", {
        workspace,
        repo_slug,
        pipeline_uuid,
        step_uuid,
      });

      const response = await this.api.get(
        `/repositories/${workspace}/${repo_slug}/pipelines/${pipeline_uuid}/steps/${step_uuid}`
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
      logger.error("Error getting pipeline step", {
        error,
        workspace,
        repo_slug,
        pipeline_uuid,
        step_uuid,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get pipeline step: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async getPipelineStepLogs(
    workspace: string,
    repo_slug: string,
    pipeline_uuid: string,
    step_uuid: string,
    maxLines?: number,
    tail?: boolean,
    errorsOnly?: boolean,
    searchTerm?: string,
    saveToFile?: boolean
  ) {
    try {
      logger.info("Getting pipeline step logs", {
        workspace,
        repo_slug,
        pipeline_uuid,
        step_uuid,
        maxLines,
        tail,
        errorsOnly,
        searchTerm,
        saveToFile,
      });

      const response = await this.api.get(
        `/repositories/${workspace}/${repo_slug}/pipelines/${pipeline_uuid}/steps/${step_uuid}/log`,
        {
          maxRedirects: 5, // Follow redirects to S3
          responseType: "text",
        }
      );

      const rawLog =
        typeof response.data === "string"
          ? response.data
          : response.data === undefined || response.data === null
          ? ""
          : String(response.data);
      const allLines = rawLog.length > 0 ? rawLog.split(/\r?\n/) : [];
      const totalLines = allLines.length;

      let filteredLines = allLines;
      const normalizedSearch = searchTerm?.trim().toLowerCase();
      if (errorsOnly) {
        const errorRegex = /(error|failed|failure|exception|traceback|fatal)/i;
        filteredLines = filteredLines.filter((line) => errorRegex.test(line));
      }
      if (normalizedSearch && normalizedSearch.length > 0) {
        filteredLines = filteredLines.filter((line) =>
          line.toLowerCase().includes(normalizedSearch)
        );
      }

      const defaultMaxLines = 500;
      const normalizedMaxLines =
        typeof maxLines === "number" && Number.isFinite(maxLines)
          ? Math.floor(maxLines)
          : defaultMaxLines;
      const resolvedMaxLines = Math.max(1, Math.min(normalizedMaxLines, 5000));

      const hasLines = filteredLines.length > 0;
      const limitedLines = hasLines
        ? tail
          ? filteredLines.slice(-resolvedMaxLines)
          : filteredLines.slice(0, resolvedMaxLines)
        : [];
      const wasTruncated =
        hasLines && filteredLines.length > limitedLines.length;

      const summaryParts: string[] = [`Total log lines: ${totalLines}.`];
      if (errorsOnly || (normalizedSearch && normalizedSearch.length > 0)) {
        summaryParts.push(`Lines after filtering: ${filteredLines.length}.`);
      }
      if (!hasLines) {
        summaryParts.push("No log lines matched the provided filters.");
      } else {
        summaryParts.push(
          `Showing ${limitedLines.length} ${
            tail ? "most recent" : "earliest"
          } lines${
            wasTruncated ? ` (limited to ${resolvedMaxLines} lines)` : ""
          }.`
        );
      }

      if (saveToFile) {
        try {
          const tempDir = fs.mkdtempSync(
            path.join(os.tmpdir(), "bitbucket-mcp-")
          );
          const safeFileName =
            `pipeline-${pipeline_uuid}-step-${step_uuid}.log`.replace(
              /[^a-zA-Z0-9._-]/g,
              "_"
            );
          const filePath = path.join(tempDir, safeFileName);
          fs.writeFileSync(filePath, rawLog, "utf8");
          summaryParts.push(`Full log saved to: ${filePath}`);
        } catch (fileError) {
          logger.warn("Failed to save pipeline step log to file", {
            error: fileError,
          });
          summaryParts.push(
            "Attempted to save the full log to a temporary file, but writing failed."
          );
        }
      }

      if (!saveToFile && wasTruncated) {
        summaryParts.push(
          "Use max_lines, tail, search_term, or save_to_file to refine or download the full log."
        );
      }

      const summary = summaryParts.join(" ");

      const textContent = hasLines
        ? `${summary}\n\n${limitedLines.join("\n")}`
        : summary;

      return {
        content: [
          {
            type: "text",
            text: textContent,
          },
        ],
      };
    } catch (error) {
      logger.error("Error getting pipeline step logs", {
        error,
        workspace,
        repo_slug,
        pipeline_uuid,
        step_uuid,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get pipeline step logs: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async getPullRequestComment(
    workspace: string,
    repo_slug: string,
    pull_request_id: string,
    comment_id: string
  ) {
    try {
      logger.info("Getting pull request comment", {
        workspace,
        repo_slug,
        pull_request_id,
        comment_id,
      });

      const response = await this.api.get(
        `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}/comments/${comment_id}`
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
      logger.error("Error getting pull request comment", {
        error,
        workspace,
        repo_slug,
        pull_request_id,
        comment_id,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get pull request comment: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async updatePullRequestComment(
    workspace: string,
    repo_slug: string,
    pull_request_id: string,
    comment_id: string,
    content: string
  ) {
    try {
      logger.info("Updating pull request comment", {
        workspace,
        repo_slug,
        pull_request_id,
        comment_id,
      });

      const response = await this.api.put(
        `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}/comments/${comment_id}`,
        {
          content: { raw: content },
        }
      );

      return {
        content: [
          { type: "text", text: JSON.stringify(response.data, null, 2) },
        ],
      };
    } catch (error) {
      logger.error("Error updating pull request comment", {
        error,
        workspace,
        repo_slug,
        pull_request_id,
        comment_id,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to update pull request comment: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async deletePullRequestComment(
    workspace: string,
    repo_slug: string,
    pull_request_id: string,
    comment_id: string
  ) {
    try {
      logger.info("Deleting pull request comment", {
        workspace,
        repo_slug,
        pull_request_id,
        comment_id,
      });

      await this.api.delete(
        `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}/comments/${comment_id}`
      );

      return {
        content: [{ type: "text", text: "Comment deleted successfully." }],
      };
    } catch (error) {
      logger.error("Error deleting pull request comment", {
        error,
        workspace,
        repo_slug,
        pull_request_id,
        comment_id,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to delete pull request comment: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async setCommentResolved(
    workspace: string,
    repo_slug: string,
    pull_request_id: string,
    comment_id: string,
    resolved: boolean
  ) {
    try {
      logger.info("Setting comment resolved state", {
        workspace,
        repo_slug,
        pull_request_id,
        comment_id,
        resolved,
      });

      const commentUrl = (id: string) =>
        `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}/comments/${id}`;
      const resolveUrl = (id: string) => `${commentUrl(id)}/resolve`;

      // Bitbucket resolves comment *threads*, and the API expects the thread root comment ID.
      // If the provided comment_id is a reply, walk up the parent chain to find the root.
      let targetCommentId = comment_id;
      try {
        const visited = new Set<string>();
        for (let depth = 0; depth < 25; depth++) {
          if (visited.has(targetCommentId)) break;
          visited.add(targetCommentId);

          const commentResponse = await this.api.get(
            commentUrl(targetCommentId)
          );
          const parentId = commentResponse.data?.parent?.id;
          if (parentId === undefined || parentId === null) break;
          targetCommentId = String(parentId);
        }
      } catch (lookupError) {
        // If we fail to look up the comment hierarchy, still attempt to resolve the provided ID.
        logger.warn(
          "Failed to resolve comment thread root; falling back to comment_id",
          {
            error: lookupError,
            workspace,
            repo_slug,
            pull_request_id,
            comment_id,
          }
        );
        targetCommentId = comment_id;
      }

      const response = resolved
        ? await this.api.post(resolveUrl(targetCommentId), {})
        : await this.api.delete(resolveUrl(targetCommentId));

      const responseText =
        response.data === undefined ||
        response.data === null ||
        response.data === ""
          ? resolved
            ? `Comment thread resolved (comment_id: ${targetCommentId}).`
            : `Comment thread reopened (comment_id: ${targetCommentId}).`
          : JSON.stringify(response.data, null, 2);

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
      };
    } catch (error) {
      logger.error("Error setting comment resolved state", {
        error,
        workspace,
        repo_slug,
        pull_request_id,
        comment_id,
        resolved,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to update comment resolved state: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async getPullRequestDiffStat(
    workspace: string,
    repo_slug: string,
    pull_request_id: string,
    pagelen?: number,
    page?: number,
    all?: boolean
  ) {
    try {
      logger.info("Getting pull request diffstat", {
        workspace,
        repo_slug,
        pull_request_id,
        pagelen,
        page,
        all,
      });

      const result = await this.paginator.fetchValues(
        `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}/diffstat`,
        {
          pagelen,
          page,
          all,
          description: "getPullRequestDiffStat",
        }
      );

      return {
        content: [
          { type: "text", text: JSON.stringify(result.values, null, 2) },
        ],
      };
    } catch (error) {
      logger.error("Error getting pull request diffstat", {
        error,
        workspace,
        repo_slug,
        pull_request_id,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get pull request diffstat: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async getPullRequestPatch(
    workspace: string,
    repo_slug: string,
    pull_request_id: string
  ) {
    try {
      logger.info("Getting pull request patch", {
        workspace,
        repo_slug,
        pull_request_id,
      });

      const response = await this.api.get(
        `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}/patch`,
        {
          headers: { Accept: "text/plain" },
          responseType: "text",
          maxRedirects: 5,
        }
      );

      return { content: [{ type: "text", text: response.data }] };
    } catch (error) {
      logger.error("Error getting pull request patch", {
        error,
        workspace,
        repo_slug,
        pull_request_id,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get pull request patch: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async getPullRequestTasks(
    workspace: string,
    repo_slug: string,
    pull_request_id: string,
    pagelen?: number,
    page?: number,
    all?: boolean
  ) {
    try {
      logger.info("Getting pull request tasks", {
        workspace,
        repo_slug,
        pull_request_id,
        pagelen,
        page,
        all,
      });

      const result = await this.paginator.fetchValues(
        `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}/tasks`,
        {
          pagelen,
          page,
          all,
          description: "getPullRequestTasks",
        }
      );

      return {
        content: [
          { type: "text", text: JSON.stringify(result.values, null, 2) },
        ],
      };
    } catch (error) {
      logger.error("Error getting pull request tasks", {
        error,
        workspace,
        repo_slug,
        pull_request_id,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get pull request tasks: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async createPullRequestTask(
    workspace: string,
    repo_slug: string,
    pull_request_id: string,
    content: string,
    commentId?: number,
    state?: "OPEN" | "RESOLVED"
  ) {
    try {
      logger.info("Creating pull request task", {
        workspace,
        repo_slug,
        pull_request_id,
      });

      const data: Record<string, any> = { content };
      if (commentId) data.comment = { id: commentId };
      if (state) data.state = state;

      const response = await this.api.post(
        `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}/tasks`,
        data
      );

      return {
        content: [
          { type: "text", text: JSON.stringify(response.data, null, 2) },
        ],
      };
    } catch (error) {
      logger.error("Error creating pull request task", {
        error,
        workspace,
        repo_slug,
        pull_request_id,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to create pull request task: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async getPullRequestTask(
    workspace: string,
    repo_slug: string,
    pull_request_id: string,
    task_id: string
  ) {
    try {
      logger.info("Getting pull request task", {
        workspace,
        repo_slug,
        pull_request_id,
        task_id,
      });

      const response = await this.api.get(`/tasks/${task_id}`);

      return {
        content: [
          { type: "text", text: JSON.stringify(response.data, null, 2) },
        ],
      };
    } catch (error) {
      logger.error("Error getting pull request task", {
        error,
        workspace,
        repo_slug,
        pull_request_id,
        task_id,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get pull request task: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async updatePullRequestTask(
    workspace: string,
    repo_slug: string,
    pull_request_id: string,
    task_id: string,
    content?: string,
    state?: "OPEN" | "RESOLVED"
  ) {
    try {
      logger.info("Updating pull request task", {
        workspace,
        repo_slug,
        pull_request_id,
        task_id,
      });

      const data: Record<string, any> = {};
      if (content !== undefined) data.content = content;
      if (state !== undefined) data.state = state;

      const response = await this.api.put(`/tasks/${task_id}`, data);

      return {
        content: [
          { type: "text", text: JSON.stringify(response.data, null, 2) },
        ],
      };
    } catch (error) {
      logger.error("Error updating pull request task", {
        error,
        workspace,
        repo_slug,
        pull_request_id,
        task_id,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to update pull request task: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async deletePullRequestTask(
    workspace: string,
    repo_slug: string,
    pull_request_id: string,
    task_id: string
  ) {
    try {
      logger.info("Deleting pull request task", {
        workspace,
        repo_slug,
        pull_request_id,
        task_id,
      });

      await this.api.delete(`/tasks/${task_id}`);

      return {
        content: [{ type: "text", text: "Task deleted successfully." }],
      };
    } catch (error) {
      logger.error("Error deleting pull request task", {
        error,
        workspace,
        repo_slug,
        pull_request_id,
        task_id,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to delete pull request task: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async getPullRequestStatuses(
    workspace: string,
    repo_slug: string,
    pull_request_id: string,
    pagelen?: number,
    page?: number,
    all?: boolean
  ) {
    try {
      logger.info("Getting pull request statuses", {
        workspace,
        repo_slug,
        pull_request_id,
        pagelen,
        page,
        all,
      });

      const result = await this.paginator.fetchValues(
        `/repositories/${workspace}/${repo_slug}/pullrequests/${pull_request_id}/statuses`,
        {
          pagelen,
          page,
          all,
          description: "getPullRequestStatuses",
        }
      );

      const payload = {
        values: result.values,
        page: result.page,
        pagelen: result.pagelen,
        next: result.next,
        previous: result.previous,
        fetchedPages: result.fetchedPages,
        totalFetched: result.totalFetched,
      };

      return {
        content: [
          { type: "text", text: JSON.stringify(payload, null, 2) },
        ],
      };
    } catch (error) {
      logger.error("Error getting pull request statuses", {
        error,
        workspace,
        repo_slug,
        pull_request_id,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get pull request statuses: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
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
