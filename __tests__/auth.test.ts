import fs from "fs";
import os from "os";
import path from "path";
import {
  applyStoredCredentials,
  getCredentialsPath,
  loadStoredCredentials,
  removeCredentials,
  saveCredentials,
} from "../src/auth.js";

describe("stored credentials", () => {
  let dir: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "bitbucket-mcp-auth-"));
    env = { BITBUCKET_CONFIG_DIR: dir };
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("uses BITBUCKET_CONFIG_DIR for the credentials path", () => {
    expect(getCredentialsPath(env)).toBe(path.join(dir, "credentials.json"));
  });

  it("returns undefined when nothing is stored", () => {
    expect(loadStoredCredentials(env)).toBeUndefined();
    expect(applyStoredCredentials(env)).toBe(false);
  });

  it("round-trips credentials and restricts file permissions", () => {
    const file = saveCredentials(
      { workspace: "acme", username: "me@example.com", password: "secret" },
      env
    );
    expect(loadStoredCredentials(env)).toEqual({
      workspace: "acme",
      username: "me@example.com",
      password: "secret",
    });
    if (process.platform !== "win32") {
      expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    }
  });

  it("ignores unknown keys and malformed files", () => {
    fs.writeFileSync(
      getCredentialsPath(env),
      JSON.stringify({ token: "abc", extra: "nope", workspace: 42 })
    );
    expect(loadStoredCredentials(env)).toEqual({ token: "abc" });

    fs.writeFileSync(getCredentialsPath(env), "{not json");
    expect(loadStoredCredentials(env)).toBeUndefined();
  });

  it("fills only unset environment variables", () => {
    saveCredentials(
      { workspace: "stored-ws", username: "me@example.com", password: "secret" },
      env
    );
    env.BITBUCKET_WORKSPACE = "env-ws";

    expect(applyStoredCredentials(env)).toBe(true);
    expect(env.BITBUCKET_WORKSPACE).toBe("env-ws");
    expect(env.BITBUCKET_USERNAME).toBe("me@example.com");
    expect(env.BITBUCKET_PASSWORD).toBe("secret");
  });

  it("does not mix stored auth with auth already set in the environment", () => {
    saveCredentials({ username: "me@example.com", password: "secret" }, env);
    env.BITBUCKET_TOKEN = "env-token";

    applyStoredCredentials(env);
    expect(env.BITBUCKET_TOKEN).toBe("env-token");
    expect(env.BITBUCKET_USERNAME).toBeUndefined();
    expect(env.BITBUCKET_PASSWORD).toBeUndefined();
  });

  it("removes stored credentials", () => {
    saveCredentials({ token: "abc" }, env);
    expect(removeCredentials(env)).toBe(true);
    expect(removeCredentials(env)).toBe(false);
    expect(loadStoredCredentials(env)).toBeUndefined();
  });
});
