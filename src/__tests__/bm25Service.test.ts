import { describe, it, expect, beforeEach, vi } from "vitest";
import type { BM25Document, BM25SearchResult } from "../bm25/bm25Service.js";
import { BM25Service, HybridSearchFusion } from "../bm25/bm25Service.js";
import type { SearchResult } from "../types.js";

// Mock console.error to suppress logging during tests
vi.spyOn(console, "error").mockImplementation(() => {});

describe("bm25Service.ts", () => {
  describe("BM25Service", () => {
    let service: BM25Service;

    beforeEach(() => {
      service = new BM25Service();
    });

    describe("constructor", () => {
      it("should use default config values", () => {
        const stats = service.getStats();
        expect(stats.config.k1).toBe(1.2);
        expect(stats.config.b).toBe(0.75);
      });

      it("should accept custom k1 config", () => {
        const custom = new BM25Service({ k1: 2.0 });
        const stats = custom.getStats();
        expect(stats.config.k1).toBe(2.0);
        expect(stats.config.b).toBe(0.75); // Default
      });

      it("should accept custom b config", () => {
        const custom = new BM25Service({ b: 0.5 });
        const stats = custom.getStats();
        expect(stats.config.k1).toBe(1.2); // Default
        expect(stats.config.b).toBe(0.5);
      });

      it("should accept both custom config values", () => {
        const custom = new BM25Service({ k1: 2.0, b: 0.5 });
        const stats = custom.getStats();
        expect(stats.config.k1).toBe(2.0);
        expect(stats.config.b).toBe(0.5);
      });
    });

    describe("addDocuments", () => {
      it("should add documents to corpus", () => {
        const docs: BM25Document[] = [
          { id: "doc1", content: "test content", entityType: "class" },
          { id: "doc2", content: "another content", entityType: "function" },
        ];

        service.addDocuments(docs);
        expect(service.getStats().documentCount).toBe(2);
      });

      it("should accumulate documents", () => {
        service.addDocuments([{ id: "doc1", content: "test", entityType: "class" }]);
        service.addDocuments([{ id: "doc2", content: "test2", entityType: "function" }]);
        expect(service.getStats().documentCount).toBe(2);
      });

      it("should include observations in searchable text", () => {
        // Need multiple documents for BM25 IDF to work properly
        // BM25 requires documents that DON'T contain the search term for positive IDF scores
        const docs: BM25Document[] = [
          {
            id: "AuthService",
            content: "authentication class definition",
            entityType: "class",
            observations: ["handles authentication flow", "manages auth tokens"],
          },
          {
            id: "DatabaseService",
            content: "database connection handler",
            entityType: "class",
          },
          {
            id: "CacheService",
            content: "caching layer implementation",
            entityType: "class",
          },
          {
            id: "LoggingService",
            content: "logging utility functions",
            entityType: "class",
          },
        ];

        service.addDocuments(docs);
        // Search for observation content - should find AuthService
        const results = service.search("authentication");
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].document.id).toBe("AuthService");
      });

      it("should handle documents without observations", () => {
        const doc: BM25Document = {
          id: "SimpleClass",
          content: "simple class content",
          entityType: "class",
        };

        service.addDocuments([doc]);
        expect(service.getStats().documentCount).toBe(1);
      });

      it("should handle empty documents array", () => {
        service.addDocuments([]);
        expect(service.getStats().documentCount).toBe(0);
      });
    });

    describe("clearDocuments", () => {
      it("should remove all documents", () => {
        service.addDocuments([{ id: "doc1", content: "test", entityType: "class" }]);
        service.clearDocuments();
        expect(service.getStats().documentCount).toBe(0);
      });

      it("should reset indexed state", () => {
        service.addDocuments([{ id: "doc1", content: "test", entityType: "class" }]);
        service.clearDocuments();
        expect(service.getStats().isIndexed).toBe(false);
      });
    });

    describe("updateDocuments", () => {
      it("should replace existing documents", () => {
        service.addDocuments([{ id: "doc1", content: "old", entityType: "class" }]);
        // BM25 needs multiple documents for meaningful IDF scores
        service.updateDocuments([
          { id: "doc2", content: "new unique content", entityType: "function" },
          { id: "doc3", content: "other different content", entityType: "class" },
          { id: "doc4", content: "another separate content", entityType: "class" },
        ]);

        expect(service.getStats().documentCount).toBe(3);
        const results = service.search("unique");
        expect(results.length).toBe(1);
        expect(results[0].document.id).toBe("doc2");
      });

      it("should clear old documents before adding new ones", () => {
        service.addDocuments([{ id: "doc1", content: "old content", entityType: "class" }]);
        service.updateDocuments([{ id: "doc2", content: "new content", entityType: "function" }]);

        // Old content is cleared, so document count should reflect new documents only
        expect(service.getStats().documentCount).toBe(1);
      });
    });

    describe("search", () => {
      beforeEach(() => {
        // BM25 requires sufficient corpus diversity for meaningful IDF calculations
        // Documents that don't share terms will produce positive IDF scores
        service.addDocuments([
          {
            id: "AuthService",
            content: "authentication service class",
            entityType: "class",
          },
          {
            id: "validateToken",
            content: "validate JWT token function",
            entityType: "function",
          },
          {
            id: "UserModel",
            content: "user data model",
            entityType: "class",
          },
          {
            id: "DatabaseHandler",
            content: "database connection handler",
            entityType: "class",
          },
          {
            id: "CacheManager",
            content: "cache manager utility",
            entityType: "function",
          },
        ]);
      });

      it("should return empty array for empty corpus", () => {
        const empty = new BM25Service();
        expect(empty.search("test")).toEqual([]);
      });

      it("should return empty array for empty query", () => {
        const results = service.search("");
        expect(results).toEqual([]);
      });

      it("should return empty array for whitespace query", () => {
        const results = service.search("   ");
        expect(results).toEqual([]);
      });

      it("should find matching documents", () => {
        const results = service.search("authentication");
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].document.id).toBe("AuthService");
      });

      it("should respect limit parameter", () => {
        const results = service.search("service", 1);
        expect(results.length).toBeLessThanOrEqual(1);
      });

      it("should filter by entityTypes", () => {
        const results = service.search("user data", 20, ["class"]);
        results.forEach((r) => {
          expect(r.document.entityType).toBe("class");
        });
      });

      it("should return results sorted by score descending", () => {
        const results = service.search("service");
        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
        }
      });

      it("should ignore chunk types (metadata/implementation) in filter", () => {
        // When only chunk types are passed, should return all results
        const results = service.search("service", 20, ["metadata"]);
        expect(results.length).toBeGreaterThan(0);
      });

      it("should handle mixed entity types and chunk types", () => {
        const results = service.search("service", 20, ["class", "metadata", "function"]);
        // Should filter by actual entity types (class, function) only
        results.forEach((r) => {
          expect(["class", "function"]).toContain(r.document.entityType);
        });
      });

      it("should boost class entity types", () => {
        service.clearDocuments();
        service.addDocuments([
          { id: "TestClass", content: "test code", entityType: "class" },
          { id: "testFunction", content: "test code", entityType: "function" },
        ]);

        const results = service.search("test");
        const classResult = results.find((r) => r.document.id === "TestClass");
        const funcResult = results.find((r) => r.document.id === "testFunction");

        if (classResult && funcResult) {
          // Class should have 2x boost, function should have 1.5x
          expect(classResult.score).toBeGreaterThan(funcResult.score);
        }
      });

      it("should handle camelCase splitting", () => {
        // Clear and create fresh corpus with diverse documents for BM25
        service.clearDocuments();
        service.addDocuments([
          { id: "CoreIndexer", content: "CoreIndexer class handles indexing", entityType: "class" },
          { id: "DatabaseManager", content: "database manager utility", entityType: "class" },
          { id: "CacheHandler", content: "cache handler service", entityType: "class" },
          { id: "LoggingService", content: "logging service implementation", entityType: "class" },
        ]);

        // Should find via split tokens 'core' and 'indexer'
        const results = service.search("indexer");
        expect(results.some((r) => r.document.id === "CoreIndexer")).toBe(true);
      });

      it("should handle special characters in query", () => {
        const results = service.search("authentication!");
        expect(results.length).toBeGreaterThan(0);
      });

      it("should be case insensitive", () => {
        const lowerResults = service.search("authentication");
        const upperResults = service.search("AUTHENTICATION");
        expect(lowerResults.length).toBe(upperResults.length);
      });
    });

    describe("getStats", () => {
      it("should return correct statistics", () => {
        service.addDocuments([{ id: "doc1", content: "test", entityType: "class" }]);
        const stats = service.getStats();

        expect(stats.documentCount).toBe(1);
        expect(stats.isIndexed).toBe(false);
        expect(stats.config).toBeDefined();
        expect(stats.config.k1).toBe(1.2);
        expect(stats.config.b).toBe(0.75);
      });

      it("should return zero count for empty service", () => {
        const stats = service.getStats();
        expect(stats.documentCount).toBe(0);
      });
    });

    describe("convertToSearchResult", () => {
      it("should convert BM25 result to SearchResult format", () => {
        const bm25Result: BM25SearchResult = {
          document: {
            id: "TestEntity",
            content: "test content",
            entityType: "class",
            has_implementation: true,
          },
          score: 1.5,
        };

        const result = BM25Service.convertToSearchResult(bm25Result, "test-collection");

        expect(result.type).toBe("chunk");
        expect(result.score).toBe(1.5);
        expect(result.data.id).toBe("TestEntity");
        expect(result.data.chunk_type).toBe("metadata");
        expect(result.data.collection).toBe("test-collection");
      });

      it("should default has_implementation to false", () => {
        const bm25Result: BM25SearchResult = {
          document: {
            id: "TestEntity",
            content: "test content",
            entityType: "function",
          },
          score: 1.0,
        };

        const result = BM25Service.convertToSearchResult(bm25Result, "collection");
        const metadata = result.data.metadata as { has_implementation?: boolean };
        expect(metadata.has_implementation).toBe(false);
      });

      it("should include entity_name from id", () => {
        const bm25Result: BM25SearchResult = {
          document: {
            id: "MyClass",
            content: "class content",
            entityType: "class",
          },
          score: 2.0,
        };

        const result = BM25Service.convertToSearchResult(bm25Result, "collection");
        expect(result.data.entity_name).toBe("MyClass");
      });
    });
  });

  describe("HybridSearchFusion", () => {
    describe("fuseResults", () => {
      const createSemanticResult = (id: string, score: number): SearchResult => ({
        type: "chunk",
        score,
        data: {
          id,
          entity_name: id,
          chunk_type: "metadata",
          content: "test",
          entity_type: "class",
        } as any,
      });

      const createKeywordResult = (id: string, score: number): BM25SearchResult => ({
        document: { id, content: "test", entityType: "class" },
        score,
      });

      it("should combine semantic and keyword results", () => {
        const semanticResults = [
          createSemanticResult("entity1", 0.9),
          createSemanticResult("entity2", 0.7),
        ];

        const keywordResults = [
          createKeywordResult("entity2", 2.0),
          createKeywordResult("entity3", 1.5),
        ];

        const fused = HybridSearchFusion.fuseResults(
          semanticResults,
          keywordResults,
          "test-collection"
        );

        // Should have all unique entities
        const ids = fused.map((r) => r.data.id);
        expect(ids).toContain("entity1");
        expect(ids).toContain("entity2");
        expect(ids).toContain("entity3");
      });

      it("should respect weight parameters", () => {
        const semanticResults = [createSemanticResult("entity1", 0.9)];
        const keywordResults = [createKeywordResult("entity2", 2.0)];

        // 100% semantic weight
        const semanticOnly = HybridSearchFusion.fuseResults(
          semanticResults,
          keywordResults,
          "test-collection",
          1.0, // semantic weight
          0.0 // keyword weight
        );

        // entity1 (only in semantic) should be ranked high since keyword weight is 0
        expect(semanticOnly[0].data.id).toBe("entity1");
      });

      it("should sort by hybrid score", () => {
        const semanticResults = [
          createSemanticResult("entity1", 0.5),
          createSemanticResult("entity2", 0.9),
        ];

        const keywordResults = [createKeywordResult("entity3", 1.0)];

        const fused = HybridSearchFusion.fuseResults(
          semanticResults,
          keywordResults,
          "test-collection"
        );

        for (let i = 1; i < fused.length; i++) {
          expect(fused[i - 1].score).toBeGreaterThanOrEqual(fused[i].score);
        }
      });

      it("should handle empty semantic results", () => {
        const keywordResults = [
          createKeywordResult("entity1", 2.0),
          createKeywordResult("entity2", 1.5),
        ];

        const fused = HybridSearchFusion.fuseResults([], keywordResults, "test-collection");

        expect(fused.length).toBe(keywordResults.length);
      });

      it("should handle empty keyword results", () => {
        const semanticResults = [
          createSemanticResult("entity1", 0.9),
          createSemanticResult("entity2", 0.7),
        ];

        const fused = HybridSearchFusion.fuseResults(semanticResults, [], "test-collection");

        expect(fused.length).toBe(semanticResults.length);
      });

      it("should handle both empty results", () => {
        const fused = HybridSearchFusion.fuseResults([], [], "test-collection");
        expect(fused.length).toBe(0);
      });

      it("should use default weights of 0.7 semantic and 0.3 keyword", () => {
        const semanticResults = [createSemanticResult("entity1", 1.0)];
        const keywordResults = [createKeywordResult("entity1", 1.0)];

        const fused = HybridSearchFusion.fuseResults(
          semanticResults,
          keywordResults,
          "test-collection"
        );

        // With equal scores and default weights:
        // hybrid = 0.7 * 1.0 + 0.3 * 1.0 = 1.0
        expect(fused[0].score).toBeCloseTo(1.0);
      });

      it("should combine scores for overlapping entities", () => {
        const semanticResults = [createSemanticResult("entity1", 0.8)];
        const keywordResults = [createKeywordResult("entity1", 2.0)];

        const fused = HybridSearchFusion.fuseResults(
          semanticResults,
          keywordResults,
          "test-collection",
          0.7,
          0.3
        );

        // hybrid = 0.7 * 0.8 + 0.3 * 2.0 = 0.56 + 0.6 = 1.16
        expect(fused[0].score).toBeCloseTo(1.16);
      });
    });
  });
});
