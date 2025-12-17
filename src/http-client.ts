/**
 * HTTP Client with Timeout Support
 *
 * Provides fetchWithTimeout utility for making HTTP requests with
 * configurable timeouts and integration with ShutdownManager for
 * graceful request cancellation.
 */

import type { ShutdownManager } from "./shutdown.js";

/**
 * Default timeout values for different API endpoints (in milliseconds)
 */
export const DEFAULT_TIMEOUTS = {
  /** Voyage AI embedding API - 30 seconds */
  VOYAGE_AI: 30000,
  /** Linear GraphQL API - 10 seconds */
  LINEAR_API: 10000,
  /** GitHub REST API - 10 seconds */
  GITHUB_API: 10000,
  /** OpenAI API - 30 seconds (though OpenAI SDK handles this internally) */
  OPENAI_API: 30000,
  /** Default timeout for unspecified APIs - 30 seconds */
  DEFAULT: 30000,
} as const;

/**
 * Error thrown when a request times out
 */
export class TimeoutError extends Error {
  public readonly timeoutMs: number;
  public readonly url: string;

  constructor(timeoutMs: number, url: string) {
    super(`Request to ${url} timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
    this.timeoutMs = timeoutMs;
    this.url = url;
  }
}

/**
 * Error thrown when a request is aborted due to server shutdown
 */
export class ShutdownAbortError extends Error {
  public readonly url: string;

  constructor(url: string) {
    super(`Request to ${url} aborted due to server shutdown`);
    this.name = "ShutdownAbortError";
    this.url = url;
  }
}

/**
 * Options for fetchWithTimeout
 */
export interface FetchWithTimeoutOptions extends RequestInit {
  /** Timeout in milliseconds (default: DEFAULT_TIMEOUTS.DEFAULT) */
  timeoutMs?: number;
  /** Optional ShutdownManager for request tracking and cancellation */
  shutdownManager?: ShutdownManager;
}

/**
 * Fetch with timeout support and optional shutdown manager integration.
 *
 * Features:
 * - Configurable timeout via AbortController
 * - Integration with ShutdownManager for graceful cancellation
 * - Distinguishes between timeout errors and shutdown aborts
 * - Preserves original fetch behavior for successful requests
 *
 * @param url - The URL to fetch
 * @param options - Fetch options including timeout and shutdown manager
 * @returns Promise resolving to the Response
 * @throws TimeoutError if the request times out
 * @throws ShutdownAbortError if the request is aborted due to shutdown
 * @throws Error for other fetch failures
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUTS.DEFAULT, shutdownManager, ...fetchOptions } = options;

  // Create abort controller for timeout
  const controller = new AbortController();
  let isTimeout = false;

  // Track request with shutdown manager if provided
  if (shutdownManager) {
    if (shutdownManager.isShuttingDown()) {
      throw new ShutdownAbortError(url);
    }
    shutdownManager.trackRequest(controller);
  }

  // Set up timeout
  const timeoutId = setTimeout(() => {
    isTimeout = true;
    controller.abort(new TimeoutError(timeoutMs, url));
  }, timeoutMs);

  try {
    // Merge abort signals if user provided one
    const signal = fetchOptions.signal
      ? mergeAbortSignals(fetchOptions.signal, controller.signal)
      : controller.signal;

    const response = await fetch(url, {
      ...fetchOptions,
      signal,
    });

    return response;
  } catch (error) {
    // Handle abort errors
    if (error instanceof Error) {
      if (isTimeout) {
        throw new TimeoutError(timeoutMs, url);
      }
      if (error.name === "AbortError") {
        // Check if it was due to shutdown
        if (shutdownManager?.isShuttingDown()) {
          throw new ShutdownAbortError(url);
        }
        // User-initiated abort
        throw error;
      }
    }
    throw error;
  } finally {
    // Clean up timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    // Untrack request from shutdown manager
    if (shutdownManager) {
      shutdownManager.untrackRequest(controller);
    }
  }
}

/**
 * Merge multiple abort signals into one.
 * The merged signal aborts when any of the input signals abort.
 */
function mergeAbortSignals(signal1: AbortSignal, signal2: AbortSignal): AbortSignal {
  const controller = new AbortController();

  const abort = () => {
    controller.abort();
  };

  if (signal1.aborted || signal2.aborted) {
    abort();
  } else {
    signal1.addEventListener("abort", abort, { once: true });
    signal2.addEventListener("abort", abort, { once: true });
  }

  return controller.signal;
}

/**
 * Create a fetch function with pre-configured timeout for a specific API.
 *
 * @param timeoutMs - Default timeout for all requests
 * @param shutdownManager - Optional shutdown manager for request tracking
 * @returns A fetch function with the configured timeout
 */
export function createFetchWithTimeout(
  timeoutMs: number,
  shutdownManager?: ShutdownManager
): (url: string, options?: RequestInit) => Promise<Response> {
  return (url: string, options: RequestInit = {}) =>
    fetchWithTimeout(url, {
      ...options,
      timeoutMs,
      shutdownManager,
    });
}

/**
 * Fetch with JSON parsing and timeout support.
 *
 * @param url - The URL to fetch
 * @param options - Fetch options including timeout
 * @returns Promise resolving to parsed JSON
 * @throws TimeoutError if the request times out
 * @throws Error if response is not ok or JSON parsing fails
 */
export async function fetchJsonWithTimeout<T>(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<T> {
  const response = await fetchWithTimeout(url, options);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Get timeout from environment variable or use default.
 *
 * @param envVar - Environment variable name
 * @param defaultTimeout - Default timeout if env var not set
 * @returns Timeout in milliseconds
 */
export function getTimeoutFromEnv(envVar: string, defaultTimeout: number): number {
  const value = process.env[envVar];
  if (value) {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return defaultTimeout;
}
