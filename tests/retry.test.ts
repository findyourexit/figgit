/**
 * Tests for retry utility with exponential backoff.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry } from '../src/util/retry';

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should succeed on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await withRetry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue('success');

    const promise = withRetry(fn, { maxAttempts: 3, initialDelay: 100 });

    // Advance through delays
    await vi.advanceTimersByTimeAsync(100); // First retry delay
    await vi.advanceTimersByTimeAsync(200); // Second retry delay (exponential)

    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Persistent error'));

    const promise = withRetry(fn, { maxAttempts: 2, initialDelay: 100 });

    // Advance through delay
    const advancePromise = vi.advanceTimersByTimeAsync(100);

    await expect(Promise.race([promise, advancePromise])).rejects.toThrow('Persistent error');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should use exponential backoff', async () => {
    const delays: number[] = [];
    const fn = vi.fn().mockRejectedValue(new Error('Network error'));

    const promise = withRetry(fn, {
      maxAttempts: 3,
      initialDelay: 100,
      backoffMultiplier: 2,
      onRetry: (_error, _attempt, delay) => {
        delays.push(delay);
      },
    });

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);

    await expect(promise).rejects.toThrow('Network error');

    expect(delays).toEqual([100, 200]);
  });

  it('should respect maxDelay', async () => {
    const delays: number[] = [];
    const fn = vi.fn().mockRejectedValue(new Error('Network error'));

    const promise = withRetry(fn, {
      maxAttempts: 4,
      initialDelay: 1000,
      backoffMultiplier: 10,
      maxDelay: 2000,
      onRetry: (_error, _attempt, delay) => {
        delays.push(delay);
      },
    });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000); // Capped at maxDelay
    await vi.advanceTimersByTimeAsync(2000); // Capped at maxDelay

    await expect(promise).rejects.toThrow('Network error');

    expect(delays).toEqual([1000, 2000, 2000]); // Third delay capped at 2000, not 10000
  });

  it('should call onRetry callback', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn().mockRejectedValue(new Error('Network error'));

    const promise = withRetry(fn, {
      maxAttempts: 2,
      initialDelay: 100,
      onRetry,
    });

    await vi.advanceTimersByTimeAsync(100);

    await expect(promise).rejects.toThrow('Network error');

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, 100);
  });

  it('should not retry on client errors by default', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('401 Unauthorized'));

    const promise = withRetry(fn, { maxAttempts: 3 });

    await expect(promise).rejects.toThrow('401 Unauthorized');
    expect(fn).toHaveBeenCalledTimes(1); // No retries
  });

  it('should retry on 409 conflicts', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('409 Conflict'))
      .mockResolvedValue('success');

    const promise = withRetry(fn, { maxAttempts: 2, initialDelay: 100 });

    await vi.advanceTimersByTimeAsync(100);

    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should retry on rate limit errors', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Rate limit exceeded'))
      .mockResolvedValue('success');

    const promise = withRetry(fn, { maxAttempts: 2, initialDelay: 100 });

    await vi.advanceTimersByTimeAsync(100);

    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should respect custom shouldRetry', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Custom error'));
    const shouldRetry = vi.fn().mockReturnValue(false);

    const promise = withRetry(fn, {
      maxAttempts: 3,
      shouldRetry,
    });

    await expect(promise).rejects.toThrow('Custom error');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error), 1);
  });

  it('should handle non-Error rejections', async () => {
    const fn = vi.fn().mockRejectedValue('String error');

    const promise = withRetry(fn, { maxAttempts: 2, initialDelay: 100 });

    await vi.advanceTimersByTimeAsync(100);

    await expect(promise).rejects.toThrow('String error');
  });
});
