/**
 * GitHub client tests.
 *
 * These tests mock the global `fetch` to exercise the branch-creation and
 * commit flow without hitting the network. They guard against regressions in
 * the "create the target branch from the repository default" behaviour, which
 * is the path used the first time a user pushes to a brand-new branch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { commitFiles, branchExists } from '../src/github/githubClient';

interface MockResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function jsonResponse(status: number, body: unknown): MockResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

/**
 * Builds a stateful fetch mock that simulates a repository whose default branch
 * is `main`. Additional branches can be pre-seeded via `existingBranches`.
 */
function createFetchMock(options: {
  owner: string;
  repo: string;
  defaultBranch?: string;
  existingBranches?: string[];
  existingFiles?: Record<string, { sha: string; content: string }>;
}) {
  const { owner, repo, defaultBranch = 'main' } = options;
  const branches = new Set(options.existingBranches ?? [defaultBranch]);
  const files = options.existingFiles ?? {};
  const calls: Array<{ method: string; url: string }> = [];

  const base = `https://api.github.com/repos/${owner}/${repo}`;

  const fetchMock = vi.fn(async (url: unknown, init?: RequestInit): Promise<MockResponse> => {
    const u = String(url);
    const method = init?.method ?? 'GET';
    calls.push({ method, url: u });

    // Branch ref lookup: GET /git/ref/heads/<branch>
    const refMatch = u.match(/\/git\/ref\/heads\/(.+)$/);
    if (method === 'GET' && refMatch) {
      const branch = decodeURIComponent(refMatch[1]);
      if (branches.has(branch)) {
        return jsonResponse(200, { object: { sha: `commit-${branch}` } });
      }
      return jsonResponse(404, {});
    }

    // Repository metadata (exact, no trailing path): GET /repos/owner/repo
    if (method === 'GET' && u === base) {
      return jsonResponse(200, { default_branch: defaultBranch });
    }

    // Create ref: POST /git/refs
    if (method === 'POST' && u.endsWith('/git/refs')) {
      const body = JSON.parse(String(init?.body)) as { ref: string };
      const branch = body.ref.replace('refs/heads/', '');
      branches.add(branch);
      return jsonResponse(201, { ref: body.ref, object: { sha: `commit-${branch}` } });
    }

    // Contents API (file read): GET /contents/<path>?ref=<branch>
    if (method === 'GET' && u.includes('/contents/')) {
      const pathPart = u.split('/contents/')[1].split('?')[0];
      const path = decodeURIComponent(pathPart);
      const file = files[path];
      if (!file) return jsonResponse(404, {});
      return jsonResponse(200, {
        sha: file.sha,
        content: file.content,
        html_url: `https://github.com/${owner}/${repo}/blob/main/${path}`,
      });
    }

    // Commit metadata: GET /git/commits/<sha>
    if (method === 'GET' && u.includes('/git/commits/')) {
      return jsonResponse(200, { tree: { sha: 'tree-head' } });
    }

    // Create blob / tree / commit
    if (method === 'POST' && u.endsWith('/git/blobs')) {
      return jsonResponse(201, { sha: 'blob-new' });
    }
    if (method === 'POST' && u.endsWith('/git/trees')) {
      return jsonResponse(201, { sha: 'tree-new' });
    }
    if (method === 'POST' && u.endsWith('/git/commits')) {
      return jsonResponse(201, { sha: 'commit-new' });
    }

    // Update branch ref: PATCH /git/refs/heads/<branch>
    if (method === 'PATCH' && u.includes('/git/refs/heads/')) {
      return jsonResponse(200, {});
    }

    throw new Error(`Unhandled request in mock: ${method} ${u}`);
  });

  return { fetchMock, calls, branches };
}

