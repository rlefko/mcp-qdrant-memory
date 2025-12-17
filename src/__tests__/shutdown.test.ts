import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ShutdownManager, getShutdownManager, resetGlobalShutdownManager } from "../shutdown.js";

describe("ShutdownManager", () => {
  let manager: ShutdownManager;

  beforeEach(() => {
    // Create a fresh manager for each test with exitAfterShutdown disabled
    manager = new ShutdownManager({
      gracePeriodMs: 1000,
      exitAfterShutdown: false,
    });
  });

  afterEach(() => {
    manager.reset();
    resetGlobalShutdownManager();
    vi.restoreAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with default options", () => {
      const defaultManager = new ShutdownManager();
      expect(defaultManager.isShuttingDown()).toBe(false);
      expect(defaultManager.getPendingRequestCount()).toBe(0);
      expect(defaultManager.getCleanupCallbackCount()).toBe(0);
    });

    it("should accept custom options", () => {
      const customManager = new ShutdownManager({
        gracePeriodMs: 5000,
        exitAfterShutdown: false,
        exitCode: 1,
      });
      expect(customManager.isShuttingDown()).toBe(false);
    });
  });

  describe("cleanup callback registration", () => {
    it("should register cleanup callbacks", () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      manager.register(callback);
      expect(manager.getCleanupCallbackCount()).toBe(1);
    });

    it("should register multiple cleanup callbacks", () => {
      const callback1 = vi.fn().mockResolvedValue(undefined);
      const callback2 = vi.fn().mockResolvedValue(undefined);
      manager.register(callback1);
      manager.register(callback2);
      expect(manager.getCleanupCallbackCount()).toBe(2);
    });

    it("should unregister cleanup callbacks", () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      manager.register(callback);
      expect(manager.getCleanupCallbackCount()).toBe(1);

      const result = manager.unregister(callback);
      expect(result).toBe(true);
      expect(manager.getCleanupCallbackCount()).toBe(0);
    });

    it("should return false when unregistering non-existent callback", () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      const result = manager.unregister(callback);
      expect(result).toBe(false);
    });

    it("should not register callbacks during shutdown", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const callback = vi.fn().mockResolvedValue(undefined);

      // Start shutdown
      void manager.shutdown();

      // Try to register during shutdown
      manager.register(callback);
      expect(manager.getCleanupCallbackCount()).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        "[ShutdownManager] Cannot register callback during shutdown"
      );
    });
  });

  describe("request tracking", () => {
    it("should track pending requests", () => {
      const controller = new AbortController();
      manager.trackRequest(controller);
      expect(manager.getPendingRequestCount()).toBe(1);
    });

    it("should track multiple pending requests", () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();
      manager.trackRequest(controller1);
      manager.trackRequest(controller2);
      expect(manager.getPendingRequestCount()).toBe(2);
    });

    it("should untrack completed requests", () => {
      const controller = new AbortController();
      manager.trackRequest(controller);
      expect(manager.getPendingRequestCount()).toBe(1);

      manager.untrackRequest(controller);
      expect(manager.getPendingRequestCount()).toBe(0);
    });

    it("should immediately abort new requests during shutdown", async () => {
      const controller = new AbortController();

      // Start shutdown
      void manager.shutdown();

      // Track request during shutdown - should be immediately aborted
      manager.trackRequest(controller);
      expect(controller.signal.aborted).toBe(true);
      expect(manager.getPendingRequestCount()).toBe(0);
    });
  });

  describe("shutdown state", () => {
    it("should initially not be shutting down", () => {
      expect(manager.isShuttingDown()).toBe(false);
    });

    it("should be shutting down after shutdown is called", async () => {
      void manager.shutdown();
      expect(manager.isShuttingDown()).toBe(true);
    });

    it("should remain shutting down until reset", async () => {
      await manager.shutdown();
      expect(manager.isShuttingDown()).toBe(true);

      manager.reset();
      expect(manager.isShuttingDown()).toBe(false);
    });
  });

  describe("shutdown execution", () => {
    it("should execute cleanup callbacks during shutdown", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const callback = vi.fn().mockResolvedValue(undefined);
      manager.register(callback);

      await manager.shutdown();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should execute cleanup callbacks in order", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const callOrder: number[] = [];
      const callback1 = vi.fn().mockImplementation(async () => {
        callOrder.push(1);
      });
      const callback2 = vi.fn().mockImplementation(async () => {
        callOrder.push(2);
      });
      const callback3 = vi.fn().mockImplementation(async () => {
        callOrder.push(3);
      });

      manager.register(callback1);
      manager.register(callback2);
      manager.register(callback3);

      await manager.shutdown();

      expect(callOrder).toEqual([1, 2, 3]);
    });

    it("should cancel pending requests during shutdown", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      manager.trackRequest(controller1);
      manager.trackRequest(controller2);

      await manager.shutdown();

      expect(controller1.signal.aborted).toBe(true);
      expect(controller2.signal.aborted).toBe(true);
      expect(manager.getPendingRequestCount()).toBe(0);
    });

    it("should continue if cleanup callback throws", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const errorCallback = vi.fn().mockRejectedValue(new Error("Cleanup error"));
      const successCallback = vi.fn().mockResolvedValue(undefined);

      manager.register(errorCallback);
      manager.register(successCallback);

      await manager.shutdown();

      expect(errorCallback).toHaveBeenCalledTimes(1);
      expect(successCallback).toHaveBeenCalledTimes(1);
    });

    it("should only execute shutdown once for multiple calls", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const callback = vi.fn().mockResolvedValue(undefined);
      manager.register(callback);

      // Call shutdown multiple times in parallel
      await Promise.all([manager.shutdown(), manager.shutdown(), manager.shutdown()]);

      // Callback should only be called once
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should log shutdown progress", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await manager.shutdown("TEST_SIGNAL");

      expect(consoleSpy).toHaveBeenCalledWith(
        "[ShutdownManager] Starting shutdown (signal: TEST_SIGNAL)..."
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[ShutdownManager\] Shutdown completed in \d+ms/)
      );
    });

    it("should include signal name in log if provided", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await manager.shutdown("SIGTERM");

      expect(consoleSpy).toHaveBeenCalledWith(
        "[ShutdownManager] Starting shutdown (signal: SIGTERM)..."
      );
    });
  });

  describe("grace period", () => {
    it("should respect grace period for slow callbacks", async () => {
      vi.useFakeTimers();
      vi.spyOn(console, "error").mockImplementation(() => {});

      const slowCallback = vi
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 5000)));

      manager.register(slowCallback);

      const shutdownPromise = manager.shutdown();

      // Fast forward past grace period (1000ms)
      await vi.advanceTimersByTimeAsync(1100);

      await shutdownPromise;

      expect(slowCallback).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe("reset", () => {
    it("should reset all state", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const callback = vi.fn().mockResolvedValue(undefined);
      const controller = new AbortController();

      manager.register(callback);
      manager.trackRequest(controller);
      await manager.shutdown();

      manager.reset();

      expect(manager.isShuttingDown()).toBe(false);
      expect(manager.getPendingRequestCount()).toBe(0);
      expect(manager.getCleanupCallbackCount()).toBe(0);
    });
  });

  describe("signal handlers", () => {
    it("should install signal handlers only once", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const processSpy = vi.spyOn(process, "on").mockImplementation(() => process);

      manager.installSignalHandlers();
      manager.installSignalHandlers();

      // Should warn about duplicate installation
      expect(consoleSpy).toHaveBeenCalledWith(
        "[ShutdownManager] Signal handlers already installed"
      );

      // Should only call process.on twice (SIGTERM and SIGINT) for first install
      expect(processSpy).toHaveBeenCalledTimes(2);
    });
  });
});

describe("Global ShutdownManager", () => {
  afterEach(() => {
    resetGlobalShutdownManager();
  });

  it("should return singleton instance", () => {
    const instance1 = getShutdownManager();
    const instance2 = getShutdownManager();
    expect(instance1).toBe(instance2);
  });

  it("should create new instance with options on first call", () => {
    const instance = getShutdownManager({ gracePeriodMs: 5000 });
    expect(instance).toBeInstanceOf(ShutdownManager);
  });

  it("should reset global instance", () => {
    const instance1 = getShutdownManager();
    resetGlobalShutdownManager();
    const instance2 = getShutdownManager();
    expect(instance1).not.toBe(instance2);
  });
});
