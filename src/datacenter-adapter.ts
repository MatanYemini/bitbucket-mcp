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
  Commit,
  CommitListResult
} from './adapter-types.js';
import { PULL_REQUEST_STATE_MAP } from './field-mappings.js';
import winston from 'winston';

interface BitbucketConfig {
  baseUrl: string;
  token?: string;
  username?: string;
  password?: string;
  defaultWorkspace?: string;
}

export class DataCenterAdapter implements BitbucketAdapter {
  constructor(
    private api: AxiosInstance,
    private config: BitbucketConfig,
    private logger: winston.Logger
  ) { }

  private parseRepoSlug(repoSlug: string): [string, string] {
    if (repoSlug.includes('/')) {
      const parts = repoSlug.split('/');
      return [parts[0], parts[1]];
    }
    throw new Error('Data Center requires repo_slug in format "project/repo"');
  }

  private buildPaginationParams(options?: PaginationOptions): Record<string, any> {
    const params: Record<string, any> = {};
    if (options?.pagelen) {
      params.limit = options.pagelen;
    }
    if (options?.page) {
      params.start = (options.page - 1) * (options.pagelen || 25);
    }
    return params;
  }

  private mapPullRequestState(cloudState?: string): string | undefined {
    if (!cloudState) return undefined;
    return PULL_REQUEST_STATE_MAP[cloudState];
  }

  private normalizeRepository(dcRepo: any): Repository {
    return {
      uuid: `{${dcRepo.id}}`,
      name: dcRepo.name,
      full_name: `${dcRepo.project.key}/${dcRepo.slug}`,
      slug: dcRepo.slug,
      description: dcRepo.description || '',
      is_private: !dcRepo.public,
      project: {
        key: dcRepo.project.key,
        name: dcRepo.project.name
      },
      links: {
        clone: (dcRepo.links?.clone || []).map((link: any) => ({
          href: link.href,
          name: link.name
        })),
        self: (dcRepo.links?.self || []).map((link: any) => ({
          href: link.href
        }))
      }
    };
  }

  private normalizeRepositoryList(dcResponse: any): RepositoryListResult {
    const values = (dcResponse.values || []).map((repo: any) => this.normalizeRepository(repo));

    return {
      values,
      size: dcResponse.size,
      page: dcResponse.start ? Math.floor(dcResponse.start / (dcResponse.limit || 25)) + 1 : 1,
      pagelen: dcResponse.limit,
      next: dcResponse.isLastPage ? undefined : 'next-page'
    };
  }

  private normalizePullRequest(dcPr: any): PullRequest {
    return {
      id: dcPr.id,
      title: dcPr.title,
      description: dcPr.description || '',
      state: dcPr.state as any,
      author: {
        display_name: dcPr.author?.user?.displayName || '',
        uuid: dcPr.author?.user?.id ? `{${dcPr.author.user.id}}` : ''
      },
      source: {
        branch: { name: dcPr.fromRef?.displayId || '' },
        commit: { hash: dcPr.fromRef?.latestCommit || '' }
      },
      destination: {
        branch: { name: dcPr.toRef?.displayId || '' },
        commit: { hash: dcPr.toRef?.latestCommit || '' }
      },
      created_on: dcPr.createdDate ? new Date(dcPr.createdDate).toISOString() : '',
      updated_on: dcPr.updatedDate ? new Date(dcPr.updatedDate).toISOString() : ''
    };
  }

  private normalizePullRequestList(dcResponse: any): PullRequestListResult {
    const values = (dcResponse.values || []).map((pr: any) => this.normalizePullRequest(pr));

    return {
      values,
      size: dcResponse.size,
      page: dcResponse.start ? Math.floor(dcResponse.start / (dcResponse.limit || 25)) + 1 : 1,
      pagelen: dcResponse.limit,
      next: dcResponse.isLastPage ? undefined : 'next-page'
    };
  }

  private normalizeComment(dcComment: any): Comment {
    return {
      id: dcComment.id,
      content: {
        raw: dcComment.text || ''
      },
      created_on: dcComment.createdDate ? new Date(dcComment.createdDate).toISOString() : '',
      updated_on: dcComment.updatedDate ? new Date(dcComment.updatedDate).toISOString() : '',
      user: {
        display_name: dcComment.author?.displayName || '',
        uuid: dcComment.author?.id ? `{${dcComment.author.id}}` : ''
      },
      inline: dcComment.anchor ? {
        path: dcComment.anchor.path,
        from: dcComment.anchor.lineFrom,
        to: dcComment.anchor.lineTo
      } : undefined
    };
  }

