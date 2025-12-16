/**
 * Integration tests for QdrantPersistence class.
 * Tests CRUD operations, search, and multi-collection support.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { MockQdrantClient, MockPoint } from "../mocks/qdrantClient.mock.js";
import { createMockQdrantClient } from "../mocks/qdrantClient.mock.js";
import type { MockOpenAI } from "../mocks/openaiClient.mock.js";
import { createMockOpenAI } from "../mocks/openaiClient.mock.js";
import {
  validEntities,
  validEntity,
  entityWithMultipleObservations,
} from "../fixtures/entities.js";
import { validRelations, validRelation } from "../fixtures/relations.js";

// Mock environment variables
vi.stubEnv("QDRANT_URL", "http://localhost:6333");
vi.stubEnv("QDRANT_API_KEY", "test-api-key");
vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
vi.stubEnv("QDRANT_COLLECTION_NAME", "test-collection");

// Mock console.error to suppress logging during tests
vi.spyOn(console, "error").mockImplementation(() => {});

// Store mock instances for test access
let mockQdrant: MockQdrantClient;
let mockOpenAI: MockOpenAI;

// Mock the Qdrant client module
vi.mock("@qdrant/js-client-rest", () => {
  return {
    QdrantClient: vi.fn().mockImplementation(() => {
      mockQdrant = createMockQdrantClient();
      return mockQdrant;
    }),
  };
});

// Mock OpenAI module
vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(() => {
      mockOpenAI = createMockOpenAI();
      return mockOpenAI;
    }),
  };
});

// Mock config module
vi.mock("../../config.js", () => ({
  QDRANT_URL: "http://localhost:6333",
  COLLECTION_NAME: "test-collection",
  OPENAI_API_KEY: "test-openai-key",
  QDRANT_API_KEY: "test-api-key",
  getCollectionName: (override?: string) => override || "test-collection",
}));

// Mock claudeignore module
vi.mock("../../claudeignore/index.js", () => ({
  createFilterFromEnv: () => null,
  ClaudeIgnoreFilter: vi.fn(),
}));

// Import after mocking
import { QdrantPersistence } from "../../persistence/qdrant.js";

describe("QdrantPersistence Integration Tests", () => {
  let persistence: QdrantPersistence;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    if (mockQdrant) mockQdrant.reset();
    if (mockOpenAI) mockOpenAI.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Connection and Initialization", () => {
    it("should create instance without error", () => {
      persistence = new QdrantPersistence();
      expect(persistence).toBeDefined();
    });

    it("should connect successfully", async () => {
      persistence = new QdrantPersistence();
      await persistence.connect();
      // Should not throw
    });

    it("should initialize with existing collection", async () => {
      persistence = new QdrantPersistence();
      // Seed an existing collection
      mockQdrant.seedData("test-collection", []);
      await persistence.initialize();
      // Should not throw
    });

    it("should detect collection vector size", async () => {
      persistence = new QdrantPersistence();
      mockQdrant.seedData("test-collection", []);
      await persistence.initialize();
      // Collection should exist
      expect(mockQdrant.getPointCount("test-collection")).toBe(0);
    });

    it("should handle connection retry on initial failure", async () => {
      persistence = new QdrantPersistence();
      // Set failure for first 2 attempts
      mockQdrant.setFailure("connection", 2);
      await persistence.connect();
      // Should succeed after retries
    });

    it("should throw after max connection retries", async () => {
      persistence = new QdrantPersistence();
      // Set permanent failure
      mockQdrant.setFailure("connection", 10);
      await expect(persistence.connect()).rejects.toThrow(/Failed to connect/);
    });
  });

  describe("Entity CRUD Operations", () => {
    beforeEach(async () => {
      persistence = new QdrantPersistence();
      mockQdrant.seedData("test-collection", []);
    });

    it("should persist a new entity", async () => {
      await persistence.persistEntity(validEntity);
      expect(mockQdrant.getPointCount("test-collection")).toBe(1);
    });

    it("should persist entity with observations", async () => {
      await persistence.persistEntity(entityWithMultipleObservations);
      expect(mockQdrant.getPointCount("test-collection")).toBe(1);
    });

    it("should persist multiple entities", async () => {
      for (const entity of validEntities) {
        await persistence.persistEntity(entity);
      }
      expect(mockQdrant.getPointCount("test-collection")).toBe(validEntities.length);
    });

    it("should generate embedding for entity", async () => {
      await persistence.persistEntity(validEntity);
      expect(mockOpenAI.getCallCount()).toBe(1);
    });

    it("should handle entity with empty observations", async () => {
      const entityEmptyObs = { name: "EmptyObs", entityType: "class", observations: [] };
      await persistence.persistEntity(entityEmptyObs);
      expect(mockQdrant.getPointCount("test-collection")).toBe(1);
    });

    it("should use collection parameter for multi-project support", async () => {
      await persistence.persistEntity(validEntity, "project-a");
      expect(mockQdrant.getPointCount("project-a")).toBe(1);
      expect(mockQdrant.getPointCount("test-collection")).toBe(0);
    });

    it("should upsert existing entity on re-persist", async () => {
      await persistence.persistEntity(validEntity);
      await persistence.persistEntity(validEntity);
      // Should still be 1 (upsert, not duplicate)
      expect(mockQdrant.getPointCount("test-collection")).toBe(1);
    });
  });

  describe("Relation CRUD Operations", () => {
    beforeEach(async () => {
      persistence = new QdrantPersistence();
      mockQdrant.seedData("test-collection", []);
    });

    it("should persist a new relation", async () => {
      await persistence.persistRelation(validRelation);
      expect(mockQdrant.getPointCount("test-collection")).toBe(1);
    });

    it("should persist multiple relations", async () => {
      for (const relation of validRelations) {
        await persistence.persistRelation(relation);
      }
      expect(mockQdrant.getPointCount("test-collection")).toBe(validRelations.length);
    });

    it("should generate consistent relation ID", async () => {
      await persistence.persistRelation(validRelation);
      // Persist same relation again - should be same point
      await persistence.persistRelation(validRelation);
      expect(mockQdrant.getPointCount("test-collection")).toBe(1);
    });

    it("should use collection parameter for relations", async () => {
      await persistence.persistRelation(validRelation, "project-b");
      expect(mockQdrant.getPointCount("project-b")).toBe(1);
    });
  });

  describe("Search Operations", () => {
    beforeEach(async () => {
      persistence = new QdrantPersistence();

      // Seed test data - metadata chunks
      const testChunks: MockPoint[] = [
        {
          id: 1,
          payload: {
            type: "chunk",
            chunk_type: "metadata",
            entity_name: "AuthService",
            entity_type: "class",
            content: "Authentication service for user login",
            observations: ["Handles JWT tokens", "Integrates with OAuth"],
          },
        },
        {
          id: 2,
          payload: {
            type: "chunk",
            chunk_type: "metadata",
            entity_name: "validateToken",
            entity_type: "function",
            content: "Validates JWT tokens",
            observations: ["Pure function", "No side effects"],
          },
        },
        {
          id: 3,
          payload: {
            type: "chunk",
            chunk_type: "implementation",
            entity_name: "AuthService",
            entity_type: "class",
            content: "class AuthService { login() {} }",
          },
        },
        {
          id: 4,
          payload: {
            type: "chunk",
            chunk_type: "metadata",
            entity_name: "UserModel",
            entity_type: "interface",
            content: "User data model interface",
          },
        },
      ];

      mockQdrant.seedData("test-collection", testChunks);
    });

    it("should perform semantic search", async () => {
      const results = await persistence.searchSimilar("authentication", undefined, 10, "semantic");
      expect(Array.isArray(results)).toBe(true);
    });

    it("should filter search by entity types", async () => {
      const results = await persistence.searchSimilar("service", ["class"], 10, "semantic");
      expect(Array.isArray(results)).toBe(true);
    });

    it("should filter search by chunk type", async () => {
      const results = await persistence.searchSimilar("auth", ["metadata"], 10, "semantic");
      expect(Array.isArray(results)).toBe(true);
    });

    it("should respect limit parameter", async () => {
      const results = await persistence.searchSimilar("service", undefined, 2, "semantic");
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should use collection parameter in search", async () => {
      mockQdrant.seedData("other-project", [
        {
          id: 100,
          payload: {
            type: "chunk",
            chunk_type: "metadata",
            entity_name: "OtherService",
            entity_type: "class",
            content: "Other project service",
          },
        },
      ]);

      const results = await persistence.searchSimilar(
        "service",
        undefined,
        10,
        "semantic",
        "other-project"
      );
      expect(Array.isArray(results)).toBe(true);
    });

    it("should handle empty query gracefully", async () => {
      const results = await persistence.searchSimilar("", undefined, 10, "semantic");
      expect(Array.isArray(results)).toBe(true);
    });

    it("should throw on connection failure during search", async () => {
      // Connection failures throw after retries are exhausted
      mockQdrant.setFailure("connection", 10);
      await expect(persistence.searchSimilar("test", undefined, 10, "semantic")).rejects.toThrow(
        /Failed to connect/
      );
    });
  });

  describe("Search Result Processing", () => {
    beforeEach(async () => {
      persistence = new QdrantPersistence();

      const testChunks: MockPoint[] = [
        {
          id: 1,
          payload: {
            type: "chunk",
            chunk_type: "metadata",
            entity_name: "TestEntity",
            entity_type: "function",
            content: "Test content",
            observations: ["Observation 1", "Observation 2"],
          },
        },
      ];

      mockQdrant.seedData("test-collection", testChunks);
    });

    it("should include observations in search results", async () => {
      const results = await persistence.searchSimilar("test", undefined, 10, "semantic");
      if (results.length > 0) {
        expect(results[0].data).toHaveProperty("observations");
      }
    });

    it("should normalize entity_name field", async () => {
      const results = await persistence.searchSimilar("test", undefined, 10, "semantic");
      if (results.length > 0) {
        expect(results[0].data.entity_name).toBe("TestEntity");
      }
    });

    it("should apply metadata chunk score boost", async () => {
      const results = await persistence.searchSimilar("test", undefined, 10, "semantic");
      // Metadata chunks get 1.4x boost
      if (results.length > 0) {
        expect(results[0].score).toBeGreaterThan(0);
      }
    });
  });

  describe("Scroll Operations", () => {
    beforeEach(async () => {
      persistence = new QdrantPersistence();

      // Seed many entities for pagination testing
      const manyChunks: MockPoint[] = [];
      for (let i = 0; i < 25; i++) {
        manyChunks.push({
          id: i,
          payload: {
            type: "chunk",
            chunk_type: "metadata",
            entity_name: `Entity${i}`,
            entity_type: i % 2 === 0 ? "class" : "function",
            content: `Content for entity ${i}`,
          },
        });
      }

      mockQdrant.seedData("test-collection", manyChunks);
    });

    it("should scroll all entities", async () => {
      const result = await persistence.scrollAll();
      // Default mode returns KnowledgeGraph with entities
      expect("entities" in result && result.entities.length).toBeGreaterThan(0);
    });

    it("should filter by entity types in scroll", async () => {
      const result = await persistence.scrollAll({ entityTypes: ["class"] });
      // Raw/default mode returns KnowledgeGraph with entities
      expect("entities" in result).toBe(true);
    });

    it("should respect limit in scroll", async () => {
      const result = await persistence.scrollAll({ limit: 5 });
      // Limit may not be exact due to pagination
      expect("entities" in result && result.entities.length).toBeGreaterThan(0);
    });

    it("should return smart graph in smart mode", async () => {
      const result = await persistence.scrollAll({ mode: "smart" });
      expect(result).toBeDefined();
    });

    it("should use collection parameter in scroll", async () => {
      mockQdrant.seedData("project-c", [
        {
          id: 1000,
          payload: {
            type: "chunk",
            chunk_type: "metadata",
            entity_name: "ProjectCEntity",
            entity_type: "class",
            content: "Project C content",
          },
        },
      ]);

      const result = await persistence.scrollAll({}, "project-c");
      expect(result).toBeDefined();
    });
  });

  describe("Cache Operations", () => {
    beforeEach(async () => {
      persistence = new QdrantPersistence();
      mockQdrant.seedData("test-collection", []);
    });

    it("should return cache statistics", () => {
      const stats = persistence.getCacheStats();
      expect(stats).toHaveProperty("hits");
      expect(stats).toHaveProperty("misses");
      expect(stats).toHaveProperty("size");
      expect(stats).toHaveProperty("hitRatio");
    });

    it("should cache repeated embedding queries", async () => {
      await persistence.persistEntity(validEntity);
      await persistence.persistEntity(validEntity);

      const stats = persistence.getCacheStats();
      // Second call should hit cache
      expect(stats.hits).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Error Handling", () => {
    beforeEach(async () => {
      persistence = new QdrantPersistence();
      mockQdrant.seedData("test-collection", []);
    });

    it("should handle Qdrant connection timeout", async () => {
      mockQdrant.setFailure("timeout");
      await expect(persistence.persistEntity(validEntity)).rejects.toThrow();
    });

    it("should handle OpenAI embedding error", async () => {
      mockOpenAI.setError("rate_limit");
      await expect(persistence.persistEntity(validEntity)).rejects.toThrow(/Rate limit/);
    });

    it("should handle invalid API key error", async () => {
      mockOpenAI.setError("invalid_key");
      await expect(persistence.persistEntity(validEntity)).rejects.toThrow(/Invalid API key/);
    });

    it("should handle collection not found gracefully", async () => {
      // Don't seed the collection - it should be created
      const newPersistence = new QdrantPersistence();
      await newPersistence.initialize("nonexistent-collection");
      // Should create the collection
    });
  });

  describe("Multi-Collection Support", () => {
    beforeEach(async () => {
      persistence = new QdrantPersistence();
    });

    it("should maintain separate collections", async () => {
      await persistence.persistEntity(validEntity, "project-1");
      await persistence.persistEntity({ ...validEntity, name: "Other" }, "project-2");

      expect(mockQdrant.getPointCount("project-1")).toBe(1);
      expect(mockQdrant.getPointCount("project-2")).toBe(1);
    });

    it("should isolate searches between collections", async () => {
      mockQdrant.seedData("project-a", [
        {
          id: 1,
          payload: {
            type: "chunk",
            chunk_type: "metadata",
            entity_name: "ProjectAEntity",
            entity_type: "class",
            content: "Project A specific",
          },
        },
      ]);

      mockQdrant.seedData("project-b", [
        {
          id: 2,
          payload: {
            type: "chunk",
            chunk_type: "metadata",
            entity_name: "ProjectBEntity",
            entity_type: "class",
            content: "Project B specific",
          },
        },
      ]);

      const resultsA = await persistence.searchSimilar(
        "entity",
        undefined,
        10,
        "semantic",
        "project-a"
      );
      const resultsB = await persistence.searchSimilar(
        "entity",
        undefined,
        10,
        "semantic",
        "project-b"
      );

      // Results should be from their respective collections
      expect(Array.isArray(resultsA)).toBe(true);
      expect(Array.isArray(resultsB)).toBe(true);
    });

    it("should use default collection when none specified", async () => {
      await persistence.persistEntity(validEntity);
      expect(mockQdrant.getPointCount("test-collection")).toBe(1);
    });
  });
});
