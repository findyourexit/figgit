/**
 * Retry utility with exponential backoff for network operations.
 *
 * Automatically retries failed GitHub API requests with increasing delays
 * to handle transient network issues and GitHub API rate limiting.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number;
  /** Maximum delay between retries in milliseconds (default: 10000) */
  maxDelay?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Function to determine if error should be retried (default: retry all) */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** Callback function called before each retry */
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}

/**
 * Delays execution for the specified number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Default retry logic - retries on network errors and 5xx server errors.
 * Does not retry on client errors (4xx) as these usually require user intervention.
 */
function defaultShouldRetry(error: Error, _attempt: number): boolean {
  const errorMsg = error.message.toLowerCase();

  // Always retry network errors
  if (
    errorMsg.includes('network') ||
    errorMsg.includes('fetch') ||
    errorMsg.includes('timeout') ||
    errorMsg.includes('econnrefused')
  ) {
    return true;
  }

  // Retry on 5xx server errors and 429 rate limiting
  if (errorMsg.includes('50') || errorMsg.includes('429') || errorMsg.includes('rate limit')) {
    return true;
  }

  // Retry on 409 conflicts (concurrent updates)
  if (errorMsg.includes('409') || errorMsg.includes('conflict')) {
    return true;
  }

  // Don't retry on client errors (401, 403, 404, 422, etc.)
  if (
    errorMsg.includes('401') ||
    errorMsg.includes('403') ||
    errorMsg.includes('404') ||
    errorMsg.includes('422') ||
    errorMsg.includes('unauthorized') ||
    errorMsg.includes('forbidden') ||
    errorMsg.includes('not found')
  ) {
    return false;
  }

  // Retry other errors if we haven't exceeded max attempts
  return true;
}

/**
 * Executes a function with automatic retry logic and exponential backoff.
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to the function's return value
 * @throws The last error if all retries fail
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *   async () => {
 *     const res = await fetch('https://api.github.com/user', { headers: {...} });
 *     if (!res.ok) throw new Error(`Status ${res.status}`);
 *     return res.json();
 *   },
 *   {
 *     maxAttempts: 3,
 *     onRetry: (error, attempt, delay) => {
 *       console.log(`Retry ${attempt} after ${delay}ms: ${error.message}`);
 *     }
 *   }
 * );
 * ```
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = options;

  let lastError: Error;
  let currentDelay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If this is the last attempt, throw the error
      if (attempt >= maxAttempts) {
        throw lastError;
      }

      // Check if we should retry this error
      if (!shouldRetry(lastError, attempt)) {
        throw lastError;
      }

      // Call retry callback if provided
      if (onRetry) {
        onRetry(lastError, attempt, currentDelay);
      }

      // Wait before retrying
      await delay(currentDelay);

      // Increase delay for next attempt (exponential backoff)
      currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelay);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError!;
}
