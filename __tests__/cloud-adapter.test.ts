import axios, { AxiosInstance } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import winston from 'winston';
import { CloudAdapter } from '../src/cloud-adapter';

describe('CloudAdapter', () => {
  let api: AxiosInstance;
  let mock: MockAdapter;
  let adapter: CloudAdapter;
  let logger: winston.Logger;

  beforeEach(() => {
    api = axios.create({ baseURL: 'https://api.bitbucket.org/2.0' });
    mock = new MockAdapter(api);
    logger = winston.createLogger({ silent: true });
    adapter = new CloudAdapter(
      api,
      { baseUrl: 'https://api.bitbucket.org/2.0', defaultWorkspace: 'test-workspace' },
      logger
    );
  });

  afterEach(() => {
    mock.reset();
  });

  describe('listRepositories', () => {
    it('should list repositories for a workspace', async () => {
      const mockData = {
        values: [
          { uuid: '{123}', name: 'repo1', slug: 'repo1' },
          { uuid: '{456}', name: 'repo2', slug: 'repo2' }
        ],
        size: 2
      };

      mock.onGet('/repositories/test-workspace').reply(200, mockData);

      const result = await adapter.listRepositories('test-workspace');

      expect(result.values).toHaveLength(2);
      expect(result.values[0].name).toBe('repo1');
    });

    it('should use default workspace if not provided', async () => {
      const mockData = { values: [], size: 0 };
      mock.onGet('/repositories/test-workspace').reply(200, mockData);

      const result = await adapter.listRepositories('');

      expect(result.values).toHaveLength(0);
    });
  });

  describe('getRepository', () => {
    it('should get repository details', async () => {
      const mockRepo = {
        uuid: '{123}',
        name: 'test-repo',
        slug: 'test-repo',
        full_name: 'test-workspace/test-repo'
      };

      mock.onGet('/repositories/test-workspace/test-repo').reply(200, mockRepo);

      const result = await adapter.getRepository('test-workspace', 'test-repo');

      expect(result.name).toBe('test-repo');
      expect(result.uuid).toBe('{123}');
    });
  });

  describe('getPullRequests', () => {
    it('should get pull requests for a repository', async () => {
      const mockData = {
        values: [
          { id: 1, title: 'PR 1', state: 'OPEN' },
          { id: 2, title: 'PR 2', state: 'MERGED' }
        ],
        size: 2
      };

      mock.onGet('/repositories/test-workspace/test-repo/pullrequests').reply(200, mockData);

      const result = await adapter.getPullRequests('test-workspace', 'test-repo');

      expect(result.values).toHaveLength(2);
      expect(result.values[0].title).toBe('PR 1');
    });

    it('should filter pull requests by state', async () => {
      const mockData = {
        values: [{ id: 1, title: 'PR 1', state: 'OPEN' }],
        size: 1
      };

      mock.onGet(/\/repositories\/test-workspace\/test-repo\/pullrequests/).reply(200, mockData);

      const result = await adapter.getPullRequests('test-workspace', 'test-repo', 'OPEN');

      expect(result.values).toHaveLength(1);
      expect(result.values[0].state).toBe('OPEN');
    });
  });

  describe('createPullRequest', () => {
    it('should create a pull request', async () => {
      const mockPR = {
        id: 1,
        title: 'New PR',
        description: 'Test PR',
        state: 'OPEN'
      };

      mock.onPost('/repositories/test-workspace/test-repo/pullrequests').reply(200, mockPR);

      const result = await adapter.createPullRequest('test-workspace', 'test-repo', {
        title: 'New PR',
        description: 'Test PR',
        sourceBranch: 'feature',
        targetBranch: 'main'
      });

      expect(result.title).toBe('New PR');
      expect(result.state).toBe('OPEN');
    });

    it('should include reviewers when provided', async () => {
      const mockPR = { id: 1, title: 'New PR', state: 'OPEN' };

      mock.onPost('/repositories/test-workspace/test-repo/pullrequests').reply(config => {
        const data = JSON.parse(config.data);
        expect(data.reviewers).toEqual([{ uuid: '{reviewer-1}' }]);
        return [200, mockPR];
      });

      await adapter.createPullRequest('test-workspace', 'test-repo', {
        title: 'New PR',
        description: 'Test PR',
        sourceBranch: 'feature',
        targetBranch: 'main',
        reviewers: ['{reviewer-1}']
      });
    });
  });

  describe('getPullRequest', () => {
    it('should get a specific pull request', async () => {
      const mockPR = {
        id: 1,
        title: 'Test PR',
        state: 'OPEN'
      };

      mock.onGet('/repositories/test-workspace/test-repo/pullrequests/1').reply(200, mockPR);

      const result = await adapter.getPullRequest('test-workspace', 'test-repo', '1');

      expect(result.id).toBe(1);
      expect(result.title).toBe('Test PR');
    });
  });

  describe('updatePullRequest', () => {
    it('should update a pull request', async () => {
      const mockPR = {
        id: 1,
        title: 'Updated PR',
        description: 'Updated description'
      };

      mock.onPut('/repositories/test-workspace/test-repo/pullrequests/1').reply(200, mockPR);

      const result = await adapter.updatePullRequest('test-workspace', 'test-repo', '1', {
        title: 'Updated PR',
        description: 'Updated description'
      });

      expect(result.title).toBe('Updated PR');
    });
  });

  describe('addPullRequestComment', () => {
    it('should add a comment to a pull request', async () => {
      const mockComment = {
        id: 1,
        content: { raw: 'Test comment' },
        created_on: '2024-01-01T00:00:00Z'
      };

      mock.onPost('/repositories/test-workspace/test-repo/pullrequests/1/comments').reply(200, mockComment);

      const result = await adapter.addPullRequestComment(
        'test-workspace',
        'test-repo',
        '1',
        'Test comment'
      );

      expect(result.content.raw).toBe('Test comment');
    });

    it('should add an inline comment', async () => {
      const mockComment = {
        id: 1,
        content: { raw: 'Inline comment' },
        inline: { path: 'src/file.ts', to: 10 }
      };

      mock.onPost('/repositories/test-workspace/test-repo/pullrequests/1/comments').reply(config => {
        const data = JSON.parse(config.data);
        expect(data.inline).toEqual({ path: 'src/file.ts', to: 10 });
        return [200, mockComment];
      });

      await adapter.addPullRequestComment(
        'test-workspace',
        'test-repo',
        '1',
        'Inline comment',
        { path: 'src/file.ts', to: 10 }
      );
    });
  });

  describe('getPullRequestComments', () => {
    it('should get comments for a pull request', async () => {
      const mockData = {
        values: [
          { id: 1, content: { raw: 'Comment 1' } },
          { id: 2, content: { raw: 'Comment 2' } }
        ],
        size: 2
      };

      mock.onGet('/repositories/test-workspace/test-repo/pullrequests/1/comments').reply(200, mockData);

      const result = await adapter.getPullRequestComments('test-workspace', 'test-repo', '1');

      expect(result.values).toHaveLength(2);
    });
  });

  describe('approvePullRequest', () => {
    it('should approve a pull request', async () => {
      mock.onPost('/repositories/test-workspace/test-repo/pullrequests/1/approve').reply(200);

      await expect(
        adapter.approvePullRequest('test-workspace', 'test-repo', '1')
      ).resolves.not.toThrow();
    });
  });

  describe('mergePullRequest', () => {
    it('should merge a pull request', async () => {
      const mockPR = {
        id: 1,
        title: 'Merged PR',
        state: 'MERGED'
      };

      mock.onPost('/repositories/test-workspace/test-repo/pullrequests/1/merge').reply(200, mockPR);

      const result = await adapter.mergePullRequest('test-workspace', 'test-repo', '1');

      expect(result.state).toBe('MERGED');
    });

    it('should include merge options', async () => {
      const mockPR = { id: 1, state: 'MERGED' };

      mock.onPost('/repositories/test-workspace/test-repo/pullrequests/1/merge').reply(config => {
        const data = JSON.parse(config.data);
        expect(data.message).toBe('Merge commit message');
        expect(data.merge_strategy).toBe('squash');
        return [200, mockPR];
      });

      await adapter.mergePullRequest('test-workspace', 'test-repo', '1', {
        message: 'Merge commit message',
        strategy: 'squash'
      });
    });
  });
});
