#!/usr/bin/env node

/**
 * Comprehensive test for streaming response and token management
 * Validates streaming response implementation with token limits
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("🧪 Starting Streaming Token Management Tests...\n");

/**
 * Base test framework with assertion helpers
 */
class TestRunner {
  constructor(suiteName) {
    this.suiteName = suiteName;
    this.tests = [];
    this.results = { passed: 0, failed: 0, total: 0 };
  }

  test(description, testFn) {
    this.tests.push({ description, testFn });
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message || "Assertion failed");
    }
  }

  assertEquals(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }

  assertIncludes(array, item, message) {
    if (!array.includes(item)) {
      throw new Error(message || `Expected array to include ${item}`);
    }
  }

  async run() {
    console.log(`\n📋 Running ${this.suiteName}...\n`);

    for (const { description, testFn } of this.tests) {
      this.results.total++;
      try {
        await testFn.call(this);
        this.results.passed++;
        console.log(`  ✅ ${description}`);
      } catch (error) {
        this.results.failed++;
        console.log(`  ❌ ${description}`);
        console.log(`     ${error.message}`);
      }
    }

    this.printSummary();
  }

  printSummary() {
    const { passed, failed, total } = this.results;
    const successRate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;

    console.log(`\n📊 ${this.suiteName} Results:`);
    console.log(`   Total: ${total}`);
    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Success Rate: ${successRate}%\n`);
  }
}

/**
 * Test data generators
 */
const TestData = {
  createMockEntity(name, type = "class", observations = []) {
    return {
      name,
      entityType: type,
      observations: observations.length
        ? observations
        : [
            `Defined in: ${name.toLowerCase()}.py`,
            `Line: ${Math.floor(Math.random() * 1000)}`,
            `Description: Mock ${type} for testing`,
          ],
    };
  },

  createMockRelation(from, to, type = "contains") {
    return { from, to, relationType: type };
  },

  generateLargeDataset(entityCount = 1000, relationCount = 2000) {
    const entities = [];
    const relations = [];

    for (let i = 0; i < entityCount; i++) {
      entities.push(this.createMockEntity(`Entity${i}`, "class"));
    }

    for (let i = 0; i < relationCount; i++) {
      relations.push(
        this.createMockRelation(
          `Entity${i % entityCount}`,
          `Entity${(i + 1) % entityCount}`,
          ["contains", "imports", "inherits", "uses"][i % 4]
        )
      );
    }

    return { entities, relations };
  },
};

/**
 * Test suites
 */
async function runAllTests() {
  try {
    // Import the modules under test
    const { tokenCounter, TOKEN_CONFIG } = await import("./dist/tokenCounter.js");
    const { streamingResponseBuilder } = await import("./dist/streamingResponseBuilder.js");

    // Test Suite 1: Token Counter Tests
    const tokenTests = new TestRunner("Token Counter Tests");

    tokenTests.test("should estimate tokens correctly", function () {
      const text = "Hello world test string";
      const tokens = tokenCounter.estimateTokens(text);
      this.assertEquals(tokens, Math.ceil(text.length / TOKEN_CONFIG.CHARS_PER_TOKEN));
    });

    tokenTests.test("should create budget with safety margin", function () {
      const limit = 1000;
      const budget = tokenCounter.createBudget(limit);
      this.assertEquals(budget.total, Math.floor(limit * TOKEN_CONFIG.SAFETY_MARGIN));
      this.assertEquals(budget.used, 0);
      this.assertEquals(budget.remaining, budget.total);
    });

    tokenTests.test("should truncate strings correctly", function () {
      const longString = "a".repeat(1000);
      const budget = tokenCounter.createBudget(100);
      const result = tokenCounter.truncateToFit(longString, budget);

      this.assert(result.truncated, "Should be truncated");
      this.assert(result.content.endsWith(TOKEN_CONFIG.TRUNCATION_SUFFIX));
      this.assert(tokenCounter.fitsInBudget(budget, result.content));
    });

    await tokenTests.run();

    // Test Suite 2: Streaming Response Builder Tests
    const responseTests = new TestRunner("Streaming Response Builder Tests");

    responseTests.test("should build smart response within token limit", async function () {
      const { entities, relations } = TestData.generateLargeDataset(100, 200);
      const result = await streamingResponseBuilder.buildStreamingResponse(entities, relations, {
        mode: "smart",
      });

      this.assert(result.meta.tokenCount <= result.meta.tokenLimit);
      this.assert(result.meta.sectionsIncluded.length > 0);
      this.assertIncludes(result.meta.sectionsIncluded, "summary");
    });

    responseTests.test("should handle entities mode with filtering", async function () {
      const { entities, relations } = TestData.generateLargeDataset(50, 100);
      const result = await streamingResponseBuilder.buildStreamingResponse(entities, relations, {
        mode: "entities",
        entityTypes: ["class"],
        limit: 10,
      });

      this.assert(result.content.entities.length <= 10);
      this.assert(result.content.entities.every((e) => e.entityType === "class"));
    });

    responseTests.test("should truncate large relationships response", async function () {
      const { entities, relations } = TestData.generateLargeDataset(10, 5000);
      const result = await streamingResponseBuilder.buildStreamingResponse(entities, relations, {
        mode: "relationships",
      });

      this.assert(result.meta.truncated, "Should be truncated");
      this.assert(result.meta.truncationReason.includes("Reduced from"));
      this.assert(result.content.relations.length < 5000);
    });

    responseTests.test("should reject raw mode when too large", async function () {
      const { entities, relations } = TestData.generateLargeDataset(1000, 5000);
      const result = await streamingResponseBuilder.buildStreamingResponse(entities, relations, {
        mode: "raw",
      });

      this.assert(result.meta.truncated);
      this.assertEquals(result.content.entities.length, 0);
      this.assertEquals(result.content.relations.length, 0);
      this.assert(result.meta.truncationReason.includes("Raw response too large"));
    });

    await responseTests.run();

    // Test Suite 3: Integration Tests
    const integrationTests = new TestRunner("Integration Tests");

    integrationTests.test("should prioritize sections correctly", async function () {
      const { entities, relations } = TestData.generateLargeDataset(500, 1000);
      const result = await streamingResponseBuilder.buildStreamingResponse(entities, relations, {
        mode: "smart",
        limit: 20,
      });

      // Summary should always be included
      this.assertIncludes(result.meta.sectionsIncluded, "summary");

      // If truncated, lower priority sections should be excluded
      if (result.meta.truncated) {
        const sectionOrder = ["summary", "apiSurface", "structure", "dependencies", "relations"];
        const includedIndex = result.meta.sectionsIncluded
          .map((s) => s.replace(" (truncated)", ""))
          .map((s) => sectionOrder.indexOf(s))
          .filter((i) => i >= 0);

        // Verify sections are in priority order
        for (let i = 1; i < includedIndex.length; i++) {
          this.assert(
            includedIndex[i] >= includedIndex[i - 1],
            "Sections should be in priority order"
          );
        }
      }
    });

    await integrationTests.run();

    // Summary
    console.log("\n✅ All streaming token management tests completed!\n");
  } catch (error) {
    console.error("\n❌ Test suite failed:", error);
    process.exit(1);
  }
}

// Run tests
runAllTests();