  private normalizeCommentList(dcResponse: any): CommentListResult {
    const values = (dcResponse.values || []).map((comment: any) => this.normalizeComment(comment));

    return {
      values,
      size: dcResponse.size,
      page: dcResponse.start ? Math.floor(dcResponse.start / (dcResponse.limit || 25)) + 1 : 1,
      pagelen: dcResponse.limit,
      next: dcResponse.isLastPage ? undefined : 'next-page'
    };
  }

  async listRepositories(
    workspace: string,
    options?: PaginationOptions
  ): Promise<RepositoryListResult> {
    const params = this.buildPaginationParams(options);

    if (workspace) {
      const response = await this.api.get(`/rest/api/1.0/projects/${workspace}/repos`, { params });
      return this.normalizeRepositoryList(response.data);
    } else {
      const response = await this.api.get('/rest/api/1.0/repos', { params });
      return this.normalizeRepositoryList(response.data);
    }
  }

  async getRepository(workspace: string, repoSlug: string): Promise<Repository> {
    const [project, repo] = this.parseRepoSlug(repoSlug);
    const response = await this.api.get(`/rest/api/1.0/projects/${project}/repos/${repo}`);
    return this.normalizeRepository(response.data);
  }

  async getPullRequests(
    workspace: string,
    repoSlug: string,
    state?: string,
    options?: PaginationOptions
  ): Promise<PullRequestListResult> {
    const [project, repo] = this.parseRepoSlug(repoSlug);
    const params = {
      ...this.buildPaginationParams(options),
      state: this.mapPullRequestState(state)
    };
    const response = await this.api.get(
      `/rest/api/1.0/projects/${project}/repos/${repo}/pull-requests`,
      { params }
    );
    return this.normalizePullRequestList(response.data);
  }

  async createPullRequest(
    workspace: string,
    repoSlug: string,
    data: CreatePullRequestData
  ): Promise<PullRequest> {
    const [project, repo] = this.parseRepoSlug(repoSlug);

    const payload: any = {
      title: data.title,
      description: data.description,
      fromRef: {
        id: `refs/heads/${data.sourceBranch}`,
        repository: {
          slug: repo,
          project: { key: project }
        }
      },
      toRef: {
        id: `refs/heads/${data.targetBranch}`,
        repository: {
          slug: repo,
          project: { key: project }
        }
      }
    };

    if (data.reviewers && data.reviewers.length > 0) {
      payload.reviewers = data.reviewers.map(id => ({ user: { id: id.replace(/[{}]/g, '') } }));
    }

    const response = await this.api.post(
      `/rest/api/1.0/projects/${project}/repos/${repo}/pull-requests`,
      payload
    );

    return this.normalizePullRequest(response.data);
  }

  async getPullRequest(
    workspace: string,
    repoSlug: string,
    prId: string
  ): Promise<PullRequest> {
    const [project, repo] = this.parseRepoSlug(repoSlug);
    const response = await this.api.get(
      `/rest/api/1.0/projects/${project}/repos/${repo}/pull-requests/${prId}`
    );
    return this.normalizePullRequest(response.data);
  }

  async updatePullRequest(
    workspace: string,
    repoSlug: string,
    prId: string,
    data: UpdatePullRequestData
  ): Promise<PullRequest> {
    const [project, repo] = this.parseRepoSlug(repoSlug);

    const currentPr = await this.getPullRequest(workspace, repoSlug, prId);
    const response = await this.api.get(
      `/rest/api/1.0/projects/${project}/repos/${repo}/pull-requests/${prId}`
    );

    const payload: any = {
      ...response.data,
      version: response.data.version
    };

    if (data.title !== undefined) {
      payload.title = data.title;
    }
    if (data.description !== undefined) {
      payload.description = data.description;
    }

    const updateResponse = await this.api.put(
      `/rest/api/1.0/projects/${project}/repos/${repo}/pull-requests/${prId}`,
      payload
    );

    return this.normalizePullRequest(updateResponse.data);
  }

  async addPullRequestComment(
    workspace: string,
    repoSlug: string,
    prId: string,
    content: string,
    inline?: InlineCommentData
  ): Promise<Comment> {
    const [project, repo] = this.parseRepoSlug(repoSlug);

    const payload: any = {
      text: content
    };

    if (inline) {
      payload.anchor = {
        path: inline.path,
        lineType: 'CONTEXT'
      };

      if (inline.from !== undefined) {
        payload.anchor.line = inline.from;
      }
      if (inline.to !== undefined) {
        payload.anchor.line = inline.to;
      }
    }

    const response = await this.api.post(
      `/rest/api/1.0/projects/${project}/repos/${repo}/pull-requests/${prId}/comments`,
      payload
    );

    return this.normalizeComment(response.data);
  }

