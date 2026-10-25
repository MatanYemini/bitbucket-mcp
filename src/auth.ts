import axios from "axios";
import fs from "fs";
import os from "os";
import path from "path";
import readline from "readline";
import { Writable } from "stream";

export const DEFAULT_BITBUCKET_URL = "https://api.bitbucket.org/2.0";

/**
 * Credentials persisted by `bitbucket-mcp auth login`.
 * Keys mirror the BITBUCKET_* environment variables they stand in for.
 */
export interface StoredCredentials {
  url?: string;
  workspace?: string;
  username?: string;
  password?: string;
  token?: string;
}

const ENV_KEYS: Record<keyof StoredCredentials, string> = {
  url: "BITBUCKET_URL",
  workspace: "BITBUCKET_WORKSPACE",
  username: "BITBUCKET_USERNAME",
  password: "BITBUCKET_PASSWORD",
  token: "BITBUCKET_TOKEN",
};

// Resolve the config directory per OS (override with BITBUCKET_CONFIG_DIR)
export function getConfigDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.BITBUCKET_CONFIG_DIR && env.BITBUCKET_CONFIG_DIR.trim()) {
    return env.BITBUCKET_CONFIG_DIR;
  }
  if (process.platform === "win32") {
    const appData =
      env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, "bitbucket-mcp");
  }
  const xdgConfigHome =
    env.XDG_CONFIG_HOME && env.XDG_CONFIG_HOME.trim()
      ? env.XDG_CONFIG_HOME
      : path.join(os.homedir(), ".config");
  return path.join(xdgConfigHome, "bitbucket-mcp");
}

export function getCredentialsPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(getConfigDir(env), "credentials.json");
}

export function loadStoredCredentials(
  env: NodeJS.ProcessEnv = process.env
): StoredCredentials | undefined {
  const file = getCredentialsPath(env);
  if (!fs.existsSync(file)) return undefined;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!parsed || typeof parsed !== "object") return undefined;
    const creds: StoredCredentials = {};
    for (const key of Object.keys(ENV_KEYS) as (keyof StoredCredentials)[]) {
      if (typeof parsed[key] === "string" && parsed[key]) {
        creds[key] = parsed[key];
      }
    }
    return creds;
  } catch {
    return undefined;
  }
}

export function saveCredentials(
  creds: StoredCredentials,
  env: NodeJS.ProcessEnv = process.env
): string {
  const dir = getConfigDir(env);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = getCredentialsPath(env);
  fs.writeFileSync(file, JSON.stringify(creds, null, 2) + "\n", {
    mode: 0o600,
  });
  // writeFileSync keeps the mode of an existing file, so tighten explicitly
  fs.chmodSync(file, 0o600);
  return file;
}

export function removeCredentials(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const file = getCredentialsPath(env);
  if (!fs.existsSync(file)) return false;
  fs.unlinkSync(file);
  return true;
}

/**
 * Fill unset BITBUCKET_* variables from stored credentials.
 * Explicit environment variables (and .env) always take precedence, and a
 * stored token is only used when no basic-auth pair is configured (and vice versa)
 * so mixed sources never produce a half-configured auth method.
 */
export function applyStoredCredentials(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const creds = loadStoredCredentials(env);
  if (!creds) return false;

  const envHasAuth =
    !!env.BITBUCKET_TOKEN || !!(env.BITBUCKET_USERNAME && env.BITBUCKET_PASSWORD);

  let applied = false;
  for (const key of Object.keys(ENV_KEYS) as (keyof StoredCredentials)[]) {
    const isAuthKey = key === "token" || key === "username" || key === "password";
    if (isAuthKey && envHasAuth) continue;
    const envKey = ENV_KEYS[key];
    if (!env[envKey] && creds[key]) {
      env[envKey] = creds[key];
      applied = true;
    }
  }
  return applied;
}

function mask(value: string | undefined): string {
  if (!value) return "(not set)";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

type Ask = (question: string, opts?: { defaultValue?: string; hidden?: boolean }) => Promise<string>;

// One readline session for all prompts; secrets are typed with echo muted
function createPrompter(): { ask: Ask; close: () => void } {
  let muted = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  const rl = readline.createInterface({
    input: process.stdin,
    output,
    terminal: !!process.stdin.isTTY,
  });

  // Buffer lines so piped (non-TTY) input isn't lost between prompts
  const lines: string[] = [];
  const waiters: ((line: string | undefined) => void)[] = [];
  let closed = false;
  rl.on("line", (line) => {
    const waiter = waiters.shift();
    if (waiter) waiter(line);
    else lines.push(line);
  });
  rl.on("close", () => {
    closed = true;
    while (waiters.length) waiters.shift()!(undefined);
  });
  rl.on("SIGINT", () => {
    rl.close();
    process.stdout.write("\n");
    process.exit(130);
  });

  const ask: Ask = async (question, opts = {}) => {
    const suffix = opts.defaultValue ? ` [${opts.defaultValue}]` : "";
    process.stdout.write(`${question}${suffix}: `);
    muted = !!opts.hidden;
    const line = lines.length
      ? lines.shift()
      : closed
        ? undefined
        : await new Promise<string | undefined>((resolve) => waiters.push(resolve));
    muted = false;
    if (opts.hidden || !process.stdin.isTTY) process.stdout.write("\n");
    return (line ?? "").trim() || opts.defaultValue || "";
  };

  return { ask, close: () => rl.close() };
}

function parseFlags(args: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) continue;
    const [name, inline] = arg.slice(2).split("=", 2);
    if (inline !== undefined) {
      flags[name] = inline;
    } else if (args[i + 1] && !args[i + 1].startsWith("--")) {
      flags[name] = args[++i];
    } else {
      flags[name] = true;
    }
  }
  return flags;
}

