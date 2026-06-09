# Changelog

## 1.0.0

This is the first release of `bitbucket-mcp-plus`, a fork of [`bitbucket-mcp`](https://www.npmjs.com/package/bitbucket-mcp) with extra tooling and an own publishing identity.

### Added (vs. upstream `bitbucket-mcp` 5.0.7)

- `updatePullRequestReviewers` — replace the full reviewer list on a PR (pass `[]` to clear).
- `deleteMyPullRequestComments` — bulk-delete every comment authored by the authenticated user on a PR. Gated by `BITBUCKET_ENABLE_DANGEROUS=true`.
- `deletePullRequestComments` — bulk-delete PR comments by filter (`comment_ids`, `author_uuid`, `author_nickname`, `resolved`) with optional `include_replies` and `dry_run`. Gated by `BITBUCKET_ENABLE_DANGEROUS=true`.
- Local image upload tools for PR comments (file path, clipboard, raw base64).

### Changed

- Package renamed to `bitbucket-mcp-plus`; CLI bin renamed to `local-bitbucket-mcp`.
- Repository moved to `yunior8908/local-bitbucket-mcp`.
- `mcpName` updated to `io.github.yunior8908/local-bitbucket-mcp`.
- Registry manifest emitted as `registry/bitbucket-mcp-plus.manifest.json`.

### Inherited from upstream

- Shared Bitbucket Cloud pagination helper across all list-style MCP tools (`pagelen`, `page`, `all` arguments) with a 1,000-item safety cap for `all=true`.
- Jest tests covering the pagination helper.
