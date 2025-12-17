import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  fetchWithTimeout,
  fetchJsonWithTimeout,
  createFetchWithTimeout,
  getTimeoutFromEnv,
  TimeoutError,
  ShutdownAbortError,
  DEFAULT_TIMEOUTS,
} from "../http-client.js";
import { ShutdownManager, resetGlobalShutdownManager } from "../shutdown.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("DEFAULT_TIMEOUTS", () => {
  it("should have correct timeout values", () => {
    expect(DEFAULT_TIMEOUTS.VOYAGE_AI).toBe(30000);
    expect(DEFAULT_TIMEOUTS.LINEAR_API).toBe(10000);
    expect(DEFAULT_TIMEOUTS.GITHUB_API).toBe(10000);
    expect(DEFAULT_TIMEOUTS.OPENAI_API).toBe(30000);
    expect(DEFAULT_TIMEOUTS.DEFAULT).toBe(30000);
  });
});

describe("TimeoutError", () => {
  it("should create error with correct properties", () => {
    const error = new TimeoutError(5000, "https://api.example.com/test");
    expect(error.name).toBe("TimeoutError");
    expect(error.timeoutMs).toBe(5000);
    expect(error.url).toBe("https://api.example.com/test");
    expect(error.message).toBe("Request to https://api.example.com/test timed out after 5000ms");
  });

  it("should be instance of Error", () => {
    const error = new TimeoutError(1000, "https://test.com");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("ShutdownAbortError", () => {
  it("should create error with correct properties", () => {
    const error = new ShutdownAbortError("https://api.example.com/test");
    expect(error.name).toBe("ShutdownAbortError");
    expect(error.url).toBe("https://api.example.com/test");
    expect(error.message).toBe(
      "Request to https://api.example.com/test aborted due to server shutdown"
    );
  });

  it("should be instance of Error", () => {
    const error = new ShutdownAbortError("https://test.com");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("fetchWithTimeout", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetGlobalShutdownManager();
  });

  it("should successfully fetch with default timeout", async () => {
    const mockResponse = new Response(JSON.stringify({ data: "test" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    mockFetch.mockResolvedValue(mockResponse);

    const response = await fetchWithTimeout("https://api.example.com/test");

    expect(response).toBe(mockResponse);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/test",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("should pass through fetch options", async () => {
    const mockResponse = new Response("ok");
    mockFetch.mockResolvedValue(mockResponse);

    await fetchWithTimeout("https://api.example.com/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true }),
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/test",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: true }),
      })
    );
  });

  it("should use custom timeout", async () => {
    // Mock that respects abort signal - simulates slow request
    mockFetch.mockImplementation(
      (url: string, options?: RequestInit) =>
        new Promise((resolve, reject) => {
          const signal = options?.signal;
          if (signal) {
            if (signal.aborted) {
              reject(new DOMException("Aborted", "AbortError"));
              return;
            }
            signal.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }
          // Never resolves naturally - will be aborted
        })
    );

    // This should timeout
    await expect(
      fetchWithTimeout("https://api.example.com/test", { timeoutMs: 100 })
    ).rejects.toThrow(TimeoutError);
  }, 5000);

  it("should clean up timeout on successful response", async () => {
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
    const mockResponse = new Response("ok");
    mockFetch.mockResolvedValue(mockResponse);

    await fetchWithTimeout("https://api.example.com/test", {
      timeoutMs: 5000,
    });

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it("should throw TimeoutError when request times out", async () => {
    // Mock that respects abort signal - simulates slow request
    mockFetch.mockImplementation(
      (url: string, options?: RequestInit) =>
        new Promise((resolve, reject) => {
          const signal = options?.signal;
          if (signal) {
            if (signal.aborted) {
              reject(new DOMException("Aborted", "AbortError"));
              return;
            }
            signal.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }
        })
    );

    await expect(
      fetchWithTimeout("https://api.example.com/slow", { timeoutMs: 100 })
    ).rejects.toThrow(TimeoutError);
  }, 5000);

  it("should propagate fetch errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    await expect(fetchWithTimeout("https://api.example.com/test")).rejects.toThrow("Network error");
  });

  describe("with ShutdownManager", () => {
    let shutdownManager: ShutdownManager;

    beforeEach(() => {
      shutdownManager = new ShutdownManager({
        gracePeriodMs: 1000,
        exitAfterShutdown: false,
      });
    });

    afterEach(() => {
      shutdownManager.reset();
    });

    it("should track request with shutdown manager", async () => {
      const mockResponse = new Response("ok");
      mockFetch.mockResolvedValue(mockResponse);

      // Start with no pending requests
      expect(shutdownManager.getPendingRequestCount()).toBe(0);

      const fetchPromise = fetchWithTimeout("https://api.example.com/test", {
        shutdownManager,
      });

      // During request, should be tracked (hard to test timing)
      await fetchPromise;

      // After completion, should be untracked
      expect(shutdownManager.getPendingRequestCount()).toBe(0);
    });

    it("should throw ShutdownAbortError when shutdown is in progress", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});

      // Start shutdown
      void shutdownManager.shutdown();

      await expect(
        fetchWithTimeout("https://api.example.com/test", {
          shutdownManager,
        })
      ).rejects.toThrow(ShutdownAbortError);
    });

    it("should untrack request on timeout", async () => {
      // Mock that respects abort signal - simulates slow request
      mockFetch.mockImplementation(
        (url: string, options?: RequestInit) =>
          new Promise((resolve, reject) => {
            const signal = options?.signal;
            if (signal) {
              if (signal.aborted) {
                reject(new DOMException("Aborted", "AbortError"));
                return;
              }
              signal.addEventListener("abort", () => {
                reject(new DOMException("Aborted", "AbortError"));
              });
            }
          })
      );

      await expect(
        fetchWithTimeout("https://api.example.com/test", {
          timeoutMs: 100,
          shutdownManager,
        })
      ).rejects.toThrow(TimeoutError);

      expect(shutdownManager.getPendingRequestCount()).toBe(0);
    }, 5000);

    it("should untrack request on error", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(
        fetchWithTimeout("https://api.example.com/test", {
          shutdownManager,
        })
      ).rejects.toThrow("Network error");

      expect(shutdownManager.getPendingRequestCount()).toBe(0);
    });
  });
});

describe("fetchJsonWithTimeout", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("should parse JSON response", async () => {
    const mockData = { id: 1, name: "test" };
    const mockResponse = new Response(JSON.stringify(mockData), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    mockFetch.mockResolvedValue(mockResponse);

    const result = await fetchJsonWithTimeout<{ id: number; name: string }>(
      "https://api.example.com/test"
    );

    expect(result).toEqual(mockData);
  });

  it("should throw on non-ok response", async () => {
    const mockResponse = new Response("Not found", {
      status: 404,
      statusText: "Not Found",
    });
    mockFetch.mockResolvedValue(mockResponse);

    await expect(fetchJsonWithTimeout("https://api.example.com/test")).rejects.toThrow(
      "HTTP 404: Not found"
    );
  });

  it("should throw on JSON parse error", async () => {
    const mockResponse = new Response("invalid json", {
      status: 200,
    });
    mockFetch.mockResolvedValue(mockResponse);

    await expect(fetchJsonWithTimeout("https://api.example.com/test")).rejects.toThrow();
  });

  it("should pass timeout options", async () => {
    // Mock that respects abort signal - simulates slow request
    mockFetch.mockImplementation(
      (url: string, options?: RequestInit) =>
        new Promise((resolve, reject) => {
          const signal = options?.signal;
          if (signal) {
            if (signal.aborted) {
              reject(new DOMException("Aborted", "AbortError"));
              return;
            }
            signal.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }
        })
    );

    await expect(
      fetchJsonWithTimeout("https://api.example.com/test", { timeoutMs: 100 })
    ).rejects.toThrow(TimeoutError);
  }, 5000);
});

describe("createFetchWithTimeout", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("should create fetch function with preset timeout", async () => {
    const mockResponse = new Response("ok");
    mockFetch.mockResolvedValue(mockResponse);

    const customFetch = createFetchWithTimeout(5000);
    await customFetch("https://api.example.com/test");

    expect(mockFetch).toHaveBeenCalled();
  });

  it("should pass options through", async () => {
    const mockResponse = new Response("ok");
    mockFetch.mockResolvedValue(mockResponse);

    const customFetch = createFetchWithTimeout(5000);
    await customFetch("https://api.example.com/test", {
      method: "POST",
      headers: { Authorization: "Bearer token" },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/test",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer token" },
      })
    );
  });

  it("should use provided shutdown manager", async () => {
    const shutdownManager = new ShutdownManager({
      gracePeriodMs: 1000,
      exitAfterShutdown: false,
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    void shutdownManager.shutdown();

    const customFetch = createFetchWithTimeout(5000, shutdownManager);

    await expect(customFetch("https://api.example.com/test")).rejects.toThrow(ShutdownAbortError);

    shutdownManager.reset();
  });
});

describe("getTimeoutFromEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return default when env var not set", () => {
    delete process.env.TEST_TIMEOUT;
    const timeout = getTimeoutFromEnv("TEST_TIMEOUT", 5000);
    expect(timeout).toBe(5000);
  });

  it("should return parsed env var value", () => {
    process.env.TEST_TIMEOUT = "10000";
    const timeout = getTimeoutFromEnv("TEST_TIMEOUT", 5000);
    expect(timeout).toBe(10000);
  });

  it("should return default for invalid env var", () => {
    process.env.TEST_TIMEOUT = "invalid";
    const timeout = getTimeoutFromEnv("TEST_TIMEOUT", 5000);
    expect(timeout).toBe(5000);
  });

  it("should return default for negative env var", () => {
    process.env.TEST_TIMEOUT = "-100";
    const timeout = getTimeoutFromEnv("TEST_TIMEOUT", 5000);
    expect(timeout).toBe(5000);
  });

  it("should return default for zero env var", () => {
    process.env.TEST_TIMEOUT = "0";
    const timeout = getTimeoutFromEnv("TEST_TIMEOUT", 5000);
    expect(timeout).toBe(5000);
  });

  it("should return default for empty string env var", () => {
    process.env.TEST_TIMEOUT = "";
    const timeout = getTimeoutFromEnv("TEST_TIMEOUT", 5000);
    expect(timeout).toBe(5000);
  });
});
