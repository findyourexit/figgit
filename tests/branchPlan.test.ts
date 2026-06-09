import { describe, it, expect } from 'vitest';
import { resolveBaseBranch } from '../src/util/branchPlan';

describe('resolveBaseBranch', () => {
  it('returns undefined when no default branch is configured', () => {
    // Regression: a blank default branch must NOT collapse to the target branch.
    // It must be undefined so the client uses the repository's real default.
    expect(resolveBaseBranch(undefined)).toBeUndefined();
    expect(resolveBaseBranch('')).toBeUndefined();
    expect(resolveBaseBranch('   ')).toBeUndefined();
  });

  it('returns the trimmed default branch when configured', () => {
    expect(resolveBaseBranch('main')).toBe('main');
    expect(resolveBaseBranch('  develop  ')).toBe('develop');
  });
});
