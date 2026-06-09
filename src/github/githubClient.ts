/**
 * Lightweight GitHub client for file operations.
 *
 * This module provides essential GitHub API operations needed for the plugin:
 * - Branch creation/verification
 * - File reading and writing
 * - Conflict resolution
 * - Automatic retry with exponential backoff
 *
 * Designed to work in the Figma plugin sandbox environment, which means:
 * - Uses pure JavaScript implementations (no Web Crypto API)
 * - Uses fetch API (available in plugin sandbox)
 * - Includes manual Base64 and UTF-8 encoding
 *
 * All operations use GitHub's REST API v3.
 */

import { withRetry } from '../util/retry';

/**
 * GitHub file metadata from Contents API.
 */
interface GitHubFile {
  /** File SHA (Git blob hash) */
  sha: string;
  /** Base64-encoded file content */
  content: string;
  /** HTML URL to view the file on GitHub */
  html_url: string;
}

export interface FileCommitPayload {
  /** File path within the repository */
  path: string;
  /** Raw string content of the file */
  content: string;
  /** Deterministic content hash embedded in the JSON */
  contentHash: string;
}

export interface CommitFilesOptions {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  commitMessage: string;
  files: FileCommitPayload[];
  baseBranch?: string;
  /**
   * Pre-fetched embedded content hashes keyed by repo-relative path. When a
   * path is present, its hash is used for change detection instead of issuing
   * another contents request. Only supply hashes that are valid for the commit
   * target branch.
   */
  knownContentHashes?: Record<string, string | null>;
}

export interface CommitFilesResult {
  updated: boolean;
  skipped: boolean;
  updatedPaths: string[];
  url?: string;
  commitSha?: string;
}

/**
 * Makes an authenticated GitHub API request with automatic retry.
 *
 * Automatically adds:
 * - Authorization header with Bearer token
 * - Accept header for GitHub API v3
 * - Content-Type header for JSON payloads
 * - Automatic retry on network errors and transient failures
 *
 * @param url - Full GitHub API URL
 * @param token - GitHub Personal Access Token
 * @param init - Fetch request options
 * @returns Fetch response object
 */
async function ghFetch(url: string, token: string, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
  };

  // Add Content-Type for JSON payloads
  if (init.body && !(init.headers && (init.headers as Record<string, string>)['Content-Type'])) {
    headers['Content-Type'] = 'application/json';
  }

  init.headers = { ...headers, ...(init.headers as Record<string, string>) };

  // Retry network requests with exponential backoff.
  return withRetry(
    async () => {
      const res = await fetch(url, init);
      // Throw on transient statuses so withRetry retries them with backoff.
      // Non-transient statuses (including 401/403/404/409/422) are returned
      // so callers can inspect and handle them directly.
      if (isTransientStatus(res.status)) {
        throw new Error(`GitHub request failed with transient status ${res.status}`);
      }
      return res;
    },
    {
      maxAttempts: 3,
      initialDelay: 1000,
    }
  );
}

/**
 * Returns true for HTTP statuses worth retrying: rate limiting (429) and
 * transient server errors (5xx).
 */
function isTransientStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

export async function branchExists(
  owner: string,
  repo: string,
  branch: string,
  token: string
): Promise<boolean> {
  const refUrl = `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`;
  const ref = await ghFetch(refUrl, token);

  if (ref.status === 200) {
    return true;
  }

  if (ref.status === 404) {
    return false;
  }

  throw new Error(`Failed reading branch: ${ref.status}`);
}

/**
 * Ensures a branch exists in the repository.
 *
 * If the branch doesn't exist, creates it from a base branch:
 * - User-provided base branch (preferred)
 * - Repository default branch (fallback)
 *
 * @throws Error if unable to read repository or create branch
 */
