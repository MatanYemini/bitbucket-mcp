# Changelog

## Unreleased

- Added a shared Bitbucket Cloud pagination helper and applied it across all list-style MCP tools so `pagelen`, `page`, and `all` arguments respect Bitbucket limits and `next` links (#37).
- Updated tool schemas, README documentation, and logging to describe the new pagination controls and to highlight the 1,000-item safety cap for `all=true`.
- Added Jest tests covering the pagination helper, including explicit `pagelen` requests, maximum page sizing, and automatic traversal of `next` links.