describe('githubClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('branchExists', () => {
    it('returns true for an existing branch and false for a missing one', async () => {
      const { fetchMock } = createFetchMock({
        owner: 'acme',
        repo: 'tokens',
        existingBranches: ['main'],
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(branchExists('acme', 'tokens', 'main', 't')).resolves.toBe(true);
      await expect(branchExists('acme', 'tokens', 'design-tokens', 't')).resolves.toBe(false);
    });
  });

  describe('commitFiles branch creation', () => {
    it('creates a missing target branch from the repository default when no base branch is given', async () => {
      // Regression test: when the configured "default branch" is blank, the
      // plugin passes `baseBranch: undefined`. The client must then look up the
      // repository's actual default branch (`main`) and create the target from
      // it, rather than failing with "Cannot read base branch ref".
      const { fetchMock, calls, branches } = createFetchMock({
        owner: 'acme',
        repo: 'tokens',
        defaultBranch: 'main',
        existingBranches: ['main'],
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await commitFiles({
        owner: 'acme',
        repo: 'tokens',
        branch: 'design-tokens',
        token: 't',
        commitMessage: 'chore: export tokens',
        files: [{ path: 'tokens/variables.json', content: '{}', contentHash: 'abc' }],
        baseBranch: undefined,
      });

      expect(result.updated).toBe(true);
      expect(result.skipped).toBe(false);
      expect(result.url).toContain('/commit/commit-new');

      // The repository default branch must have been consulted.
      const consultedRepoDefault = calls.some(
        (c) => c.method === 'GET' && c.url === 'https://api.github.com/repos/acme/tokens'
      );
      expect(consultedRepoDefault).toBe(true);

      // The target branch must have been created.
      expect(branches.has('design-tokens')).toBe(true);
      const createdRef = calls.some((c) => c.method === 'POST' && c.url.endsWith('/git/refs'));
      expect(createdRef).toBe(true);
    });

    it('creates a missing target branch from an explicit base branch without touching repo metadata', async () => {
      const { fetchMock, calls, branches } = createFetchMock({
        owner: 'acme',
        repo: 'tokens',
        defaultBranch: 'main',
        existingBranches: ['main', 'develop'],
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await commitFiles({
        owner: 'acme',
        repo: 'tokens',
        branch: 'design-tokens',
        token: 't',
        commitMessage: 'chore: export tokens',
        files: [{ path: 'variables.json', content: '{}', contentHash: 'abc' }],
        baseBranch: 'develop',
      });

      expect(result.updated).toBe(true);
      expect(branches.has('design-tokens')).toBe(true);

      // With an explicit base branch, the repository metadata endpoint must NOT
      // be hit.
      const consultedRepoDefault = calls.some(
        (c) => c.method === 'GET' && c.url === 'https://api.github.com/repos/acme/tokens'
      );
      expect(consultedRepoDefault).toBe(false);
    });

    it('throws a clear error when an explicit base branch does not exist', async () => {
      const { fetchMock } = createFetchMock({
        owner: 'acme',
        repo: 'tokens',
        existingBranches: ['main'],
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(
        commitFiles({
          owner: 'acme',
          repo: 'tokens',
          branch: 'design-tokens',
          token: 't',
          commitMessage: 'chore: export tokens',
          files: [{ path: 'variables.json', content: '{}', contentHash: 'abc' }],
          baseBranch: 'nonexistent',
        })
      ).rejects.toThrow(/base branch ref/i);
    });
  });

  describe('commitFiles skip behaviour', () => {
    it('skips the commit when the embedded content hash already matches the remote file', async () => {
      // The remote file embeds the same contentHash, so no commit should happen.
      const remoteContent = JSON.stringify({ contentHash: 'abc', tokens: {} });
      // Base64 of remoteContent using btoa (available in jsdom test env).
      const encoded = btoa(remoteContent);

      const { fetchMock, calls } = createFetchMock({
        owner: 'acme',
        repo: 'tokens',
        existingBranches: ['main'],
        existingFiles: {
          'variables.json': { sha: 'file-sha', content: encoded },
        },
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await commitFiles({
        owner: 'acme',
        repo: 'tokens',
        branch: 'main',
        token: 't',
        commitMessage: 'chore: export tokens',
        files: [{ path: 'variables.json', content: remoteContent, contentHash: 'abc' }],
      });

      expect(result.skipped).toBe(true);
      expect(result.updated).toBe(false);

      // No commit objects should have been created.
      const createdCommit = calls.some(
        (c) => c.method === 'POST' && c.url.endsWith('/git/commits')
      );
      expect(createdCommit).toBe(false);
    });
  });
});