async function ensureBranch(
  owner: string,
  repo: string,
  branch: string,
  token: string,
  baseBranch?: string
) {
  const exists = await branchExists(owner, repo, branch, token);
  if (exists) return;

  let sourceBranch = baseBranch?.trim();

  if (!sourceBranch) {
    const repoRes = await ghFetch(`https://api.github.com/repos/${owner}/${repo}`, token);
    if (!repoRes.ok) throw new Error('Cannot read repository metadata');

    const repoJson = await repoRes.json();
    sourceBranch = repoJson.default_branch;
  }

  const baseRefRes = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${sourceBranch}`,
    token
  );
  if (!baseRefRes.ok) {
    if (baseBranch) {
      throw new Error(`Cannot read base branch ref (${sourceBranch})`);
    }
    throw new Error('Cannot read default branch ref');
  }

  const baseRef = await baseRefRes.json();
  const sha = baseRef.object.sha;

  const createRes = await ghFetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, token, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
  });

  if (!createRes.ok) throw new Error('Failed to create branch');
}

/**
 * Fetches an existing file from GitHub.
 *
 * @param owner - GitHub username or organization
 * @param repo - Repository name
 * @param branch - Branch name
 * @param path - File path within repository
 * @param token - GitHub PAT
 * @returns File metadata (including Base64 content and SHA) or null if not found
 * @throws Error if request fails (except for 404)
 */
async function getExistingFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  token: string
): Promise<GitHubFile | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
  const res = await ghFetch(url, token);

  if (res.status === 404) return null; // File doesn't exist
  if (!res.ok) throw new Error(`Failed reading existing file: ${res.status}`);

  return await res.json(); // Includes sha, content (Base64), html_url
}

/**
 * Converts a string to Base64 encoding using pure JavaScript.
 *
 * GitHub's Contents API requires file content to be Base64-encoded.
 * Since btoa() is not available in the Figma plugin sandbox, we implement
 * it manually with proper UTF-8 handling (including surrogate pairs).
 *
 * Process:
 * 1. Convert UTF-16 string to UTF-8 bytes
 * 2. Encode bytes to Base64 using standard alphabet
 * 3. Add padding ('=') as needed
 *
 * @param str - String to encode
 * @returns Base64-encoded string
 */
export function toBase64(str: string): string {
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  // Convert UTF-16 string to UTF-8 bytes
  const utf8Bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let charCode = str.charCodeAt(i);

    // ASCII (0-127): single byte
    if (charCode < 0x80) {
      utf8Bytes.push(charCode);
    }
    // 2-byte sequence (128-2047)
    else if (charCode < 0x800) {
      utf8Bytes.push(0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f));
    }
    // 3-byte sequence (2048-65535, excluding surrogates)
    else if (charCode < 0xd800 || charCode >= 0xe000) {
      utf8Bytes.push(
        0xe0 | (charCode >> 12),
        0x80 | ((charCode >> 6) & 0x3f),
        0x80 | (charCode & 0x3f)
      );
    }
    // Surrogate pair (emoji, rare characters): 4-byte sequence
    else {
      i++; // Consume next char for surrogate pair
      charCode = 0x10000 + (((charCode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      utf8Bytes.push(
        0xf0 | (charCode >> 18),
        0x80 | ((charCode >> 12) & 0x3f),
        0x80 | ((charCode >> 6) & 0x3f),
        0x80 | (charCode & 0x3f)
      );
    }
  }

  // Encode UTF-8 bytes to Base64 (3 bytes → 4 Base64 chars)
  let result = '';
  for (let i = 0; i < utf8Bytes.length; i += 3) {
    const byte1 = utf8Bytes[i];
    const byte2 = i + 1 < utf8Bytes.length ? utf8Bytes[i + 1] : 0;
    const byte3 = i + 2 < utf8Bytes.length ? utf8Bytes[i + 2] : 0;

    // Split 3 bytes (24 bits) into 4 Base64 characters (6 bits each)
    const enc1 = byte1 >> 2;
    const enc2 = ((byte1 & 3) << 4) | (byte2 >> 4);
    const enc3 = ((byte2 & 15) << 2) | (byte3 >> 6);
    const enc4 = byte3 & 63;

    result += base64Chars[enc1] + base64Chars[enc2];
    result += i + 1 < utf8Bytes.length ? base64Chars[enc3] : '='; // Pad if needed
    result += i + 2 < utf8Bytes.length ? base64Chars[enc4] : '='; // Pad if needed
  }

  return result;
}

/**
 * Decodes a Base64 string to a regular string.
 *
 * GitHub's Contents API returns file content as Base64-encoded strings.
 * Since atob() is not available in the Figma plugin sandbox, we implement
 * it manually with proper UTF-8 decoding (including surrogate pairs).
 *
 * Process:
 * 1. Decode Base64 to bytes
 * 2. Decode UTF-8 bytes to UTF-16 string (JavaScript's native encoding)
 *
 * @param str - Base64-encoded string to decode
 * @returns Decoded string
 */
export function fromBase64(str: string): string {
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  // Build reverse lookup table for decoding
  const base64Lookup: Record<string, number> = {};
  for (let i = 0; i < base64Chars.length; i++) {
    base64Lookup[base64Chars[i]] = i;
  }

  // Remove whitespace and padding ('=')
  const cleanStr = str.replace(/[\s=]/g, '');

  // Decode Base64 to bytes (4 Base64 chars → 3 bytes)
  const bytes: number[] = [];
  for (let i = 0; i < cleanStr.length; i += 4) {
    const enc1 = base64Lookup[cleanStr[i]] || 0;
    const enc2 = base64Lookup[cleanStr[i + 1]] || 0;
    const enc3 = base64Lookup[cleanStr[i + 2]] || 0;
    const enc4 = base64Lookup[cleanStr[i + 3]] || 0;

    // Combine 4 Base64 characters (6 bits each) into 3 bytes
    bytes.push((enc1 << 2) | (enc2 >> 4));
    if (i + 2 < cleanStr.length) {
      bytes.push(((enc2 & 15) << 4) | (enc3 >> 2));
    }
    if (i + 3 < cleanStr.length) {
      bytes.push(((enc3 & 3) << 6) | enc4);
    }
  }

  // Decode UTF-8 bytes to UTF-16 string (JavaScript's native encoding)
  let result = '';
  let i = 0;
  while (i < bytes.length) {
    const byte1 = bytes[i++];

    // ASCII (0-127): single byte
    if (byte1 < 0x80) {
      result += String.fromCharCode(byte1);
    }
    // 2-byte sequence (128-2047)
    else if (byte1 < 0xe0) {
      const byte2 = bytes[i++];
      result += String.fromCharCode(((byte1 & 0x1f) << 6) | (byte2 & 0x3f));
    }
    // 3-byte sequence (2048-65535)
    else if (byte1 < 0xf0) {
      const byte2 = bytes[i++];
      const byte3 = bytes[i++];
      result += String.fromCharCode(
        ((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f)
      );
    }
    // 4-byte sequence (emoji, rare characters): convert to surrogate pair
    else {
      const byte2 = bytes[i++];
      const byte3 = bytes[i++];
      const byte4 = bytes[i++];
      let codePoint =
        ((byte1 & 0x07) << 18) | ((byte2 & 0x3f) << 12) | ((byte3 & 0x3f) << 6) | (byte4 & 0x3f);

      // Convert to surrogate pair for JavaScript strings
      codePoint -= 0x10000;
      result += String.fromCharCode(0xd800 + (codePoint >> 10), 0xdc00 + (codePoint & 0x3ff));
    }
  }

  return result;
}

function extractEmbeddedHashFromJsonContent(content: string): string | undefined {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.contentHash === 'string') {
        return parsed.contentHash;
      }
      const meta = parsed.meta as Record<string, unknown> | undefined;
      if (meta && typeof meta.contentHash === 'string') {
        return meta.contentHash as string;
      }
      const extensions = parsed.$extensions as Record<string, unknown> | undefined;
      if (extensions && typeof extensions === 'object') {
        const figmaExt = extensions['com.figma'] as Record<string, unknown> | undefined;
        if (figmaExt && typeof figmaExt['contentHash'] === 'string') {
          return figmaExt['contentHash'] as string;
        }
      }
    }
  } catch {
    // Ignore parse errors
  }
  return undefined;
}

export async function commitFiles(options: CommitFilesOptions): Promise<CommitFilesResult> {
  const { owner, repo, branch, token, commitMessage, files, baseBranch, knownContentHashes } =
    options;

  if (!files.length) {
    return { updated: false, skipped: true, updatedPaths: [] };
  }

  await ensureBranch(owner, repo, branch, token, baseBranch);

  const filesToUpdate = await filterFilesNeedingUpdate(
    owner,
    repo,
    branch,
    token,
    files,
    knownContentHashes
  );

  if (!filesToUpdate.length) {
    return { updated: false, skipped: true, updatedPaths: [] };
  }

  // Blobs are content-addressed and independent of the branch head, so they are
  // created once and reused across conflict retries.
  const treeEntries: Array<{ path: string; mode: string; type: string; sha: string }> = [];
  for (const file of filesToUpdate) {
    const blobSha = await createBlob(owner, repo, token, file.content);
    treeEntries.push({ path: file.path, mode: '100644', type: 'blob', sha: blobSha });
  }

  const commitSha = await commitTreeWithConflictRetry(
    owner,
    repo,
    branch,
    token,
    commitMessage,
    treeEntries
  );

  return {
    updated: true,
    skipped: false,
    updatedPaths: filesToUpdate.map((file) => file.path),
    url: `https://github.com/${owner}/${repo}/commit/${commitSha}`,
    commitSha,
  };
}

