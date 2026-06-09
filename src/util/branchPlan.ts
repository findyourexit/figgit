/**
 * Branch resolution helpers for commit planning.
 */

/**
 * Resolves the base branch used to create the target branch from.
 *
 * When the user has not configured an explicit default branch, this returns
 * `undefined` so the GitHub client falls back to the repository's actual
 * default branch. It must never fall back to the target branch itself: doing
 * so makes branch creation impossible when the target branch does not yet
 * exist (the client would try to read a ref that is not there).
 *
 * @param configuredDefaultBranch - The user-configured default branch (optional)
 * @returns The trimmed default branch, or `undefined` when none is configured
 */
export function resolveBaseBranch(configuredDefaultBranch: string | undefined): string | undefined {
  const trimmed = configuredDefaultBranch?.trim();
  return trimmed ? trimmed : undefined;
}
