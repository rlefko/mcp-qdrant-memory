#!/usr/bin/env node

/**
 * Edge case and integration tests for streaming token management
 * Tests boundary conditions, error handling, and complex scenarios
 */

import { tokenCounter, TOKEN_CONFIG } from "./dist/tokenCounter.js";
import { streamingResponseBuilder } from "./dist/streamingResponseBuilder.js";

// Shared test utilities
const TestUtils = {
  /**
   * Create entities with specific token sizes
   */
  createSizedEntity(name, targetTokens) {
    const baseObservation = `Defined in: ${name}.py`;
    const padding = "x".repeat(
      Math.max(0, targetTokens * TOKEN_CONFIG.CHARS_PER_TOKEN - baseObservation.length)
    );
    return {
      name,
      entityType: "class",
      observations: [baseObservation + padding],
    };
  },

  /**
   * Create a dataset that exactly fills the token limit
   */
  createExactLimitDataset(tokenLimit = TOKEN_CONFIG.DEFAULT_TOKEN_LIMIT) {
    const overhead = 200; // JSON structure overhead
    const entityTokens = 50;
    const entityCount = Math.floor((tokenLimit - overhead) / entityTokens);

    return {
      entities: Array.from({ length: entityCount }, (_, i) =>
        this.createSizedEntity(`Entity${i}`, entityTokens)
      ),
      relations: [],
    };
  },

  /**
   * Assert deep equality with better error messages
   */
  assertDeepEqual(actual, expected, path = "") {
    if (typeof actual !== typeof expected) {
      throw new Error(`Type mismatch at ${path}: ${typeof actual} !== ${typeof expected}`);
    }

    if (typeof actual === "object" && actual !== null) {
      const actualKeys = Object.keys(actual).sort();
      const expectedKeys = Object.keys(expected).sort();

      if (actualKeys.length !== expectedKeys.length) {
        throw new Error(
          `Key count mismatch at ${path}: ${actualKeys.length} !== ${expectedKeys.length}`
        );
      }

      for (const key of actualKeys) {
        this.assertDeepEqual(actual[key], expected[key], `${path}.${key}`);
      }
    } else if (actual !== expected) {
      throw new Error(`Value mismatch at ${path}: ${actual} !== ${expected}`);
    }
  },
};

/**
 * Edge case test scenarios
 */