function isBitbucketCloud(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase() === "api.bitbucket.org";
  } catch {
    return false;
  }
}

/**
 * Check credentials against Bitbucket Cloud. Returns undefined on success,
 * or a human-readable reason on failure.
 */
export async function verifyCredentials(
  creds: StoredCredentials
): Promise<string | undefined> {
  const baseURL = (creds.url || DEFAULT_BITBUCKET_URL).replace(/\/+$/, "");
  // Workspace/repository access tokens cannot read /user, so prefer the workspace
  const endpoint = creds.workspace
    ? `/repositories/${encodeURIComponent(creds.workspace)}?pagelen=1`
    : "/user";
  try {
    await axios.get(endpoint, {
      baseURL,
      timeout: 15000,
      headers: creds.token ? { Authorization: `Bearer ${creds.token}` } : {},
      auth:
        !creds.token && creds.username && creds.password
          ? { username: creds.username, password: creds.password }
          : undefined,
    });
    return undefined;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      if (status === 401) return "HTTP 401: credentials were rejected";
      if (status === 403) return "HTTP 403: credentials lack the required scopes";
      if (status === 404) return "HTTP 404: workspace not found";
      return `HTTP ${status}`;
    }
    return error instanceof Error ? error.message : String(error);
  }
}

const USAGE = `Usage: bitbucket-mcp auth <command> [options]

Commands:
  login    Prompt for credentials, verify them and save them locally
  status   Show where credentials are stored and which are in use
  logout   Delete stored credentials

Login prompts for workspace, Atlassian email and API token / app password.
Options (skip the matching prompt):
  --workspace <slug>     Bitbucket workspace
  --username <email>     Atlassian account email
  --password <secret>    API token / app password
  --token <secret>       Access token (Bearer auth) instead of email + password
  --url <url>            API base URL for self-hosted (default: ${DEFAULT_BITBUCKET_URL})
  --no-verify            Save without checking against Bitbucket
`;

async function login(flags: Record<string, string | boolean>): Promise<number> {
  const existing = loadStoredCredentials() ?? {};
  const prompter = createPrompter();
  try {
    return await loginWith(flags, existing, prompter.ask);
  } finally {
    prompter.close();
  }
}

async function loginWith(
  flags: Record<string, string | boolean>,
  existing: StoredCredentials,
  ask: Ask
): Promise<number> {
  const str = (name: string) =>
    typeof flags[name] === "string" ? (flags[name] as string) : undefined;

  // Credentials passed as flags mean a scripted login: don't prompt for the rest
  const scripted = !!(str("token") || str("username") || str("password"));

  const creds: StoredCredentials = {};
  // Self-hosted / custom API URLs are set with --url; no prompt needed for Cloud
  creds.url = str("url") ?? existing.url ?? DEFAULT_BITBUCKET_URL;

  creds.workspace = str("workspace") ?? (scripted ? existing.workspace : undefined);
  for (let attempt = 0; !scripted && !creds.workspace && attempt < 3; attempt++) {
    creds.workspace =
      (await ask("Bitbucket workspace", { defaultValue: existing.workspace })) || undefined;
  }
  if (!scripted && !creds.workspace) {
    console.error("A workspace is required; nothing saved.");
    return 1;
  }

  if (str("token")) {
    creds.token = str("token");
  } else {
    creds.username =
      str("username") ?? (await ask("Atlassian email", { defaultValue: existing.username }));
    creds.password =
      str("password") ?? (await ask("API token / app password", { hidden: true }));
  }

  if (!creds.token && !(creds.username && creds.password)) {
    console.error("No credentials entered; nothing saved.");
    return 1;
  }

  if (flags["no-verify"] !== true) {
    if (isBitbucketCloud(creds.url || DEFAULT_BITBUCKET_URL)) {
      process.stdout.write("Verifying with Bitbucket… ");
      const failure = await verifyCredentials(creds);
      if (failure) {
        console.log("failed");
        console.error(`${failure}. Nothing saved (use --no-verify to save anyway).`);
        return 1;
      }
      console.log("ok");
    } else {
      console.log("Skipping verification for non-Cloud URL.");
    }
  }

  const file = saveCredentials(creds);
  console.log(`Saved credentials to ${file}`);
  console.log(
    "The MCP server will use them automatically; BITBUCKET_* environment variables still take precedence."
  );
  return 0;
}

function status(): number {
  const file = getCredentialsPath();
  const creds = loadStoredCredentials();
  console.log(`Credentials file: ${file}${creds ? "" : " (not found)"}`);
  if (creds) {
    console.log(`  url:       ${creds.url || DEFAULT_BITBUCKET_URL}`);
    console.log(`  workspace: ${creds.workspace || "(not set)"}`);
    if (creds.token) {
      console.log(`  token:     ${mask(creds.token)}`);
    } else {
      console.log(`  username:  ${creds.username || "(not set)"}`);
      console.log(`  password:  ${mask(creds.password)}`);
    }
  }
  const overriding = Object.values(ENV_KEYS).filter((k) => process.env[k]);
  if (overriding.length) {
    console.log(`Environment overrides: ${overriding.join(", ")}`);
  }
  return creds || overriding.length ? 0 : 1;
}

export async function runAuthCommand(args: string[]): Promise<number> {
  const [command = "login", ...rest] = args;
  const flags = parseFlags(rest);
  try {
    switch (command) {
      case "login":
        return await login(flags);
      case "status":
        return status();
      case "logout":
        console.log(
          removeCredentials()
            ? `Removed ${getCredentialsPath()}`
            : "No stored credentials found."
        );
        return 0;
      case "help":
      case "--help":
      case "-h":
        console.log(USAGE);
        return 0;
      default:
        console.error(`Unknown auth command: ${command}\n\n${USAGE}`);
        return 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