/**
 * Creates a tree and commit on the current branch HEAD, then fast-forwards the
 * branch ref to the new commit.
 *
 * If the ref update fails because the branch advanced concurrently (a 409/422
 * conflict), the branch HEAD is re-read and the commit is rebuilt on the new
 * HEAD once before giving up. The (content-addressed) blobs are reused.
 */
async function commitTreeWithConflictRetry(
  owner: string,
  repo: string,
  branch: string,
  token: string,
  commitMessage: string,
  treeEntries: Array<{ path: string; mode: string; type: string; sha: string }>,
  attempt = 0
): Promise<string> {
  const headInfo = await getHeadInfo(owner, repo, branch, token);
  const treeSha = await createTree(owner, repo, token, headInfo.treeSha, treeEntries);
  const commit = await createCommit(owner, repo, token, commitMessage, treeSha, headInfo.commitSha);

  try {
    await updateBranchRef(owner, repo, branch, token, commit.sha);
    return commit.sha;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (attempt === 0 && /\b(409|422)\b/.test(message)) {
      return commitTreeWithConflictRetry(
        owner,
        repo,
        branch,
        token,
        commitMessage,
        treeEntries,
        attempt + 1
      );
    }
    throw error;
  }
}

export interface RemoteHashLookupOptions {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  paths: string[];
}

