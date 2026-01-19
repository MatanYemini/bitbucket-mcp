export interface PaginationOptions {
  pagelen?: number;
  page?: number;
  all?: boolean;
  limit?: number;
}

export interface PaginationResult {
  page?: number;
  pagelen?: number;
  size?: number;
  next?: string;
}

export interface Repository {
  uuid: string;
  name: string;
  full_name: string;
  slug: string;
  description: string;
  is_private: boolean;
  project: {
    key: string;
    name: string;
  };
  links: {
    clone: Array<{ href: string; name: string }>;
    self: Array<{ href: string }>;
  };
}

export interface RepositoryListResult extends PaginationResult {
  values: Repository[];
}

export interface PullRequest {
  id: number;
  title: string;
  description: string;
  state: 'OPEN' | 'MERGED' | 'DECLINED' | 'SUPERSEDED';
  author: {
    display_name: string;
    uuid: string;
  };
  source: {
    branch: { name: string };
    commit: { hash: string };
  };
  destination: {
    branch: { name: string };
    commit: { hash: string };
  };
  created_on: string;
  updated_on: string;
}

export interface PullRequestListResult extends PaginationResult {
  values: PullRequest[];
}

export interface CreatePullRequestData {
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
  reviewers?: string[];
  draft?: boolean;
}

export interface UpdatePullRequestData {
  title?: string;
  description?: string;
}

export interface Comment {
  id: number;
  content: {
    raw: string;
  };
  created_on: string;
  updated_on: string;
  user: {
    display_name: string;
    uuid: string;
  };
  inline?: {
    path: string;
    from?: number;
    to?: number;
  };
}

export interface CommentListResult extends PaginationResult {
  values: Comment[];
}

export interface InlineCommentData {
  path: string;
  from?: number;
  to?: number;
}

export interface MergeOptions {
  message?: string;
  strategy?: 'merge-commit' | 'squash' | 'fast-forward';
}

export interface Commit {
  hash: string;
  message: string;
  author: {
    raw: string;
  };
  date: string;
}

export interface CommitListResult extends PaginationResult {
  values: Commit[];
}

export interface BitbucketAdapter {
  listRepositories(
    workspace: string,
    options?: PaginationOptions
  ): Promise<RepositoryListResult>;

  getRepository(workspace: string, repoSlug: string): Promise<Repository>;

  getPullRequests(
    workspace: string,
    repoSlug: string,
    state?: string,
    options?: PaginationOptions
  ): Promise<PullRequestListResult>;

  createPullRequest(
    workspace: string,
    repoSlug: string,
    data: CreatePullRequestData
  ): Promise<PullRequest>;

  getPullRequest(
    workspace: string,
    repoSlug: string,
    prId: string
  ): Promise<PullRequest>;

  updatePullRequest(
    workspace: string,
    repoSlug: string,
    prId: string,
    data: UpdatePullRequestData
  ): Promise<PullRequest>;

  getPullRequestDiff(
    workspace: string,
    repoSlug: string,
    prId: string
  ): Promise<string>;

  getPullRequestCommits(
    workspace: string,
    repoSlug: string,
    prId: string,
    options?: PaginationOptions
  ): Promise<CommitListResult>;

  addPullRequestComment(
    workspace: string,
    repoSlug: string,
    prId: string,
    content: string,
    inline?: InlineCommentData
  ): Promise<Comment>;

  getPullRequestComments(
    workspace: string,
    repoSlug: string,
    prId: string,
    options?: PaginationOptions
  ): Promise<CommentListResult>;

  approvePullRequest(
    workspace: string,
    repoSlug: string,
    prId: string
  ): Promise<void>;

  mergePullRequest(
    workspace: string,
    repoSlug: string,
    prId: string,
    options?: MergeOptions
  ): Promise<PullRequest>;
}