const EdgeCaseTests = {
  async testEmptyDataset() {
    console.log("\n🧪 Test: Empty dataset handling");
    const result = await streamingResponseBuilder.buildStreamingResponse([], [], { mode: "smart" });

    if (result.meta.tokenCount > 100) {
      throw new Error("Empty dataset generated too many tokens");
    }

    if (!result.meta.sectionsIncluded.includes("summary")) {
      throw new Error("Summary should always be included");
    }

    console.log("  ✅ Empty dataset handled correctly");
  },

  async testSingleLargeEntity() {
    console.log("\n🧪 Test: Single large entity truncation");
    const largeEntity = TestUtils.createSizedEntity("LargeEntity", 30000);
    const result = await streamingResponseBuilder.buildStreamingResponse([largeEntity], [], {
      mode: "entities",
    });

    if (!result.meta.truncated) {
      throw new Error("Large entity should be truncated");
    }

    if (result.meta.tokenCount > result.meta.tokenLimit) {
      throw new Error("Token limit exceeded");
    }

    console.log("  ✅ Large entity truncated correctly");
  },

  async testExactTokenLimit() {
    console.log("\n🧪 Test: Exact token limit boundary");
    const { entities, relations } = TestUtils.createExactLimitDataset();
    const result = await streamingResponseBuilder.buildStreamingResponse(entities, relations, {
      mode: "entities",
    });

    const utilization = result.meta.tokenCount / result.meta.tokenLimit;
    if (utilization < 0.8 || utilization > 1.0) {
      throw new Error(`Poor token utilization: ${(utilization * 100).toFixed(1)}%`);
    }

    console.log(`  ✅ Token utilization: ${(utilization * 100).toFixed(1)}%`);
  },

  async testMixedEntityTypes() {
    console.log("\n🧪 Test: Mixed entity type filtering");
    const entities = [
      { name: "Class1", entityType: "class", observations: ["Test class"] },
      { name: "func1", entityType: "function", observations: ["Test function"] },
      { name: "var1", entityType: "variable", observations: ["Test variable"] },
      { name: "Class2", entityType: "class", observations: ["Another class"] },
    ];

    const result = await streamingResponseBuilder.buildStreamingResponse(entities, [], {
      mode: "entities",
      entityTypes: ["class"],
      limit: 10,
    });

    const filteredTypes = new Set(result.content.entities.map((e) => e.entityType));
    if (filteredTypes.size !== 1 || !filteredTypes.has("class")) {
      throw new Error("Entity type filtering failed");
    }

    console.log("  ✅ Entity type filtering works correctly");
  },

  async testCascadingTruncation() {
    console.log("\n🧪 Test: Cascading section truncation");

    // Create dataset that will force progressive truncation
    const entities = Array.from({ length: 1000 }, (_, i) => ({
      name: `Entity${i}`,
      entityType: "class",
      observations: [
        `Defined in: very/long/path/to/module${i}.py`,
        `Line: ${i * 10}`,
        "A".repeat(500), // Very long observation to force truncation
      ],
    }));

    const relations = Array.from({ length: 2000 }, (_, i) => ({
      from: `Entity${i % 1000}`,
      to: `Entity${(i + 1) % 1000}`,
      relationType: "contains",
    }));

    const result = await streamingResponseBuilder.buildStreamingResponse(entities, relations, {
      mode: "smart",
    });

    // Check if response is actually truncated or at high utilization
    const utilization = result.meta.tokenCount / result.meta.tokenLimit;
    if (!result.meta.truncated && utilization < 0.95) {
      throw new Error(
        `Expected truncation or high utilization, got ${(utilization * 100).toFixed(1)}%`
      );
    }

    // Verify priority order is maintained
    const sectionPriority = {
      summary: 5,
      apiSurface: 4,
      structure: 3,
      dependencies: 2,
      relations: 1,
    };

    const includedSections = result.meta.sectionsIncluded.map((s) => s.replace(" (truncated)", ""));

    let lastPriority = 6;
    for (const section of includedSections) {
      const priority = sectionPriority[section] || 0;
      if (priority > lastPriority) {
        throw new Error(`Section ${section} included out of priority order`);
      }
      lastPriority = priority;
    }

    console.log("  ✅ Cascading truncation maintains priority order");
    console.log(`     Sections: ${result.meta.sectionsIncluded.join(" → ")}`);
  },

  async testErrorRecovery() {
    console.log("\n🧪 Test: Error recovery handling");

    // Test with invalid mode
    const result = await streamingResponseBuilder.buildStreamingResponse([], [], {
      mode: "invalid-mode",
    });

    if (!result.meta.truncationReason?.includes("Error")) {
      throw new Error("Invalid mode should produce error response");
    }

    console.log("  ✅ Error recovery works correctly");
  },

  async testTokenCounterEdgeCases() {
    console.log("\n🧪 Test: Token counter edge cases");

    // Test with various content types
    const testCases = [
      { input: "", expected: 0 },
      { input: "a", expected: 1 },
      { input: "test", expected: 1 },
      { input: "a".repeat(100), expected: 25 },
      { input: { nested: { deep: { object: "value" } } }, expectedMin: 10 },
    ];

    for (const { input, expected, expectedMin } of testCases) {
      const tokens = tokenCounter.estimateTokens(input);
      if (expected !== undefined && tokens !== expected) {
        throw new Error(
          `Token estimation failed for "${JSON.stringify(input)}": ${tokens} !== ${expected}`
        );
      }
      if (expectedMin !== undefined && tokens < expectedMin) {
        throw new Error(`Token estimation too low for object: ${tokens} < ${expectedMin}`);
      }
    }

    console.log("  ✅ Token counter handles edge cases correctly");
  },
};

