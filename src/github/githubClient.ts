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

/**
 * Result of a file upsert operation.
 */
export interface UpsertResult {
  /** True if file was created or updated */
  updated: boolean;
  /** True if operation was skipped due to identical content */
  skipped: boolean;
  /** GitHub HTML URL to view the file */
  url?: string;
  /** Git commit SHA if file was updated */
  commitSha?: string;
}

/**
 * Options for upserting a file to GitHub.
 */
export interface GitHubUpsertOptions {
  /** GitHub username or organization name */
  owner: string;
  /** Repository name */
  repo: string;
  /** Target branch name */
  branch: string;
  /** File path within repository (e.g., 'folder/filename.json') */
  path: string;
  /** File content as raw string (will be Base64-encoded) */
  content: string;
  /** GitHub Personal Access Token */
  token: string;
  /** Commit message for the change */
  commitMessage: string;
  /** SHA-256 content hash for change detection (not Git blob hash) */
  currentHash: string;
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

  // Retry network requests with exponential backoff
  return withRetry(
    async () => {
      return await fetch(url, init);
    },
    {
      maxAttempts: 3,
      initialDelay: 1000,
    }
  );
}

/**
 * Ensures a branch exists in the repository.
 *
 * If the branch doesn't exist, creates it from the default branch.
 * If it already exists, does nothing.
 *
 * @param owner - GitHub username or organization
 * @param repo - Repository name
 * @param branch - Branch name to ensure exists
 * @param token - GitHub PAT
 * @throws Error if unable to read repository or create branch
 */
async function ensureBranch(owner: string, repo: string, branch: string, token: string) {
  const refUrl = `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`;
  const ref = await ghFetch(refUrl, token);

  if (ref.status === 200) return; // Branch exists
  if (ref.status !== 404) throw new Error(`Failed reading branch: ${ref.status}`);

  // Branch doesn't exist - create it from default branch
  const repoRes = await ghFetch(`https://api.github.com/repos/${owner}/${repo}`, token);
  if (!repoRes.ok) throw new Error('Cannot read repository metadata');

  const repoJson = await repoRes.json();
  const defaultBranch = repoJson.default_branch;

  const baseRefRes = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${defaultBranch}`,
    token
  );
  if (!baseRefRes.ok) throw new Error('Cannot read default branch ref');

  const baseRef = await baseRefRes.json();
  const sha = baseRef.object.sha;

  // Create new branch pointing to default branch's HEAD
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
function toBase64(str: string): string {
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

/**
 * Creates or updates a file in a GitHub repository.
 *
 * Features:
 * - Automatically creates branch if it doesn't exist
 * - Detects if content has changed using content hash
 * - Skips commit if content is identical (idempotent)
 * - Automatically retries once on 409 conflicts
 * - Handles create and update in one operation
 *
 * Change detection:
 * 1. Fetches existing file (if any)
 * 2. Checks embedded meta.contentHash against current hash
 * 3. Skips commit if hashes match
 * 4. Otherwise, creates/updates file
 *
 * @param options - File upsert configuration
 * @returns Result indicating whether file was updated or skipped
 * @throws Error if unable to create/update file
 */
export async function upsertFile(options: GitHubUpsertOptions): Promise<UpsertResult> {
  const { owner, repo, branch, path, content, token, commitMessage, currentHash } = options;

  // Ensure target branch exists (create from default branch if needed)
  await ensureBranch(owner, repo, branch, token);

  // Check if file already exists
  const existing = await getExistingFile(owner, repo, branch, path, token);

  if (existing) {
    try {
      const decoded = fromBase64(existing.content);

      // Try to parse JSON and extract embedded contentHash for smart comparison
      let embeddedHash: string | undefined;
      try {
        const parsed = JSON.parse(decoded);
        embeddedHash = parsed?.meta?.contentHash;
      } catch {
        // Ignore parse errors - file might not be JSON or might be corrupted
      }

      // If hashes match, content is identical - skip commit
      if (embeddedHash && embeddedHash === currentHash) {
        return { updated: false, skipped: true, url: existing.html_url };
      }

      // If no embedded hash (legacy file), proceed with update
      // The hash will be added after first update
    } catch {
      // Ignore Base64 decoding errors - proceed with update
    }
  }

  // Prepare commit payload
  const body = {
    message: commitMessage,
    content: toBase64(content),
    branch,
    sha: existing ? existing.sha : undefined, // SHA required for updates
  };

  /**
   * Attempts to write the file to GitHub.
   *
   * Handles 409 conflicts by refetching and retrying once.
   * This handles race conditions where another process updated the file.
   *
   * @param prevExisting - Previously fetched file metadata
   * @param attempt - Attempt number (0 = first try, 1 = retry)
   * @returns Upsert result
   */
  async function attemptWrite(
    prevExisting: GitHubFile | null,
    attempt: number
  ): Promise<UpsertResult> {
    const putRes = await ghFetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      token,
      {
        method: 'PUT',
        body: JSON.stringify({ ...body, sha: prevExisting ? prevExisting.sha : body.sha }),
      }
    );

    // Handle 409 conflict (file was updated by someone else)
    if (putRes.status === 409 && attempt === 0) {
      // Refetch latest version and retry once
      const latest = await getExistingFile(owner, repo, branch, path, token);

      if (latest) {
        // Before retrying, check if content is still identical
        try {
          const decoded = fromBase64(latest.content);
          const parsed = JSON.parse(decoded);
          const embedded = parsed?.meta?.contentHash;

          if (embedded && embedded === currentHash) {
            // Content matches - someone else already committed the same change
            return { updated: false, skipped: true, url: latest.html_url };
          }
        } catch {
          // Ignore errors - proceed with retry
        }
      }

      // Retry with latest SHA
      return attemptWrite(latest, 1);
    }

    if (!putRes.ok) {
      throw new Error(`Failed to write file: ${putRes.status}`);
    }

    const result = await putRes.json();
    return {
      updated: true,
      skipped: false,
      url: result.content?.html_url,
      commitSha: result.commit?.sha,
    };
  }

  // Start the write attempt
  return attemptWrite(existing, 0);
}
