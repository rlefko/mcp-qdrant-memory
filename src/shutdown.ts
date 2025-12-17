/**
 * Graceful Shutdown Manager for MCP Server
 *
 * Handles SIGTERM/SIGINT signals with cleanup callbacks and
 * pending request cancellation for graceful process termination.
 */

import { shutdownLogger } from "./logger.js";

export interface ShutdownOptions {
  /** Grace period in milliseconds before forced exit (default: 10000) */
  gracePeriodMs?: number;
  /** Whether to call process.exit after shutdown (default: true) */
  exitAfterShutdown?: boolean;
  /** Exit code to use on shutdown (default: 0) */
  exitCode?: number;
}

const DEFAULT_OPTIONS: Required<ShutdownOptions> = {
  gracePeriodMs: 10000,
  exitAfterShutdown: true,
  exitCode: 0,
};

export class ShutdownManager {
  private shuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;
  private pendingRequests = new Set<AbortController>();
  private cleanupCallbacks: Array<() => Promise<void>> = [];
  private options: Required<ShutdownOptions>;
  private signalHandlersInstalled = false;

  constructor(options: ShutdownOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Register a cleanup callback to be executed during shutdown.
   * Callbacks are executed in registration order.
   */
  register(callback: () => Promise<void>): void {
    if (this.shuttingDown) {
      shutdownLogger.warn("Cannot register callback during shutdown");
      return;
    }
    this.cleanupCallbacks.push(callback);
  }

  /**
   * Unregister a previously registered cleanup callback.
   */
  unregister(callback: () => Promise<void>): boolean {
    const index = this.cleanupCallbacks.indexOf(callback);
    if (index !== -1) {
      this.cleanupCallbacks.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Track a pending request's AbortController for cancellation on shutdown.
   */
  trackRequest(controller: AbortController): void {
    if (this.shuttingDown) {
      // Immediately abort new requests during shutdown
      controller.abort(new Error("Server is shutting down"));
      return;
    }
    this.pendingRequests.add(controller);
  }

  /**
   * Untrack a completed request's AbortController.
   */
  untrackRequest(controller: AbortController): void {
    this.pendingRequests.delete(controller);
  }

  /**
   * Check if shutdown is in progress.
   */
  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  /**
   * Get the number of pending requests being tracked.
   */
  getPendingRequestCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Get the number of registered cleanup callbacks.
   */
  getCleanupCallbackCount(): number {
    return this.cleanupCallbacks.length;
  }

  /**
   * Install signal handlers for SIGTERM and SIGINT.
   * Should be called once during server initialization.
   */
  installSignalHandlers(): void {
    if (this.signalHandlersInstalled) {
      shutdownLogger.warn("Signal handlers already installed");
      return;
    }

    const handleSignal = (signal: string) => {
      shutdownLogger.info("Received signal, initiating graceful shutdown", { signal });
      this.shutdown(signal).catch((error) => {
        shutdownLogger.error("Shutdown error", error instanceof Error ? error : null);
        process.exit(1);
      });
    };

    process.on("SIGTERM", () => handleSignal("SIGTERM"));
    process.on("SIGINT", () => handleSignal("SIGINT"));

    this.signalHandlersInstalled = true;
  }

  /**
   * Initiate graceful shutdown.
   *
   * 1. Set shuttingDown flag to reject new requests
   * 2. Cancel all pending requests via AbortController
   * 3. Execute cleanup callbacks in order
   * 4. Wait for grace period or completion
   * 5. Exit process (if configured)
   */
  async shutdown(signal?: string): Promise<void> {
    // Prevent multiple shutdown calls
    if (this.shuttingDown && this.shutdownPromise) {
      return this.shutdownPromise;
    }

    this.shuttingDown = true;
    this.shutdownPromise = this.performShutdown(signal);

    return this.shutdownPromise;
  }

  private async performShutdown(signal?: string): Promise<void> {
    const startTime = Date.now();
    shutdownLogger.info("Starting shutdown", { signal });

    // Step 1: Cancel all pending requests
    const pendingCount = this.pendingRequests.size;
    if (pendingCount > 0) {
      shutdownLogger.info("Cancelling pending requests", { count: pendingCount });
      for (const controller of this.pendingRequests) {
        try {
          controller.abort(new Error("Server shutdown"));
        } catch {
          // AbortController may already be aborted
        }
      }
      this.pendingRequests.clear();
    }

    // Step 2: Execute cleanup callbacks with timeout
    const cleanupCount = this.cleanupCallbacks.length;
    if (cleanupCount > 0) {
      shutdownLogger.info("Executing cleanup callbacks", { count: cleanupCount });

      const cleanupPromises = this.cleanupCallbacks.map(async (callback, index) => {
        try {
          await callback();
          shutdownLogger.debug("Cleanup callback completed", {
            current: index + 1,
            total: cleanupCount,
          });
        } catch (error) {
          shutdownLogger.error("Cleanup callback failed", error instanceof Error ? error : null, {
            current: index + 1,
            total: cleanupCount,
          });
        }
      });

      // Wait for all cleanup callbacks with grace period timeout
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          shutdownLogger.warn("Grace period expired, forcing exit");
          resolve();
        }, this.options.gracePeriodMs);
      });

      await Promise.race([Promise.all(cleanupPromises), timeoutPromise]);
    }

    const elapsed = Date.now() - startTime;
    shutdownLogger.info("Shutdown completed", { duration_ms: elapsed });

    // Step 3: Exit process if configured
    if (this.options.exitAfterShutdown) {
      process.exit(this.options.exitCode);
    }
  }

  /**
   * Reset the shutdown manager state (primarily for testing).
   */
  reset(): void {
    this.shuttingDown = false;
    this.shutdownPromise = null;
    this.pendingRequests.clear();
    this.cleanupCallbacks = [];
  }
}

// Global singleton instance for easy access
let globalShutdownManager: ShutdownManager | null = null;

/**
 * Get or create the global ShutdownManager instance.
 */
export function getShutdownManager(options?: ShutdownOptions): ShutdownManager {
  if (!globalShutdownManager) {
    globalShutdownManager = new ShutdownManager(options);
  }
  return globalShutdownManager;
}

/**
 * Reset the global ShutdownManager (primarily for testing).
 */
export function resetGlobalShutdownManager(): void {
  if (globalShutdownManager) {
    globalShutdownManager.reset();
  }
  globalShutdownManager = null;
}