/**
 * Integration test scenarios
 */
const IntegrationTests = {
  async testFullWorkflow() {
    console.log("\n🧪 Test: Full integration workflow");

    // Simulate real-world data structure
    const entities = [
      {
        name: "QdrantClient",
        entityType: "class",
        observations: [
          "Defined in: src/persistence/qdrant.ts",
          "Line: 45",
          "Main client for interacting with Qdrant vector database",
        ],
      },
      {
        name: "TokenCounter",
        entityType: "class",
        observations: [
          "Defined in: src/tokenCounter.ts",
          "Line: 8",
          "Utility class for counting and managing tokens",
        ],
      },
      {
        name: "buildStreamingResponse",
        entityType: "function",
        observations: [
          "Defined in: src/streamingResponseBuilder.ts",
          "Line: 15",
          "Signature: async (entities: Entity[], relations: Relation[], options: ScrollOptions): Promise<StreamingGraphResponse>",
          "Main entry point for building streaming responses with token management",
        ],
      },
    ];

    const relations = [
      { from: "QdrantClient", to: "qdrant", relationType: "imports" },
      { from: "TokenCounter", to: "types", relationType: "imports" },
      { from: "buildStreamingResponse", to: "TokenCounter", relationType: "uses" },
    ];

    // Test all modes
    const modes = ["smart", "entities", "relationships", "raw"];

    for (const mode of modes) {
      const result = await streamingResponseBuilder.buildStreamingResponse(entities, relations, {
        mode,
        limit: 10,
      });

      if (result.meta.tokenCount > result.meta.tokenLimit) {
        throw new Error(`${mode} mode exceeded token limit`);
      }

      if (mode === "smart" && !result.content.summary) {
        throw new Error("Smart mode should always include summary");
      }
    }

    console.log("  ✅ All modes work correctly in integration");
  },

  async testPerformanceWithLargeDataset() {
    console.log("\n🧪 Test: Performance with large dataset");

    const entityCount = 1000;
    const relationCount = 5000;

    const entities = Array.from({ length: entityCount }, (_, i) => ({
      name: `Entity${i}`,
      entityType: ["class", "function", "variable", "module"][i % 4],
      observations: [
        `Defined in: src/module${Math.floor(i / 10)}/file${i}.py`,
        `Line: ${i * 10}`,
        `Description for entity ${i}`,
      ],
    }));

    const relations = Array.from({ length: relationCount }, (_, i) => ({
      from: `Entity${i % entityCount}`,
      to: `Entity${(i * 7) % entityCount}`,
      relationType: ["contains", "imports", "inherits", "uses", "implements"][i % 5],
    }));

    const startTime = Date.now();
    const result = await streamingResponseBuilder.buildStreamingResponse(entities, relations, {
      mode: "smart",
      limit: 50,
    });
    const duration = Date.now() - startTime;

    if (duration > 1000) {
      console.log(`  ⚠️  Performance warning: ${duration}ms (target: <1000ms)`);
    } else {
      console.log(`  ✅ Performance acceptable: ${duration}ms`);
    }

    if (!result.meta.truncated) {
      throw new Error("Large dataset should be truncated");
    }

    console.log(
      `     Token utilization: ${((result.meta.tokenCount / result.meta.tokenLimit) * 100).toFixed(1)}%`
    );
  },
};

/**
 * Run all tests
 */
async function runAllTests() {
  console.log("🚀 Starting Edge Case and Integration Tests\n");

  let passed = 0;
  let failed = 0;

  const allTests = [...Object.entries(EdgeCaseTests), ...Object.entries(IntegrationTests)];

  for (const [name, testFn] of allTests) {
    try {
      await testFn();
      passed++;
    } catch (error) {
      failed++;
      console.error(`  ❌ ${name} failed: ${error.message}`);
    }
  }

  console.log("\n📊 Final Results:");
  console.log(`  Total tests: ${passed + failed}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Success rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(console.error);
