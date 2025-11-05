/**
 * Tests for custom React hooks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotifications } from '../src/ui/hooks';
import { useSettings } from '../src/ui/hooks';
import { useExport } from '../src/ui/hooks';
import { useCommit } from '../src/ui/hooks';
import { useGitHub } from '../src/ui/hooks';
import { useNetworkStatus } from '../src/ui/hooks';

describe('useNotifications', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should add and auto-dismiss notifications', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.notify('info', 'Test message');
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].message).toBe('Test message');
    expect(result.current.notifications[0].level).toBe('info');

    // Fast-forward time by 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('should handle multiple notifications', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.notify('info', 'First');
      result.current.notify('error', 'Second');
    });

    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.notifications[0].message).toBe('First');
    expect(result.current.notifications[1].message).toBe('Second');
  });

  it('should manually dismiss notifications', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.notify('info', 'Test');
    });

    const notificationId = result.current.notifications[0].id;

    act(() => {
      result.current.dismiss(notificationId);
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('should clear all notifications', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.notify('info', 'First');
      result.current.notify('error', 'Second');
      result.current.notify('info', 'Third');
    });

    expect(result.current.notifications).toHaveLength(3);

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.notifications).toHaveLength(0);
  });
});

describe('useSettings', () => {
  it('should initialize with null settings', () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current.settings).toBeNull();
    expect(result.current.tokenPresent).toBe(false);
  });

  it('should update settings', () => {
    const { result } = renderHook(() => useSettings());

    const mockSettings = {
      owner: 'test-owner',
      repo: 'test-repo',
      branch: 'main',
      folder: '',
      filename: 'variables.json',
      commitPrefix: '',
      dryRun: false,
      lastHash: undefined,
      tokenPresent: false,
    };

    act(() => {
      result.current.loadSettings(mockSettings);
    });

    expect(result.current.settings).toEqual(mockSettings);
    expect(result.current.tokenPresent).toBe(false);
  });

  it('should partially update settings', () => {
    const { result } = renderHook(() => useSettings());

    const initialSettings = {
      owner: 'test-owner',
      repo: 'test-repo',
      branch: 'main',
      folder: '',
      filename: 'variables.json',
      commitPrefix: '',
      dryRun: false,
      lastHash: undefined,
      tokenPresent: false,
    };

    act(() => {
      result.current.loadSettings(initialSettings);
    });

    act(() => {
      result.current.updateSettings({ owner: 'new-owner', branch: 'develop' });
    });

    expect(result.current.settings?.owner).toBe('new-owner');
    expect(result.current.settings?.branch).toBe('develop');
    expect(result.current.settings?.repo).toBe('test-repo'); // unchanged
  });
});

describe('useExport', () => {
  it('should initialize with loading false', () => {
    const { result } = renderHook(() => useExport());

    expect(result.current.exportState.loading).toBe(false);
    expect(result.current.exportState.data).toBeUndefined();
    expect(result.current.exportState.error).toBeUndefined();
  });

  it('should handle export start', () => {
    const { result } = renderHook(() => useExport());

    act(() => {
      result.current.startExport();
    });

    expect(result.current.exportState.loading).toBe(true);
  });

  it('should handle export success', () => {
    const { result } = renderHook(() => useExport());

    const mockData = {
      meta: {
        exportedAt: new Date().toISOString(),
        fileName: 'test.fig',
        pluginVersion: '1.0.0',
        figmaFileId: 'abc123',
        variablesCount: 10,
        collectionsCount: 2,
        contentHash: 'abc123',
      },
      collections: [],
    };

    act(() => {
      result.current.exportSuccess(mockData);
    });

    expect(result.current.exportState.loading).toBe(false);
    expect(result.current.exportState.data).toEqual(mockData);
    expect(result.current.exportState.error).toBeUndefined();
  });

  it('should handle export error', () => {
    const { result } = renderHook(() => useExport());

    act(() => {
      result.current.exportError('Export failed');
    });

    expect(result.current.exportState.loading).toBe(false);
    expect(result.current.exportState.error).toBe('Export failed');
  });

  it('should toggle preview', () => {
    const { result } = renderHook(() => useExport());

    expect(result.current.previewCollapsed).toBe(true);

    act(() => {
      result.current.togglePreview();
    });

    expect(result.current.previewCollapsed).toBe(false);

    act(() => {
      result.current.togglePreview();
    });

    expect(result.current.previewCollapsed).toBe(true);
  });
});

describe('useCommit', () => {
  it('should initialize with inProgress false', () => {
    const { result } = renderHook(() => useCommit());

    expect(result.current.commitState.inProgress).toBe(false);
  });

  it('should handle commit start', () => {
    const { result } = renderHook(() => useCommit());

    act(() => {
      result.current.startCommit();
    });

    expect(result.current.commitState.inProgress).toBe(true);
  });

  it('should handle commit success', () => {
    const { result } = renderHook(() => useCommit());

    act(() => {
      result.current.commitSuccess(false, 'https://github.com/test/repo/commit/abc123');
    });

    expect(result.current.commitState.inProgress).toBe(false);
    expect(result.current.commitState.success).toBe(true);
    expect(result.current.commitState.skipped).toBe(false);
    expect(result.current.commitState.url).toBe('https://github.com/test/repo/commit/abc123');
  });

  it('should handle commit error', () => {
    const { result } = renderHook(() => useCommit());

    act(() => {
      result.current.commitError('Commit failed');
    });

    expect(result.current.commitState.inProgress).toBe(false);
    expect(result.current.commitState.error).toBe('Commit failed');
  });
});

describe('useGitHub', () => {
  it('should initialize with empty token input', () => {
    const { result } = renderHook(() => useGitHub());

    expect(result.current.tokenInput).toBe('');
    expect(result.current.tokenValidation.status).toBe('idle');
  });

  it('should update token input', () => {
    const { result } = renderHook(() => useGitHub());

    act(() => {
      result.current.updateTokenInput('ghp_test123');
    });

    expect(result.current.tokenInput).toBe('ghp_test123');
  });

  it('should handle validation states', () => {
    const { result } = renderHook(() => useGitHub());

    act(() => {
      result.current.setValidationChecking();
    });

    expect(result.current.tokenValidation.status).toBe('checking');

    act(() => {
      result.current.setValidationValid('testuser');
    });

    expect(result.current.tokenValidation.status).toBe('valid');
    expect(result.current.tokenValidation.login).toBe('testuser');

    act(() => {
      result.current.setValidationInvalid('Invalid token');
    });

    expect(result.current.tokenValidation.status).toBe('invalid');
    expect(result.current.tokenValidation.error).toBe('Invalid token');
  });
});

describe('useNetworkStatus', () => {
  it('should detect online status', () => {
    const { result } = renderHook(() => useNetworkStatus());

    // Initial state should be online (navigator.onLine default)
    expect(result.current.isOnline).toBe(navigator.onLine);
  });

  it('should respond to offline event', () => {
    const { result } = renderHook(() => useNetworkStatus());

    // Simulate going offline
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.isOnline).toBe(false);
  });

  it('should respond to online event', () => {
    const { result } = renderHook(() => useNetworkStatus());

    // Simulate going online
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current.isOnline).toBe(true);
  });
});
