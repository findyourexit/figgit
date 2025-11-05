/**
 * Tests for error message utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  enhanceGitHubError,
  formatEnhancedError,
  validateSettingsWithGuidance,
} from '../src/ui/utils/errorMessages';

describe('enhanceGitHubError', () => {
  it('should enhance 401 unauthorized errors', () => {
    const enhanced = enhanceGitHubError('401 Unauthorized', { operation: 'commit' });

    expect(enhanced.message).toBe('Authentication failed');
    expect(enhanced.action).toContain('GitHub token is invalid or expired');
    expect(enhanced.link?.url).toContain('github.com/settings/tokens');
  });

  it('should enhance 403 forbidden errors', () => {
    const enhanced = enhanceGitHubError('403 Forbidden', {
      owner: 'testuser',
      repo: 'testrepo',
      operation: 'commit',
    });

    expect(enhanced.message).toBe('Access denied');
    expect(enhanced.action).toContain('testuser/testrepo');
    expect(enhanced.action).toContain('repo');
  });

  it('should enhance 404 not found errors for commits', () => {
    const enhanced = enhanceGitHubError('404 Not Found', {
      owner: 'testuser',
      repo: 'testrepo',
      operation: 'commit',
    });

    expect(enhanced.message).toBe('Repository not found');
    expect(enhanced.action).toContain('testuser/testrepo');
    expect(enhanced.link?.url).toBe('https://github.com/testuser/testrepo');
  });

  it('should enhance network errors', () => {
    const enhanced = enhanceGitHubError('Network request failed');

    expect(enhanced.message).toBe('Network error');
    expect(enhanced.action).toContain('internet connection');
  });

  it('should enhance rate limit errors', () => {
    const enhanced = enhanceGitHubError('Rate limit exceeded');

    expect(enhanced.message).toBe('GitHub API rate limit exceeded');
    expect(enhanced.action).toContain('Wait a few minutes');
    expect(enhanced.link?.url).toContain('rate-limit');
  });

  it('should handle conflict errors', () => {
    const enhanced = enhanceGitHubError('409 Conflict');

    expect(enhanced.message).toBe('Commit conflict detected');
    expect(enhanced.action).toContain('retry automatically');
  });

  it('should handle validation errors', () => {
    const enhanced = enhanceGitHubError('422 Validation Failed');

    expect(enhanced.message).toBe('Invalid request');
    expect(enhanced.action).toContain('branch name');
  });

  it('should handle generic errors', () => {
    const enhanced = enhanceGitHubError('Something went wrong');

    expect(enhanced.message).toBe('Something went wrong');
    expect(enhanced.action).toBeTruthy();
  });

  it('should handle Error objects', () => {
    const error = new Error('Network error');
    const enhanced = enhanceGitHubError(error);

    expect(enhanced.message).toBe('Network error');
    expect(enhanced.action).toContain('internet connection');
  });
});

describe('formatEnhancedError', () => {
  it('should format error with action', () => {
    const enhanced = {
      message: 'Authentication failed',
      action: 'Please check your token',
    };

    const formatted = formatEnhancedError(enhanced);

    expect(formatted).toBe('Authentication failed — Please check your token');
  });

  it('should format error without action', () => {
    const enhanced = {
      message: 'Something went wrong',
    };

    const formatted = formatEnhancedError(enhanced);

    expect(formatted).toBe('Something went wrong');
  });
});

describe('validateSettingsWithGuidance', () => {
  it('should validate valid settings', () => {
    const settings = {
      owner: 'testuser',
      repo: 'testrepo',
      branch: 'main',
      filename: 'variables.json',
    };

    const result = validateSettingsWithGuidance(settings);

    expect(result).toBeNull();
  });

  it('should require owner', () => {
    const settings = {
      owner: '',
      repo: 'testrepo',
      branch: 'main',
      filename: 'variables.json',
    };

    const result = validateSettingsWithGuidance(settings);

    expect(result).not.toBeNull();
    expect(result?.message).toBe('Repository owner is required');
    expect(result?.action).toContain('GitHub username');
  });

  it('should require repo', () => {
    const settings = {
      owner: 'testuser',
      repo: '',
      branch: 'main',
      filename: 'variables.json',
    };

    const result = validateSettingsWithGuidance(settings);

    expect(result).not.toBeNull();
    expect(result?.message).toBe('Repository name is required');
  });

  it('should require branch', () => {
    const settings = {
      owner: 'testuser',
      repo: 'testrepo',
      branch: '',
      filename: 'variables.json',
    };

    const result = validateSettingsWithGuidance(settings);

    expect(result).not.toBeNull();
    expect(result?.message).toBe('Branch name is required');
  });

  it('should require filename', () => {
    const settings = {
      owner: 'testuser',
      repo: 'testrepo',
      branch: 'main',
      filename: '',
    };

    const result = validateSettingsWithGuidance(settings);

    expect(result).not.toBeNull();
    expect(result?.message).toBe('Filename is required');
  });

  it('should require .json extension', () => {
    const settings = {
      owner: 'testuser',
      repo: 'testrepo',
      branch: 'main',
      filename: 'variables.txt',
    };

    const result = validateSettingsWithGuidance(settings);

    expect(result).not.toBeNull();
    expect(result?.message).toBe('Invalid filename');
    expect(result?.action).toContain('.json');
  });
});
