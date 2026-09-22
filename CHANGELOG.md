# Changelog

## Unreleased

- `getPullRequestComments` now returns every page by default. It previously returned only the first 10 comments and dropped the `next` link, so callers had no way to tell that a review thread had been truncated. An explicit `page` still returns that single page.
- `getPullRequestComments` now omits deleted comments and every reply below a deleted thread root. Bitbucket keeps deleted comments in the collection with their content blanked out, so withdrawn feedback was reaching callers as if it were still live.
- `publishPendingComments` now reports how many comments it actually published and raises an error when none could be published. Bitbucket Cloud rejects `pending` on `PUT /comments/{id}` with `{"fields": {"pending": "extra keys not allowed"}}`, so every publish failed while the tool still reported `Published N pending comments`.
- Documented in the `addPendingPullRequestComment` and `publishPendingComments` tool descriptions that Bitbucket Cloud exposes no REST endpoint for publishing a draft comment.
- Added Jest tests for the deleted-thread filter, covering deleted roots, deleted replies, missing parents, cyclic ancestry, and mixed string/number comment ids.
- Added a shared Bitbucket Cloud pagination helper and applied it across all list-style MCP tools so `pagelen`, `page`, and `all` arguments respect Bitbucket limits and `next` links (#37).
- Updated tool schemas, README documentation, and logging to describe the new pagination controls and to highlight the 1,000-item safety cap for `all=true`.
- Added Jest tests covering the pagination helper, including explicit `pagelen` requests, maximum page sizing, and automatic traversal of `next` links.
