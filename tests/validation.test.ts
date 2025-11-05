import { describe, it, expect } from 'vitest';
import {
  validateGitHubOwner,
  validateGitHubRepo,
  validateBranchName,
  validateFolderPath,
  validateFilename,
  validateAllSettings,
} from '../src/util/validation';

describe('validation', () => {
  describe('validateGitHubOwner', () => {
    it('should return valid for valid owner names', () => {
      expect(validateGitHubOwner('octocat')).toEqual({ valid: true });
      expect(validateGitHubOwner('my-org')).toEqual({ valid: true });
      expect(validateGitHubOwner('Company123')).toEqual({ valid: true });
    });

    it('should reject empty owner names', () => {
      const result = validateGitHubOwner('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Owner is required');
    });

    it('should reject owner names with invalid characters', () => {
      const result = validateGitHubOwner('my org');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid owner format');
    });

    it('should reject owner names starting with dash', () => {
      const result = validateGitHubOwner('-myorg');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid owner format');
    });

    it('should reject owner names that are too long', () => {
      const longOwner = 'a'.repeat(40);
      const result = validateGitHubOwner(longOwner);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Owner name too long (max 39 characters)');
    });
  });

  describe('validateGitHubRepo', () => {
    it('should return valid for valid repo names', () => {
      expect(validateGitHubRepo('my-repo')).toEqual({ valid: true });
      expect(validateGitHubRepo('project_name')).toEqual({ valid: true });
      expect(validateGitHubRepo('repo.config')).toEqual({ valid: true });
      expect(validateGitHubRepo('repo123')).toEqual({ valid: true });
    });

    it('should reject empty repo names', () => {
      const result = validateGitHubRepo('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Repository name is required');
    });

    it('should reject repo names with invalid characters', () => {
      const result = validateGitHubRepo('my repo');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid repository format');
    });

    it('should reject repo names that are too long', () => {
      const longRepo = 'a'.repeat(101);
      const result = validateGitHubRepo(longRepo);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Repository name too long (max 100 characters)');
    });
  });

  describe('validateBranchName', () => {
    it('should return valid for valid branch names', () => {
      expect(validateBranchName('main')).toEqual({ valid: true });
      expect(validateBranchName('feature/new-feature')).toEqual({ valid: true });
      expect(validateBranchName('bugfix-123')).toEqual({ valid: true });
      expect(validateBranchName('release_v1.0')).toEqual({ valid: true });
    });

    it('should reject empty branch names', () => {
      const result = validateBranchName('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Branch name is required');
    });

    it('should reject branch names starting with dash', () => {
      const result = validateBranchName('-branch');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid branch name format');
    });

    it('should reject branch names ending with .lock', () => {
      const result = validateBranchName('feature.lock');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid branch name format');
    });

    it('should reject branch names with double dots', () => {
      const result = validateBranchName('feature..name');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid branch name format');
    });

    it('should reject branch names that are too long', () => {
      const longBranch = 'a'.repeat(256);
      const result = validateBranchName(longBranch);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Branch name too long (max 255 characters)');
    });
  });

  describe('validateFolderPath', () => {
    it('should return valid for valid folder paths', () => {
      expect(validateFolderPath('config')).toEqual({ valid: true });
      expect(validateFolderPath('src/config')).toEqual({ valid: true });
      expect(validateFolderPath('path/to/folder')).toEqual({ valid: true });
    });

    it('should return valid for empty folder (optional)', () => {
      expect(validateFolderPath('')).toEqual({ valid: true });
      expect(validateFolderPath('  ')).toEqual({ valid: true });
    });

    it('should reject folder paths with path traversal', () => {
      const result = validateFolderPath('../config');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid folder path (no path traversal)');
    });

    it('should reject folder paths with invalid characters', () => {
      const result = validateFolderPath('folder@name');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid folder path');
    });
  });

  describe('validateFilename', () => {
    it('should return valid for valid filenames', () => {
      expect(validateFilename('variables.json')).toEqual({ valid: true });
      expect(validateFilename('config-file.json')).toEqual({ valid: true });
      expect(validateFilename('data_export.json')).toEqual({ valid: true });
      expect(validateFilename('DATA.JSON')).toEqual({ valid: true }); // Case-insensitive
    });

    it('should reject empty filenames', () => {
      const result = validateFilename('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Filename is required');
    });

    it('should reject filenames without .json extension', () => {
      const result = validateFilename('variables.txt');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Filename must end with .json');
    });

    it('should reject filenames with invalid characters', () => {
      const result = validateFilename('my file.json');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Filename must end with .json');
    });

    it('should reject filenames with path traversal', () => {
      const result = validateFilename('../file.json');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid filename (no path traversal)');
    });

    it('should reject filenames with double slashes', () => {
      const result = validateFilename('path//file.json');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid filename (no path traversal)');
    });
  });

  describe('validateAllSettings', () => {
    const validSettings = {
      owner: 'octocat',
      repo: 'my-repo',
      branch: 'main',
      folder: 'config',
      filename: 'variables.json',
    };

    it('should return valid for valid settings', () => {
      const result = validateAllSettings(validSettings);
      expect(result).toEqual({ valid: true });
    });

    it('should return first validation error encountered', () => {
      const invalidSettings = {
        owner: '', // Invalid
        repo: 'my-repo',
        branch: 'main',
        filename: 'variables.json',
      };

      const result = validateAllSettings(invalidSettings);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Owner is required');
    });

    it('should validate repo when owner is valid', () => {
      const settingsWithInvalidRepo = {
        owner: 'octocat',
        repo: '', // Invalid
        branch: 'main',
        filename: 'variables.json',
      };

      const result = validateAllSettings(settingsWithInvalidRepo);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Repository name is required');
    });

    it('should validate filename', () => {
      const settingsWithInvalidFilename = {
        owner: 'octocat',
        repo: 'my-repo',
        branch: 'main',
        filename: 'notjson.txt',
      };

      const result = validateAllSettings(settingsWithInvalidFilename);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Filename must end with .json');
    });

    it('should validate folder when provided', () => {
      const settingsWithInvalidFolder = {
        owner: 'octocat',
        repo: 'my-repo',
        branch: 'main',
        filename: 'variables.json',
        folder: '../invalid',
      };

      const result = validateAllSettings(settingsWithInvalidFolder);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid folder path (no path traversal)');
    });

    it('should allow optional folder to be omitted', () => {
      const settingsWithoutFolder = {
        owner: 'octocat',
        repo: 'my-repo',
        branch: 'main',
        filename: 'variables.json',
      };

      const result = validateAllSettings(settingsWithoutFolder);
      expect(result).toEqual({ valid: true });
    });
  });
});
