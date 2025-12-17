import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { LogEntry } from "../logger.js";
import { createLogger } from "../logger.js";

describe("Logger", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    consoleErrorSpy.mockRestore();
  });

  describe("createLogger", () => {
    it("should create a logger with all log methods", () => {
      const logger = createLogger("test");
      expect(typeof logger.debug).toBe("function");
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.child).toBe("function");
    });

    it("should use provided module name", () => {
      process.env.LOG_LEVEL = "debug";
      const logger = createLogger("my-module");
      logger.info("test message");

      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls[0][0] as string;
      expect(output).toContain("[my-module]");
    });
  });

  describe("Log Levels", () => {
    it("should log all levels when LOG_LEVEL=debug", () => {
      process.env.LOG_LEVEL = "debug";
      const logger = createLogger("test");

      logger.debug("debug msg");
      logger.info("info msg");
      logger.warn("warn msg");
      logger.error("error msg");

      expect(consoleErrorSpy).toHaveBeenCalledTimes(4);
    });

    it("should filter debug when LOG_LEVEL=info", () => {
      process.env.LOG_LEVEL = "info";
      const logger = createLogger("test");

      logger.debug("debug msg");
      logger.info("info msg");
      logger.warn("warn msg");
      logger.error("error msg");

      expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
      const outputs = consoleErrorSpy.mock.calls.map((c) => c[0] as string);
      expect(outputs.some((o) => o.includes("debug msg"))).toBe(false);
    });

    it("should filter debug and info when LOG_LEVEL=warn", () => {
      process.env.LOG_LEVEL = "warn";
      const logger = createLogger("test");

      logger.debug("debug msg");
      logger.info("info msg");
      logger.warn("warn msg");
      logger.error("error msg");

      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    });

    it("should only log errors when LOG_LEVEL=error", () => {
      process.env.LOG_LEVEL = "error";
      const logger = createLogger("test");

      logger.debug("debug msg");
      logger.info("info msg");
      logger.warn("warn msg");
      logger.error("error msg");

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const output = consoleErrorSpy.mock.calls[0][0] as string;
      expect(output).toContain("error msg");
    });

    it("should default to info in production", () => {
      delete process.env.LOG_LEVEL;
      process.env.NODE_ENV = "production";
      const logger = createLogger("test");

      logger.debug("debug msg");
      logger.info("info msg");

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it("should default to debug in non-production", () => {
      delete process.env.LOG_LEVEL;
      process.env.NODE_ENV = "development";
      const logger = createLogger("test");

      logger.debug("debug msg");
      logger.info("info msg");

      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("Human-Readable Format", () => {
    beforeEach(() => {
      delete process.env.LOG_FORMAT;
      process.env.LOG_LEVEL = "debug";
    });

    it("should format with timestamp", () => {
      const logger = createLogger("test");
      logger.info("test message");

      const output = consoleErrorSpy.mock.calls[0][0] as string;
      // Should contain ISO timestamp pattern
      expect(output).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("should format with level uppercase", () => {
      const logger = createLogger("test");
      logger.warn("warning message");

      const output = consoleErrorSpy.mock.calls[0][0] as string;
      expect(output).toContain("WARN");
    });

    it("should format with module in brackets", () => {
      const logger = createLogger("my-module");
      logger.info("test message");

      const output = consoleErrorSpy.mock.calls[0][0] as string;
      expect(output).toContain("[my-module]");
    });

    it("should include context as JSON", () => {
      const logger = createLogger("test");
      logger.info("test message", { operation: "search", count: 10 });

      const output = consoleErrorSpy.mock.calls[0][0] as string;
      expect(output).toContain('"operation":"search"');
      expect(output).toContain('"count":10');
    });

    it("should format error with message and stack", () => {
      const logger = createLogger("test");
      const error = new Error("Something went wrong");
      logger.error("operation failed", error);

      const output = consoleErrorSpy.mock.calls[0][0] as string;
      expect(output).toContain("Error: Something went wrong");
      expect(output).toContain("Stack:");
    });
  });

  describe("JSON Format", () => {
    beforeEach(() => {
      process.env.LOG_FORMAT = "json";
      process.env.LOG_LEVEL = "debug";
    });

    it("should output valid JSON", () => {
      const logger = createLogger("test");
      logger.info("test message");

      const output = consoleErrorSpy.mock.calls[0][0] as string;
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it("should include all required fields", () => {
      const logger = createLogger("test-module");
      logger.info("test message");

      const entry: LogEntry = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(entry.timestamp).toBeDefined();
      expect(entry.level).toBe("info");
      expect(entry.message).toBe("test message");
      expect(entry.module).toBe("test-module");
    });

    it("should include context in JSON", () => {
      const logger = createLogger("test");
      logger.info("test message", { collection: "my-collection", count: 5 });

      const entry: LogEntry = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(entry.context?.collection).toBe("my-collection");
      expect(entry.context?.count).toBe(5);
    });

    it("should serialize error in JSON", () => {
      const logger = createLogger("test");
      const error = new Error("JSON error");
      error.name = "CustomError";
      logger.error("failed", error);

      const entry: LogEntry = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(entry.error?.name).toBe("CustomError");
      expect(entry.error?.message).toBe("JSON error");
      expect(entry.error?.stack).toBeDefined();
    });

    it("should not include context key if no context provided", () => {
      const logger = createLogger("test");
      logger.info("simple message");

      const entry: LogEntry = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(entry.context).toBeUndefined();
    });
  });

  describe("Error Logging", () => {
    beforeEach(() => {
      process.env.LOG_LEVEL = "debug";
    });

    it("should handle error with null", () => {
      const logger = createLogger("test");
      logger.error("error occurred", null);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls[0][0] as string;
      expect(output).not.toContain("Stack:");
    });

    it("should handle error with undefined", () => {
      const logger = createLogger("test");
      logger.error("error occurred", undefined);

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should include both error and context", () => {
      const logger = createLogger("test");
      const error = new Error("test error");
      logger.error("operation failed", error, { operation: "search" });

      const output = consoleErrorSpy.mock.calls[0][0] as string;
      expect(output).toContain("test error");
      expect(output).toContain("operation");
    });
  });

  describe("Context", () => {
    beforeEach(() => {
      process.env.LOG_LEVEL = "debug";
    });

    it("should handle empty context", () => {
      const logger = createLogger("test");
      logger.info("message", {});

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should handle context with module override", () => {
      const logger = createLogger("default-module");
      logger.info("message", { module: "override-module" });

      const output = consoleErrorSpy.mock.calls[0][0] as string;
      expect(output).toContain("[override-module]");
    });

    it("should handle complex context values", () => {
      process.env.LOG_FORMAT = "json";
      const logger = createLogger("test");
      logger.info("message", {
        array: [1, 2, 3],
        nested: { key: "value" },
        nullValue: null,
      });

      const entry: LogEntry = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(entry.context?.array).toEqual([1, 2, 3]);
      expect(entry.context?.nested).toEqual({ key: "value" });
    });
  });

  describe("Child Logger", () => {
    beforeEach(() => {
      process.env.LOG_LEVEL = "debug";
    });

    it("should create child logger with merged context", () => {
      const parent = createLogger("parent");
      const child = parent.child({ operation: "search" });

      child.info("child message");

      const output = consoleErrorSpy.mock.calls[0][0] as string;
      expect(output).toContain("operation");
    });

    it("should inherit parent module if not overridden", () => {
      const parent = createLogger("parent-module");
      const child = parent.child({ collection: "test" });

      child.info("child message");

      const output = consoleErrorSpy.mock.calls[0][0] as string;
      expect(output).toContain("[parent-module]");
    });

    it("should override parent module if specified", () => {
      const parent = createLogger("parent-module");
      const child = parent.child({ module: "child-module" });

      child.info("child message");

      const output = consoleErrorSpy.mock.calls[0][0] as string;
      expect(output).toContain("[child-module]");
    });

    it("should merge call-time context with child context", () => {
      process.env.LOG_FORMAT = "json";
      const parent = createLogger("test");
      const child = parent.child({ collection: "default-collection" });

      child.info("message", { count: 10 });

      const entry: LogEntry = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(entry.context?.collection).toBe("default-collection");
      expect(entry.context?.count).toBe(10);
    });

    it("should allow call-time context to override child context", () => {
      process.env.LOG_FORMAT = "json";
      const parent = createLogger("test");
      const child = parent.child({ collection: "default-collection" });

      child.info("message", { collection: "override-collection" });

      const entry: LogEntry = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(entry.context?.collection).toBe("override-collection");
    });

    it("should handle error in child logger", () => {
      const parent = createLogger("test");
      const child = parent.child({ operation: "persist" });
      const error = new Error("persist failed");

      child.error("operation failed", error);

      const output = consoleErrorSpy.mock.calls[0][0] as string;
      expect(output).toContain("persist failed");
    });
  });

  describe("Edge Cases", () => {
    beforeEach(() => {
      process.env.LOG_LEVEL = "debug";
    });

    it("should handle undefined LOG_LEVEL", () => {
      delete process.env.LOG_LEVEL;
      delete process.env.NODE_ENV;
      const logger = createLogger("test");
      logger.debug("debug message");

      // Should default to debug in development
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should handle invalid LOG_LEVEL", () => {
      process.env.LOG_LEVEL = "invalid";
      const logger = createLogger("test");
      logger.info("message");

      // Should fallback to default
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should handle logger without module", () => {
      const logger = createLogger();
      logger.info("message without module");

      const output = consoleErrorSpy.mock.calls[0][0] as string;
      expect(output).not.toContain("[undefined]");
    });

    it("should handle special characters in message", () => {
      const logger = createLogger("test");
      logger.info("message with 'quotes' and \"double quotes\"");

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should handle unicode in message", () => {
      const logger = createLogger("test");
      logger.info("message with unicode: \u4e2d\u6587 emoji: \ud83d\ude00");

      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls[0][0] as string;
      expect(output).toContain("\u4e2d\u6587");
    });

    it("should handle very long message", () => {
      const logger = createLogger("test");
      const longMessage = "x".repeat(10000);
      logger.info(longMessage);

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("Pre-configured Module Loggers", () => {
    it("should export pre-configured loggers", async () => {
      const {
        logger,
        qdrantLogger,
        bm25Logger,
        validationLogger,
        planModeLogger,
        shutdownLogger,
        configLogger,
        ignoreFilterLogger,
      } = await import("../logger.js");

      expect(logger).toBeDefined();
      expect(qdrantLogger).toBeDefined();
      expect(bm25Logger).toBeDefined();
      expect(validationLogger).toBeDefined();
      expect(planModeLogger).toBeDefined();
      expect(shutdownLogger).toBeDefined();
      expect(configLogger).toBeDefined();
      expect(ignoreFilterLogger).toBeDefined();
    });
  });
});