  async getPullRequestComments(
    workspace: string,
    repoSlug: string,
    prId: string,
    options?: PaginationOptions
  ): Promise<CommentListResult> {
    const [project, repo] = this.parseRepoSlug(repoSlug);
    const params = this.buildPaginationParams(options);

    const response = await this.api.get(
      `/rest/api/1.0/projects/${project}/repos/${repo}/pull-requests/${prId}/activities`,
      { params }
    );

    const comments = response.data.values
      .filter((activity: any) => activity.action === 'COMMENTED' && activity.comment)
      .map((activity: any) => this.normalizeComment(activity.comment));

    return {
      values: comments,
      size: comments.length,
      page: response.data.start ? Math.floor(response.data.start / (response.data.limit || 25)) + 1 : 1,
      pagelen: response.data.limit,
      next: response.data.isLastPage ? undefined : 'next-page'
    };
  }

  async approvePullRequest(
    workspace: string,
    repoSlug: string,
    prId: string
  ): Promise<void> {
    const [project, repo] = this.parseRepoSlug(repoSlug);
    await this.api.post(
      `/rest/api/1.0/projects/${project}/repos/${repo}/pull-requests/${prId}/approve`
    );
  }

  async mergePullRequest(
    workspace: string,
    repoSlug: string,
    prId: string,
    options?: MergeOptions
  ): Promise<PullRequest> {
    const [project, repo] = this.parseRepoSlug(repoSlug);

    const response = await this.api.get(
      `/rest/api/1.0/projects/${project}/repos/${repo}/pull-requests/${prId}`
    );

    const payload: any = {
      version: response.data.version
    };

    if (options?.message) {
      payload.message = options.message;
    }

    const mergeResponse = await this.api.post(
      `/rest/api/1.0/projects/${project}/repos/${repo}/pull-requests/${prId}/merge`,
      payload
    );

    return this.normalizePullRequest(mergeResponse.data);
  }

  private normalizeCommit(dcCommit: any): Commit {
    return {
      hash: dcCommit.id,
      message: dcCommit.message || '',
      author: {
        raw: dcCommit.author?.name || ''
      },
      date: dcCommit.authorTimestamp ? new Date(dcCommit.authorTimestamp).toISOString() : ''
    };
  }

  private normalizeCommitList(dcResponse: any): CommitListResult {
    const values = (dcResponse.values || []).map((commit: any) => this.normalizeCommit(commit));

    return {
      values,
      size: dcResponse.size,
      page: dcResponse.start ? Math.floor(dcResponse.start / (dcResponse.limit || 25)) + 1 : 1,
      pagelen: dcResponse.limit,
      next: dcResponse.isLastPage ? undefined : 'next-page'
    };
  }

  async getPullRequestDiff(
    workspace: string,
    repoSlug: string,
    prId: string
  ): Promise<string> {
    const [project, repo] = this.parseRepoSlug(repoSlug);
    const response = await this.api.get(
      `/rest/api/1.0/projects/${project}/repos/${repo}/pull-requests/${prId}/diff`
    );

    if (typeof response.data === 'string') {
      return response.data;
    }

    const diffData = response.data;
    let diffText = '';

    for (const diff of diffData.diffs || []) {
      const srcPath = diff.source?.toString || '';
      const dstPath = diff.destination?.toString || '';

      diffText += `diff --git a/${srcPath} b/${dstPath}\n`;

      for (const hunk of diff.hunks || []) {
        diffText += `@@ -${hunk.sourceLine},${hunk.sourceSpan} +${hunk.destinationLine},${hunk.destinationSpan} @@\n`;

        for (const segment of hunk.segments || []) {
          for (const line of segment.lines || []) {
            if (segment.type === 'REMOVED') {
              diffText += `-${line.line}\n`;
            } else if (segment.type === 'ADDED') {
              diffText += `+${line.line}\n`;
            } else {
              diffText += ` ${line.line}\n`;
            }
          }
        }
      }
    }

    return diffText;
  }

  async getPullRequestCommits(
    workspace: string,
    repoSlug: string,
    prId: string,
    options?: PaginationOptions
  ): Promise<CommitListResult> {
    const [project, repo] = this.parseRepoSlug(repoSlug);
    const params = this.buildPaginationParams(options);

    const response = await this.api.get(
      `/rest/api/1.0/projects/${project}/repos/${repo}/pull-requests/${prId}/commits`,
      { params }
    );

    return this.normalizeCommitList(response.data);
  }
}
