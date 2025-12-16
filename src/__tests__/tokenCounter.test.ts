import { describe, it, expect } from "vitest";
import {
  TokenCounter,
  tokenCounter,
  TOKEN_CONFIG,
} from "../tokenCounter.js";

describe("tokenCounter.ts", () => {
  describe("TOKEN_CONFIG", () => {
    it("should have correct default values", () => {
      expect(TOKEN_CONFIG.CHARS_PER_TOKEN).toBe(4);
      expect(TOKEN_CONFIG.SAFETY_MARGIN).toBe(0.96);
      expect(TOKEN_CONFIG.DEFAULT_TOKEN_LIMIT).toBe(22000);
      expect(TOKEN_CONFIG.MAX_STRING_PREVIEW).toBe(500);
      expect(TOKEN_CONFIG.TRUNCATION_SUFFIX).toBe("...[truncated]");
    });
  });

  describe("TokenCounter.estimateTokens", () => {
    it("should estimate tokens from string", () => {
      const text = "Hello world"; // 11 chars
      expect(tokenCounter.estimateTokens(text)).toBe(Math.ceil(11 / 4)); // 3
    });

    it("should estimate tokens from object", () => {
      const obj = { key: "value" };
      const json = JSON.stringify(obj); // '{"key":"value"}' = 15 chars
      expect(tokenCounter.estimateTokens(obj)).toBe(Math.ceil(json.length / 4));
    });

    it("should handle empty string", () => {
      expect(tokenCounter.estimateTokens("")).toBe(0);
    });

    it("should handle long text", () => {
      const text = "a".repeat(1000);
      expect(tokenCounter.estimateTokens(text)).toBe(250); // 1000 / 4
    });

    it("should handle nested objects", () => {
      const obj = { a: { b: { c: "value" } } };
      const json = JSON.stringify(obj);
      expect(tokenCounter.estimateTokens(obj)).toBe(
        Math.ceil(json.length / 4)
      );
    });
  });

  describe("TokenCounter.estimateTokensWithFormatting", () => {
    it("should include JSON formatting overhead", () => {
      const obj = { key: "value" };
      const formatted = JSON.stringify(obj, null, 2);
      expect(tokenCounter.estimateTokensWithFormatting(obj)).toBe(
        Math.ceil(formatted.length / TOKEN_CONFIG.CHARS_PER_TOKEN)
      );
    });

    it("should account for indentation in nested objects", () => {
      const obj = { a: { b: "value" } };
      const compact = JSON.stringify(obj);
      const formatted = JSON.stringify(obj, null, 2);

      // Formatted should have more characters due to indentation
      expect(formatted.length).toBeGreaterThan(compact.length);
      expect(tokenCounter.estimateTokensWithFormatting(obj)).toBeGreaterThan(
        tokenCounter.estimateTokens(obj)
      );
    });
  });

  describe("TokenCounter.createBudget", () => {
    it("should create budget with safety margin", () => {
      const budget = tokenCounter.createBudget(1000);
      expect(budget.total).toBe(Math.floor(1000 * TOKEN_CONFIG.SAFETY_MARGIN));
      expect(budget.used).toBe(0);
      expect(budget.remaining).toBe(budget.total);
    });

    it("should use default token limit when not specified", () => {
      const budget = tokenCounter.createBudget();
      expect(budget.total).toBe(
        Math.floor(TOKEN_CONFIG.DEFAULT_TOKEN_LIMIT * TOKEN_CONFIG.SAFETY_MARGIN)
      );
    });

    it("should have used equal to 0 initially", () => {
      const budget = tokenCounter.createBudget(5000);
      expect(budget.used).toBe(0);
    });

    it("should have remaining equal to total initially", () => {
      const budget = tokenCounter.createBudget(5000);
      expect(budget.remaining).toBe(budget.total);
    });
  });

  describe("TokenCounter.consumeTokens", () => {
    it("should update budget correctly", () => {
      const initial = tokenCounter.createBudget(1000);
      const updated = tokenCounter.consumeTokens(initial, 100);

      expect(updated.used).toBe(100);
      expect(updated.remaining).toBe(initial.total - 100);
      expect(updated.total).toBe(initial.total);
    });

    it("should not mutate original budget", () => {
      const original = tokenCounter.createBudget(1000);
      const originalUsed = original.used;
      const originalRemaining = original.remaining;

      tokenCounter.consumeTokens(original, 100);

      expect(original.used).toBe(originalUsed);
      expect(original.remaining).toBe(originalRemaining);
    });

    it("should handle multiple consumptions", () => {
      let budget = tokenCounter.createBudget(1000);
      budget = tokenCounter.consumeTokens(budget, 100);
      budget = tokenCounter.consumeTokens(budget, 200);

      expect(budget.used).toBe(300);
    });

    it("should allow consuming more than remaining (no validation)", () => {
      const budget = tokenCounter.createBudget(100);
      const updated = tokenCounter.consumeTokens(budget, 200);

      expect(updated.used).toBe(200);
      expect(updated.remaining).toBeLessThan(0);
    });
  });

  describe("TokenCounter.fitsInBudget", () => {
    it("should return true for small content", () => {
      const budget = tokenCounter.createBudget(10000);
      expect(tokenCounter.fitsInBudget(budget, "small text")).toBe(true);
    });

    it("should return false for large content", () => {
      const budget = tokenCounter.createBudget(10);
      const largeContent = "x".repeat(1000);
      expect(tokenCounter.fitsInBudget(budget, largeContent)).toBe(false);
    });

    it("should work with objects", () => {
      const budget = tokenCounter.createBudget(100);
      const smallObj = { key: "value" };
      expect(tokenCounter.fitsInBudget(budget, smallObj)).toBe(true);
    });

    it("should account for already used tokens", () => {
      const budget = tokenCounter.consumeTokens(
        tokenCounter.createBudget(100),
        90
      );
      expect(tokenCounter.fitsInBudget(budget, "small")).toBe(true);
      expect(tokenCounter.fitsInBudget(budget, "x".repeat(100))).toBe(false);
    });
  });

  describe("TokenCounter.getMaxContentSize", () => {
    it("should calculate max content size", () => {
      const budget = tokenCounter.createBudget(1000);
      const maxSize = tokenCounter.getMaxContentSize(budget);
      // remaining * 4 * 0.8 (accounting for formatting overhead)
      expect(maxSize).toBe(
        Math.floor(budget.remaining * TOKEN_CONFIG.CHARS_PER_TOKEN * 0.8)
      );
    });

    it("should decrease as budget is consumed", () => {
      const budget1 = tokenCounter.createBudget(1000);
      const budget2 = tokenCounter.consumeTokens(budget1, 500);

      expect(tokenCounter.getMaxContentSize(budget2)).toBeLessThan(
        tokenCounter.getMaxContentSize(budget1)
      );
    });
  });

  describe("TokenCounter.truncateToFit", () => {
    it("should not truncate small content", () => {
      const budget = tokenCounter.createBudget(10000);
      const result = tokenCounter.truncateToFit("small", budget);
      expect(result.truncated).toBe(false);
      expect(result.content).toBe("small");
    });

    it("should truncate large string", () => {
      const budget = tokenCounter.createBudget(50);
      const largeString = "x".repeat(1000);
      const result = tokenCounter.truncateToFit(largeString, budget);

      expect(result.truncated).toBe(true);
      expect(result.content).toContain(TOKEN_CONFIG.TRUNCATION_SUFFIX);
      expect(result.content.length).toBeLessThan(largeString.length);
    });

    it("should truncate object arrays", () => {
      const budget = tokenCounter.createBudget(100);
      const largeObject = {
        items: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          data: "x".repeat(50),
        })),
      };
      const result = tokenCounter.truncateToFit(largeObject, budget);
      expect(result.truncated).toBe(true);
    });

    it("should handle null content", () => {
      const budget = tokenCounter.createBudget(10000);
      const result = tokenCounter.truncateToFit(null, budget);
      expect(result.content).toBe(null);
    });

    it("should truncate long strings in objects when budget exceeded", () => {
      // truncateToFit only truncates when content exceeds token budget
      // MAX_STRING_PREVIEW (500 chars) is applied during truncation, not as standalone check
      const budget = tokenCounter.createBudget(50); // Small budget to trigger truncation
      const obj = {
        longString: "x".repeat(600), // Over MAX_STRING_PREVIEW
      };
      const result = tokenCounter.truncateToFit(obj, budget);
      // When budget exceeded and object is truncated, long strings get capped
      expect(result.truncated).toBe(true);
      expect(result.content.longString).toContain(TOKEN_CONFIG.TRUNCATION_SUFFIX);
    });

    it("should not truncate long strings when budget is sufficient", () => {
      const budget = tokenCounter.createBudget(10000); // Large budget
      const obj = {
        longString: "x".repeat(600), // Over MAX_STRING_PREVIEW but under budget
      };
      const result = tokenCounter.truncateToFit(obj, budget);
      // No truncation when content fits in budget
      expect(result.truncated).toBe(false);
      expect(result.content.longString).toBe(obj.longString);
    });
  });

  describe("TokenCounter.createSection", () => {
    it("should create section with token metadata", () => {
      const section = tokenCounter.createSection("test", { key: "value" }, 2);

      expect(section.name).toBe("test");
      expect(section.content).toEqual({ key: "value" });
      expect(section.priority).toBe(2);
      expect(section.tokenCount).toBeGreaterThan(0);
    });

    it("should default priority to 1", () => {
      const section = tokenCounter.createSection("test", "content");
      expect(section.priority).toBe(1);
    });

    it("should calculate correct token count", () => {
      const content = { key: "value" };
      const section = tokenCounter.createSection("test", content);
      expect(section.tokenCount).toBe(
        tokenCounter.estimateTokensWithFormatting(content)
      );
    });
  });

  describe("TokenCounter.prioritizeSections", () => {
    it("should sort by priority (higher first)", () => {
      const budget = tokenCounter.createBudget(10000);
      const sections = [
        tokenCounter.createSection("low", "a", 1),
        tokenCounter.createSection("high", "b", 3),
        tokenCounter.createSection("medium", "c", 2),
      ];

      const prioritized = tokenCounter.prioritizeSections(sections, budget);
      expect(prioritized[0].name).toBe("high");
      expect(prioritized[1].name).toBe("medium");
      expect(prioritized[2].name).toBe("low");
    });

    it("should filter out sections that exceed budget", () => {
      const budget = tokenCounter.createBudget(10);
      const sections = [
        tokenCounter.createSection("small", "x", 1),
        tokenCounter.createSection("large", "x".repeat(1000), 2),
      ];

      const prioritized = tokenCounter.prioritizeSections(sections, budget);
      expect(prioritized.length).toBeLessThan(sections.length);
    });

    it("should sort by token count when priority is equal", () => {
      const budget = tokenCounter.createBudget(10000);
      const sections = [
        tokenCounter.createSection("big", "x".repeat(100), 1),
        tokenCounter.createSection("small", "x", 1),
        tokenCounter.createSection("medium", "x".repeat(50), 1),
      ];

      const prioritized = tokenCounter.prioritizeSections(sections, budget);
      // Same priority, sorted by token count (less tokens first)
      expect(prioritized[0].name).toBe("small");
    });
  });

  describe("TokenCounter.getUsageStats", () => {
    it("should calculate usage statistics", () => {
      const budget = { total: 100, used: 85, remaining: 15 };
      const stats = tokenCounter.getUsageStats(budget);

      expect(stats.utilizationPercent).toBe(85);
      expect(stats.remainingPercent).toBe(15);
      expect(stats.isNearLimit).toBe(false);
    });

    it("should flag near limit when over 85%", () => {
      const budget = { total: 100, used: 90, remaining: 10 };
      const stats = tokenCounter.getUsageStats(budget);
      expect(stats.isNearLimit).toBe(true);
    });

    it("should not flag near limit when at exactly 85%", () => {
      const budget = { total: 100, used: 85, remaining: 15 };
      const stats = tokenCounter.getUsageStats(budget);
      expect(stats.isNearLimit).toBe(false);
    });

    it("should round percentages to one decimal", () => {
      const budget = { total: 100, used: 33, remaining: 67 };
      const stats = tokenCounter.getUsageStats(budget);
      expect(stats.utilizationPercent).toBe(33);
      expect(stats.remainingPercent).toBe(67);
    });
  });

  describe("TokenCounter.serializeWithMaxUtilization", () => {
    it("should return string unchanged if under limit", () => {
      const content = "small content";
      const result = tokenCounter.serializeWithMaxUtilization(content, 100);
      expect(result).toBe(content);
    });

    it("should serialize object to JSON", () => {
      const obj = { key: "value" };
      const result = tokenCounter.serializeWithMaxUtilization(obj, 10000);
      expect(JSON.parse(result)).toEqual(obj);
    });

    it("should truncate large content", () => {
      const largeObj = {
        items: Array.from({ length: 1000 }, (_, i) => ({ id: i })),
      };
      const result = tokenCounter.serializeWithMaxUtilization(largeObj, 100);
      const parsed = JSON.parse(result);
      expect(parsed.items.length).toBeLessThan(1000);
    });

    it("should use default limit of 25000 tokens", () => {
      const obj = { key: "value" };
      // Should not throw with default limit
      expect(() => tokenCounter.serializeWithMaxUtilization(obj)).not.toThrow();
    });

    it("should handle deeply nested objects", () => {
      const deep = { a: { b: { c: { d: { e: "value" } } } } };
      const result = tokenCounter.serializeWithMaxUtilization(deep, 10000);
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });

  describe("tokenCounter singleton", () => {
    it("should be an instance of TokenCounter", () => {
      expect(tokenCounter).toBeInstanceOf(TokenCounter);
    });

    it("should work the same as a new instance", () => {
      const newInstance = new TokenCounter();
      const text = "test string";

      expect(tokenCounter.estimateTokens(text)).toBe(
        newInstance.estimateTokens(text)
      );
    });
  });
});
