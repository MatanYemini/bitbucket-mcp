import { AxiosInstance } from 'axios';
import {
  BitbucketAdapter,
  PaginationOptions,
  RepositoryListResult,
  Repository,
  PullRequestListResult,
  PullRequest,
  CreatePullRequestData,
  UpdatePullRequestData,
  Comment,
  CommentListResult,
  InlineCommentData,
  MergeOptions,
  CommitListResult
} from './adapter-types.js';
import { BitbucketPaginator } from './pagination.js';
import winston from 'winston';

interface BitbucketConfig {
  baseUrl: string;
  token?: string;
  username?: string;
  password?: string;
  defaultWorkspace?: string;
}

export class CloudAdapter implements BitbucketAdapter {
  private paginator: BitbucketPaginator;

  constructor(
    private api: AxiosInstance,
    private config: BitbucketConfig,
    private logger: winston.Logger
  ) {
    this.paginator = new BitbucketPaginator(api, logger);
  }

  async listRepositories(
    workspace: string,
    options?: PaginationOptions
  ): Promise<RepositoryListResult> {
    const wsName = workspace || this.config.defaultWorkspace;
    if (!wsName) {
      throw new Error('Workspace is required');
    }

    const result = await this.paginator.fetchValues(
      `/repositories/${wsName}`,
      {
        pagelen: options?.pagelen ?? options?.limit,
        page: options?.page,
        all: options?.all,
        description: 'listRepositories'
      }
    );

    return result as RepositoryListResult;
  }

  async getRepository(workspace: string, repoSlug: string): Promise<Repository> {
    const response = await this.api.get(`/repositories/${workspace}/${repoSlug}`);
    return response.data as Repository;
  }

  async getPullRequests(
    workspace: string,
    repoSlug: string,
    state?: string,
    options?: PaginationOptions
  ): Promise<PullRequestListResult> {
    const params: Record<string, any> = {};
    if (state) {
      params.state = state;
    }

    const result = await this.paginator.fetchValues(
      `/repositories/${workspace}/${repoSlug}/pullrequests`,
      {
        pagelen: options?.pagelen ?? options?.limit,
        page: options?.page,
        all: options?.all,
        params,
        description: 'getPullRequests'
      }
    );

    return result as PullRequestListResult;
  }

  async createPullRequest(
    workspace: string,
    repoSlug: string,
    data: CreatePullRequestData
  ): Promise<PullRequest> {
    const payload: any = {
      title: data.title,
      description: data.description,
      source: {
        branch: {
          name: data.sourceBranch
        }
      },
      destination: {
        branch: {
          name: data.targetBranch
        }
      }
    };

    if (data.reviewers && data.reviewers.length > 0) {
      payload.reviewers = data.reviewers.map(uuid => ({ uuid }));
    }

    if (data.draft !== undefined) {
      payload.draft = data.draft;
    }

    const response = await this.api.post(
      `/repositories/${workspace}/${repoSlug}/pullrequests`,
      payload
    );

    return response.data as PullRequest;
  }

  async getPullRequest(
    workspace: string,
    repoSlug: string,
    prId: string
  ): Promise<PullRequest> {
    const response = await this.api.get(
      `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}`
    );
    return response.data as PullRequest;
  }

  async updatePullRequest(
    workspace: string,
    repoSlug: string,
    prId: string,
    data: UpdatePullRequestData
  ): Promise<PullRequest> {
    const response = await this.api.put(
      `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}`,
      data
    );
    return response.data as PullRequest;
  }

  async addPullRequestComment(
    workspace: string,
    repoSlug: string,
    prId: string,
    content: string,
    inline?: InlineCommentData
  ): Promise<Comment> {
    const payload: any = {
      content: {
        raw: content
      }
    };

    if (inline) {
      payload.inline = inline;
    }

    const response = await this.api.post(
      `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`,
      payload
    );

    return response.data as Comment;
  }

  async getPullRequestComments(
    workspace: string,
    repoSlug: string,
    prId: string,
    options?: PaginationOptions
  ): Promise<CommentListResult> {
    const result = await this.paginator.fetchValues(
      `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`,
      {
        pagelen: options?.pagelen ?? options?.limit,
        page: options?.page,
        all: options?.all,
        description: 'getPullRequestComments'
      }
    );

    return result as CommentListResult;
  }

  async approvePullRequest(
    workspace: string,
    repoSlug: string,
    prId: string
  ): Promise<void> {
    await this.api.post(
      `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/approve`
    );
  }

  async mergePullRequest(
    workspace: string,
    repoSlug: string,
    prId: string,
    options?: MergeOptions
  ): Promise<PullRequest> {
    const payload: any = {};

    if (options?.message) {
      payload.message = options.message;
    }

    if (options?.strategy) {
      payload.merge_strategy = options.strategy;
    }

    const response = await this.api.post(
      `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/merge`,
      payload
    );

    return response.data as PullRequest;
  }

  async getPullRequestDiff(
    workspace: string,
    repoSlug: string,
    prId: string
  ): Promise<string> {
    const response = await this.api.get(
      `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/diff`,
      { responseType: 'text' }
    );
    return response.data;
  }

  async getPullRequestCommits(
    workspace: string,
    repoSlug: string,
    prId: string,
    options?: PaginationOptions
  ): Promise<CommitListResult> {
    const result = await this.paginator.fetchValues(
      `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/commits`,
      {
        pagelen: options?.pagelen ?? options?.limit,
        page: options?.page,
        all: options?.all,
        description: 'getPullRequestCommits'
      }
    );

    return result as CommitListResult;
  }
}