/**
 * Fetches embedded content hashes for a set of files from a specific branch.
 *
 * @returns Map of repo-relative path → content hash (null if file missing or hash absent)
 */
export async function getRemoteFileHashes(
  options: RemoteHashLookupOptions
): Promise<Record<string, string | null>> {
  const { owner, repo, branch, token, paths } = options;
  const uniquePaths = Array.from(new Set(paths));
  const result: Record<string, string | null> = {};

  for (const path of uniquePaths) {
    const existing = await getExistingFile(owner, repo, branch, path, token);
    if (!existing) {
      result[path] = null;
      continue;
    }

    try {
      const decoded = fromBase64(existing.content);
      const embeddedHash = extractEmbeddedHashFromJsonContent(decoded);
      result[path] = embeddedHash ?? null;
    } catch {
      result[path] = null;
    }
  }

  return result;
}

async function filterFilesNeedingUpdate(
  owner: string,
  repo: string,
  branch: string,
  token: string,
  files: FileCommitPayload[],
  knownContentHashes?: Record<string, string | null>
): Promise<FileCommitPayload[]> {
  const updates: FileCommitPayload[] = [];

  for (const file of files) {
    const embeddedHash = await resolveEmbeddedHash(
      owner,
      repo,
      branch,
      token,
      file.path,
      knownContentHashes
    );
    if (embeddedHash && embeddedHash === file.contentHash) {
      continue;
    }
    updates.push(file);
  }

  return updates;
}

/**
 * Resolves the embedded content hash for a path, preferring a pre-fetched hash
 * to avoid a redundant contents request.
 */
async function resolveEmbeddedHash(
  owner: string,
  repo: string,
  branch: string,
  token: string,
  path: string,
  knownContentHashes?: Record<string, string | null>
): Promise<string | null | undefined> {
  if (knownContentHashes && Object.prototype.hasOwnProperty.call(knownContentHashes, path)) {
    return knownContentHashes[path];
  }

  const existing = await getExistingFile(owner, repo, branch, path, token);
  if (!existing) return null;
  try {
    const decoded = fromBase64(existing.content);
    return extractEmbeddedHashFromJsonContent(decoded);
  } catch {
    return undefined;
  }
}

async function getHeadInfo(
  owner: string,
  repo: string,
  branch: string,
  token: string
): Promise<{ commitSha: string; treeSha: string }> {
  const refRes = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`,
    token
  );
  if (!refRes.ok) {
    throw new Error('Failed to read branch reference');
  }
  const refJson = await refRes.json();
  const commitSha = refJson.object?.sha;
  if (!commitSha) {
    throw new Error('Invalid branch reference response');
  }

  const commitRes = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/commits/${commitSha}`,
    token
  );
  if (!commitRes.ok) {
    throw new Error('Failed to read commit metadata');
  }
  const commitJson = await commitRes.json();
  const treeSha = commitJson.tree?.sha;
  if (!treeSha) {
    throw new Error('Commit missing tree information');
  }

  return { commitSha, treeSha };
}

async function createBlob(
  owner: string,
  repo: string,
  token: string,
  content: string
): Promise<string> {
  const res = await ghFetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, token, {
    method: 'POST',
    body: JSON.stringify({ content, encoding: 'utf-8' }),
  });
  if (!res.ok) {
    throw new Error('Failed to create blob');
  }
  const json = await res.json();
  return json.sha as string;
}

async function createTree(
  owner: string,
  repo: string,
  token: string,
  baseTree: string,
  entries: Array<{ path: string; mode: string; type: string; sha: string }>
): Promise<string> {
  const res = await ghFetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, token, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTree, tree: entries }),
  });
  if (!res.ok) {
    throw new Error('Failed to create tree');
  }
  const json = await res.json();
  return json.sha as string;
}

async function createCommit(
  owner: string,
  repo: string,
  token: string,
  message: string,
  treeSha: string,
  parentSha: string
): Promise<{ sha: string }> {
  const res = await ghFetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, token, {
    method: 'POST',
    body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
  });
  if (!res.ok) {
    throw new Error('Failed to create commit');
  }
  return (await res.json()) as { sha: string };
}

async function updateBranchRef(
  owner: string,
  repo: string,
  branch: string,
  token: string,
  sha: string
): Promise<void> {
  const res = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify({ sha, force: false }),
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to update branch reference: ${res.status}`);
  }
}
