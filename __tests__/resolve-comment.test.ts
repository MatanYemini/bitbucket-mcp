import { jest } from "@jest/globals";
import http from "http";
import os from "os";
import path from "path";
import fs from "fs";
import type { AddressInfo } from "net";

/**
 * Regression tests for the empty-body POST fix in setCommentResolved.
 *
 * Since 3adcc91 the axios instance sets no default Content-Type when using
 * username/password auth. Bitbucket Cloud rejects a body-less POST to
 * .../comments/{id}/resolve with HTTP 400, so the resolve call must pass
 * an explicit {} body (axios then sets Content-Type: application/json).
 *
 * The tests run the real axios stack against a local HTTP server and assert
 * on the wire format, so they fail on the pre-#105 behaviour (no body, no
 * Content-Type) and pass only when the empty JSON body is sent.
 *
 * See issues #67, #99 and PR #105. resolveComment was broken in npm 5.0.6.
 */

type RecordedRequest = {
  method?: string;
  url?: string;
  contentType?: string;
  body: string;
};

const requests: RecordedRequest[] = [];

const commentFixture = (url: string): object => {
  if (url.endsWith("/comments/51")) return { id: 51, parent: { id: 42 } };
  if (url.endsWith("/comments/42")) return { id: 42 };
  return { id: 424242 };
};

const httpServer = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    requests.push({
      method: req.method,
      url: req.url,
      contentType: req.headers["content-type"],
      body,
    });

    res.setHeader("Content-Type", "application/json");
    if (req.method === "GET") {
      res.end(JSON.stringify(commentFixture(req.url ?? "")));
      return;
    }
    res.statusCode = 200;
    res.end("{}");
  });
});

await new Promise<void>((resolve) => {
  httpServer.listen(0, "127.0.0.1", () => resolve());
});

const port = (httpServer.address() as AddressInfo).port;

const logDir = fs.mkdtempSync(path.join(os.tmpdir(), "bitbucket-mcp-test-"));
process.env.BITBUCKET_URL = `http://127.0.0.1:${port}/2.0`;
process.env.BITBUCKET_USERNAME = "test-user";
process.env.BITBUCKET_PASSWORD = "test-pass";
process.env.BITBUCKET_LOG_DIR = logDir;
delete process.env.BITBUCKET_TOKEN;
delete process.env.BITBUCKET_LOG_DISABLE;

// @ts-expect-error dynamic import after env is set up
const { BitbucketServer } = await import("../src/index.js");

afterAll(() => {
  httpServer.close();
});

describe("setCommentResolved regression (#67, #105)", () => {
  beforeEach(() => {
    requests.length = 0;
  });

  it("sends an empty JSON body when resolving a comment thread", async () => {
    const server = new BitbucketServer();

    await server.setCommentResolved("ws", "repo", "7", "424242", true);

    const post = requests.find((r) => r.method === "POST");
    expect(post?.url).toBe(
      "/2.0/repositories/ws/repo/pullrequests/7/comments/424242/resolve"
    );
    expect(post?.contentType).toBe("application/json");
    expect(post?.body).toBe("{}");
  });

  it("walks up to the thread root before resolving a reply", async () => {
    const server = new BitbucketServer();

    await server.setCommentResolved("ws", "repo", "7", "51", true);

    const gets = requests.filter((r) => r.method === "GET");
    expect(gets.map((r) => r.url)).toEqual([
      "/2.0/repositories/ws/repo/pullrequests/7/comments/51",
      "/2.0/repositories/ws/repo/pullrequests/7/comments/42",
    ]);

    const post = requests.find((r) => r.method === "POST");
    expect(post?.url).toBe(
      "/2.0/repositories/ws/repo/pullrequests/7/comments/42/resolve"
    );
    expect(post?.contentType).toBe("application/json");
    expect(post?.body).toBe("{}");
  });

  it("reopens a thread with DELETE on the thread root and no POST", async () => {
    const server = new BitbucketServer();

    await server.setCommentResolved("ws", "repo", "7", "51", false);

    const del = requests.find((r) => r.method === "DELETE");
    expect(del?.url).toBe(
      "/2.0/repositories/ws/repo/pullrequests/7/comments/42/resolve"
    );
    expect(requests.some((r) => r.method === "POST")).toBe(false);
  });
});