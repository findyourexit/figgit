/**
 * Enhanced error message utilities for better user guidance.
 *
 * Provides specific, actionable error messages instead of generic failures.
 * Includes helpful links to GitHub settings and documentation when relevant.
 */

export interface EnhancedError {
  message: string;
  action?: string;
  link?: {
    text: string;
    url: string;
  };
}

/**
 * Enhances GitHub API errors with specific, actionable guidance.
 *
 * @param error - The original error message or Error object
 * @param context - Additional context about the operation
 * @returns Enhanced error with message, suggested action, and optional link
 */
export function enhanceGitHubError(
  error: string | Error,
  context?: {
    owner?: string;
    repo?: string;
    operation?: 'commit' | 'fetch' | 'validate';
  }
): EnhancedError {
  const errorMsg = error instanceof Error ? error.message : error;
  const { owner, repo, operation } = context || {};

  // 401 Unauthorized
  if (/401|unauthorized/i.test(errorMsg)) {
    return {
      message: 'Authentication failed',
      action: 'Your GitHub token is invalid or expired. Please save a new token.',
      link: {
        text: 'Create new token',
        url: 'https://github.com/settings/tokens/new?scopes=repo&description=Figma%20Variable%20Sync',
      },
    };
  }

  // 403 Forbidden
  if (/403|forbidden/i.test(errorMsg)) {
    return {
      message: 'Access denied',
      action: `Your token doesn't have permission to access ${owner ? `${owner}/${repo}` : 'this repository'}. Ensure your token has 'repo' scope.`,
      link: {
        text: 'Check token permissions',
        url: 'https://github.com/settings/tokens',
      },
    };
  }

  // 404 Not Found
  if (/404|not found/i.test(errorMsg)) {
    if (operation === 'commit' && owner && repo) {
      return {
        message: 'Repository not found',
        action: `Cannot access '${owner}/${repo}'. Check spelling, visibility (public/private), and permissions.`,
        link: {
          text: 'Open repository',
          url: `https://github.com/${owner}/${repo}`,
        },
      };
    }
    return {
      message: 'Resource not found',
      action: 'The repository, branch, or file could not be found. Verify your settings.',
    };
  }

  // 409 Conflict
  if (/409|conflict/i.test(errorMsg)) {
    return {
      message: 'Commit conflict detected',
      action: 'The file was modified by someone else. The plugin will retry automatically.',
    };
  }

  // 422 Validation Failed
  if (/422|validation/i.test(errorMsg)) {
    return {
      message: 'Invalid request',
      action:
        'Check that branch name and file path are valid. Branch must exist or will be created from default branch.',
    };
  }

  // Rate limiting
  if (/rate limit/i.test(errorMsg)) {
    return {
      message: 'GitHub API rate limit exceeded',
      action: 'Wait a few minutes before trying again. Authenticated requests have higher limits.',
      link: {
        text: 'Rate limit info',
        url: 'https://docs.github.com/en/rest/rate-limit',
      },
    };
  }

  // Network errors
  if (/network|fetch|timeout|ECONNREFUSED/i.test(errorMsg)) {
    return {
      message: 'Network error',
      action: 'Unable to reach GitHub. Check your internet connection and try again.',
    };
  }

  // Token validation specific
  if (operation === 'validate') {
    return {
      message: 'Token validation failed',
      action: 'Could not validate your GitHub token. It may be invalid or expired.',
      link: {
        text: 'Manage tokens',
        url: 'https://github.com/settings/tokens',
      },
    };
  }

  // Generic fallback
  return {
    message: errorMsg || 'An unknown error occurred',
    action:
      'Please check your settings and try again. If the problem persists, check GitHub status.',
    link: {
      text: 'GitHub Status',
      url: 'https://www.githubstatus.com/',
    },
  };
}

/**
 * Formats an enhanced error into a user-friendly message.
 *
 * @param enhanced - The enhanced error object
 * @returns Formatted error message string
 */
export function formatEnhancedError(enhanced: EnhancedError): string {
  let msg = enhanced.message;
  if (enhanced.action) {
    msg += ` — ${enhanced.action}`;
  }
  return msg;
}

/**
 * Validates settings and returns specific error messages.
 *
 * @param settings - Settings to validate
 * @returns Enhanced error if invalid, null if valid
 */
export function validateSettingsWithGuidance(settings: {
  owner: string;
  repo: string;
  branch: string;
  filename: string;
}): EnhancedError | null {
  if (!settings.owner || !settings.owner.trim()) {
    return {
      message: 'Repository owner is required',
      action: 'Enter your GitHub username or organization name (e.g., "facebook", "your-username")',
    };
  }

  if (!settings.repo || !settings.repo.trim()) {
    return {
      message: 'Repository name is required',
      action: 'Enter the name of your repository (e.g., "react", "my-design-tokens")',
    };
  }

  if (!settings.branch || !settings.branch.trim()) {
    return {
      message: 'Branch name is required',
      action: 'Enter the target branch name (e.g., "main", "develop", "design-tokens")',
    };
  }

  if (!settings.filename || !settings.filename.trim()) {
    return {
      message: 'Filename is required',
      action: 'Enter the output filename (e.g., "variables.json", "design-tokens.json")',
    };
  }

  // Validate filename has .json extension
  if (!settings.filename.endsWith('.json')) {
    return {
      message: 'Invalid filename',
      action: 'Filename must end with .json extension (e.g., "variables.json")',
    };
  }

  return null;
}
