/**
 * Input validation utilities for GitHub repository settings.
 *
 * This module provides comprehensive validation for all user inputs that will be
 * used in GitHub API calls and file operations. Validation rules follow GitHub's
 * requirements and best practices for security.
 */

/**
 * Result of a validation check.
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  /** Human-readable error message if validation failed */
  error?: string;
}

/**
 * Validates a GitHub username or organization name.
 *
 * Rules enforced:
 * - Required (non-empty)
 * - Alphanumeric characters and hyphens only
 * - Cannot start or end with a hyphen
 * - Maximum 39 characters (GitHub's limit)
 *
 * @param owner - GitHub username or organization name to validate
 * @returns Validation result with error message if invalid
 *
 * @example
 * ```typescript
 * validateGitHubOwner('facebook');     // { valid: true }
 * validateGitHubOwner('invalid@name'); // { valid: false, error: '...' }
 * ```
 */
export function validateGitHubOwner(owner: string): ValidationResult {
  if (!owner || !owner.trim()) {
    return { valid: false, error: 'Owner is required' };
  }

  // GitHub username/org rules: alphanumeric + hyphens, can't start with hyphen
  if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(owner.trim())) {
    return { valid: false, error: 'Invalid owner format (alphanumeric and hyphens only)' };
  }

  if (owner.trim().length > 39) {
    return { valid: false, error: 'Owner name too long (max 39 characters)' };
  }

  return { valid: true };
}

/**
 * Validates a GitHub repository name.
 *
 * Rules enforced:
 * - Required (non-empty)
 * - Alphanumeric characters, hyphens, underscores, and dots only
 * - Maximum 100 characters (GitHub's limit)
 *
 * @param repo - Repository name to validate
 * @returns Validation result with error message if invalid
 */
export function validateGitHubRepo(repo: string): ValidationResult {
  if (!repo || !repo.trim()) {
    return { valid: false, error: 'Repository name is required' };
  }

  // GitHub repo rules: alphanumeric + hyphens, underscores, dots
  if (!/^[a-zA-Z0-9._-]+$/.test(repo.trim())) {
    return {
      valid: false,
      error: 'Invalid repository format (alphanumeric, hyphens, underscores, dots only)',
    };
  }

  if (repo.trim().length > 100) {
    return { valid: false, error: 'Repository name too long (max 100 characters)' };
  }

  return { valid: true };
}

/**
 * Validates a Git branch name.
 *
 * Rules enforced:
 * - Required (non-empty)
 * - Cannot start with a hyphen (Git requirement)
 * - Cannot end with '.lock' (Git requirement)
 * - Cannot contain '..' (Git requirement)
 * - Maximum 255 characters
 *
 * @param branch - Branch name to validate
 * @returns Validation result with error message if invalid
 */
export function validateBranchName(branch: string): ValidationResult {
  if (!branch || !branch.trim()) {
    return { valid: false, error: 'Branch name is required' };
  }

  // Basic branch name validation following Git rules
  if (branch.trim().startsWith('-') || branch.trim().endsWith('.lock') || /\.\./.test(branch)) {
    return { valid: false, error: 'Invalid branch name format' };
  }

  if (branch.trim().length > 255) {
    return { valid: false, error: 'Branch name too long (max 255 characters)' };
  }

  return { valid: true };
}

/**
 * Validates a filename for the exported JSON file.
 *
 * Rules enforced:
 * - Required (non-empty)
 * - Must end with '.json' extension
 * - Alphanumeric characters, hyphens, underscores, and dots only
 * - No path traversal sequences ('..' or '//')
 *
 * @param filename - Filename to validate
 * @returns Validation result with error message if invalid
 */
export function validateFilename(filename: string): ValidationResult {
  if (!filename || !filename.trim()) {
    return { valid: false, error: 'Filename is required' };
  }

  // Prevent path traversal attacks
  if (filename.includes('..') || filename.includes('//')) {
    return { valid: false, error: 'Invalid filename (no path traversal)' };
  }

  // Must be a .json file with safe characters
  if (!/^[a-zA-Z0-9._-]+\.json$/i.test(filename.trim())) {
    return {
      valid: false,
      error:
        'Filename must end with .json and contain only alphanumeric, hyphens, underscores, dots',
    };
  }

  return { valid: true };
}

/**
 * Validates a folder path (optional field).
 *
 * Rules enforced:
 * - Optional (empty is valid)
 * - Alphanumeric characters, hyphens, underscores, dots, and slashes only
 * - No path traversal sequences ('..')
 *
 * @param folder - Folder path to validate (can be empty)
 * @returns Validation result with error message if invalid
 */
export function validateFolderPath(folder: string): ValidationResult {
  if (!folder || !folder.trim()) {
    return { valid: true }; // Folder is optional
  }

  // Prevent path traversal attacks
  if (folder.includes('..')) {
    return { valid: false, error: 'Invalid folder path (no path traversal)' };
  }

  // Remove leading/trailing slashes for validation
  const normalized = folder.trim().replace(/^\/+/, '').replace(/\/+$/, '');

  if (normalized && !/^[a-zA-Z0-9._/-]+$/.test(normalized)) {
    return {
      valid: false,
      error: 'Invalid folder path (alphanumeric, hyphens, underscores, dots, slashes only)',
    };
  }

  return { valid: true };
}

/**
 * Validates all GitHub settings at once.
 *
 * Runs all individual validators and returns the first error encountered.
 * This is useful for validating a complete settings object before attempting
 * to commit to GitHub.
 *
 * @param settings - Complete settings object to validate
 * @returns Validation result with error from first failed validation, or success
 */
export function validateAllSettings(settings: {
  owner: string;
  repo: string;
  branch: string;
  filename: string;
  folder?: string;
}): ValidationResult {
  const ownerResult = validateGitHubOwner(settings.owner);
  if (!ownerResult.valid) return ownerResult;

  const repoResult = validateGitHubRepo(settings.repo);
  if (!repoResult.valid) return repoResult;

  const branchResult = validateBranchName(settings.branch);
  if (!branchResult.valid) return branchResult;

  const filenameResult = validateFilename(settings.filename);
  if (!filenameResult.valid) return filenameResult;

  if (settings.folder) {
    const folderResult = validateFolderPath(settings.folder);
    if (!folderResult.valid) return folderResult;
  }

  return { valid: true };
}
