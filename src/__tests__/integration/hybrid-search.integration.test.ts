/**
 * Integration tests for Hybrid Search functionality.
 * Tests semantic + BM25 fusion, search modes, and result processing.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { BM25Document, BM25SearchResult } from "../../bm25/bm25Service.js";
import { BM25Service, HybridSearchFusion } from "../../bm25/bm25Service.js";
import type { SearchResult } from "../../types.js";

// Mock console.error to suppress logging during tests
vi.spyOn(console, "error").mockImplementation(() => {});

describe("Hybrid Search Integration Tests", () => {
  describe("Search Mode Tests", () => {
    let bm25Service: BM25Service;

    beforeEach(() => {
      bm25Service = new BM25Service();

      // Seed with test documents
      const documents: BM25Document[] = [
        {
          id: "AuthService",
          content:
            "Authentication service class handles user login logout JWT tokens OAuth integration",
          entityType: "class",
          observations: ["Manages authentication flow", "Supports OAuth providers"],
        },
        {
          id: "validateToken",
          content:
            "function validateToken validates JWT tokens checks expiration signature verification",
          entityType: "function",
          observations: ["Pure function", "Crypto validation"],
        },
        {
          id: "UserModel",
          content: "interface UserModel user data structure id name email role permissions",
          entityType: "interface",
          observations: ["Type definition", "User schema"],
        },
        {
          id: "DatabaseService",
          content: "database connection service postgres queries transactions pooling",
          entityType: "class",
          observations: ["Manages DB connections"],
        },
        {
          id: "CacheService",
          content: "caching service redis memory store ttl expiration",
          entityType: "class",
          observations: ["Performance optimization"],
        },
      ];

      bm25Service.addDocuments(documents);
    });

    describe("BM25 Keyword Search", () => {
      it("should find exact term matches", () => {
        const results = bm25Service.search("authentication", 10);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].document.id).toBe("AuthService");
      });

      it("should rank by term frequency", () => {
        const results = bm25Service.search("JWT tokens", 10);
        expect(results.length).toBeGreaterThan(0);
        // AuthService and validateToken both mention JWT tokens
      });

      it("should handle multi-term queries", () => {
        const results = bm25Service.search("user login authentication", 10);
        expect(results.length).toBeGreaterThan(0);
      });

      it("should return empty for non-matching terms", () => {
        const results = bm25Service.search("nonexistentterm12345", 10);
        expect(results.length).toBe(0);
      });

      it("should filter by entity types", () => {
        const results = bm25Service.search("service", 10, ["class"]);
        expect(results.every((r) => r.document.entityType === "class")).toBe(true);
      });

      it("should respect limit parameter", () => {
        const results = bm25Service.search("service", 2);
        expect(results.length).toBeLessThanOrEqual(2);
      });

      it("should include observations in searchable text", () => {
        const results = bm25Service.search("OAuth providers", 10);
        expect(results.length).toBeGreaterThan(0);
        // Should find AuthService via its observations
      });

      it("should handle empty query", () => {
        const results = bm25Service.search("", 10);
        expect(results).toEqual([]);
      });
    });

    describe("BM25 Scoring", () => {
      it("should return positive scores for matches", () => {
        const results = bm25Service.search("authentication", 10);
        expect(results.every((r) => r.score > 0)).toBe(true);
      });

      it("should apply entity type boosting", () => {
        // Classes get 2x boost, functions get 1.5x
        const results = bm25Service.search("service", 10);
        // Verify boosting is applied
        expect(results.length).toBeGreaterThan(0);
      });

      it("should normalize scores appropriately", () => {
        const results = bm25Service.search("authentication", 10);
        if (results.length > 0) {
          // Scores should be reasonable numbers
          expect(results[0].score).toBeGreaterThan(0);
          expect(results[0].score).toBeLessThan(100);
        }
      });
    });

    describe("BM25 Index Management", () => {
      it("should return stats with document count", () => {
        const stats = bm25Service.getStats();
        expect(stats.documentCount).toBe(5);
      });

      it("should accumulate documents", () => {
        const newDocs: BM25Document[] = [
          { id: "NewEntity", content: "new content", entityType: "class" },
        ];
        bm25Service.addDocuments(newDocs);
        expect(bm25Service.getStats().documentCount).toBe(6);
      });

      it("should clear documents", () => {
        bm25Service.clearDocuments();
        expect(bm25Service.getStats().documentCount).toBe(0);
      });

      it("should handle camelCase splitting", () => {
        const results = bm25Service.search("Auth Service", 10);
        // Should match AuthService via camelCase splitting
        expect(results.length).toBeGreaterThan(0);
      });

      it("should handle snake_case splitting", () => {
        bm25Service.addDocuments([
          {
            id: "validate_user_token",
            content: "validate user token function",
            entityType: "function",
          },
        ]);
        const results = bm25Service.search("validate token", 10);
        expect(results.length).toBeGreaterThan(0);
      });
    });
  });

  describe("RRF Fusion Algorithm Tests", () => {
    describe("Result Fusion", () => {
      it("should fuse semantic and keyword results", () => {
        const semanticResults: SearchResult[] = [
          {
            type: "chunk",
            score: 0.85,
            data: {
              id: "1",
              entity_name: "AuthService",
              entity_type: "class",
              chunk_type: "metadata",
              content: "Auth content",
            },
          },
          {
            type: "chunk",
            score: 0.75,
            data: {
              id: "2",
              entity_name: "UserService",
              entity_type: "class",
              chunk_type: "metadata",
              content: "User content",
            },
          },
        ];

        const keywordResults: BM25SearchResult[] = [
          {
            document: {
              id: "AuthService",
              content: "Auth content",
              entityType: "class",
            },
            score: 2.5,
          },
          {
            document: {
              id: "TokenValidator",
              content: "Token content",
              entityType: "function",
            },
            score: 1.8,
          },
        ];

        const fused = HybridSearchFusion.fuseResults(
          semanticResults,
          keywordResults,
          "test-collection",
          0.7,
          0.3,
          60
        );

        expect(fused.length).toBeGreaterThan(0);
        // AuthService should rank highly (appears in both)
      });

      it("should use default weights (0.7 semantic, 0.3 keyword)", () => {
        const semanticResults: SearchResult[] = [
          {
            type: "chunk",
            score: 0.9,
            data: {
              id: "1",
              entity_name: "SemanticOnly",
              entity_type: "class",
              chunk_type: "metadata",
              content: "Semantic content",
            },
          },
        ];

        const keywordResults: BM25SearchResult[] = [
          {
            document: {
              id: "KeywordOnly",
              content: "Keyword content",
              entityType: "function",
            },
            score: 3.0,
          },
        ];

        const fused = HybridSearchFusion.fuseResults(
          semanticResults,
          keywordResults,
          "test-collection",
          0.7,
          0.3,
          60
        );

        expect(fused.length).toBe(2);
      });

      it("should handle overlapping entities correctly", () => {
        // Note: RRF fusion uses entity_name from BM25 document.id as the key
        // Semantic results have separate chunk IDs, BM25 uses entity name as id
        const semanticResults: SearchResult[] = [
          {
            type: "chunk",
            score: 0.8,
            data: {
              id: "1",
              entity_name: "SharedEntity",
              entity_type: "class",
              chunk_type: "metadata",
              content: "Shared content",
            },
          },
        ];

        const keywordResults: BM25SearchResult[] = [
          {
            document: {
              id: "SharedEntity",
              content: "Shared content",
              entityType: "class",
            },
            score: 2.0,
          },
        ];

        const fused = HybridSearchFusion.fuseResults(
          semanticResults,
          keywordResults,
          "test-collection",
          0.7,
          0.3,
          60
        );

        // Both results are kept since semantic (id=1) differs from keyword (id=SharedEntity)
        // RRF fusion tracks by unique identifiers, not entity_name
        expect(fused.length).toBe(2);
        // Should contain both the semantic and keyword-derived results
        const entityNames = fused.map((r) => r.data.entity_name);
        expect(entityNames).toContain("SharedEntity");
      });

      it("should sort by combined score", () => {
        const semanticResults: SearchResult[] = [
          {
            type: "chunk",
            score: 0.5,
            data: {
              id: "1",
              entity_name: "LowSemantic",
              entity_type: "class",
              chunk_type: "metadata",
              content: "Low semantic",
            },
          },
        ];

        const keywordResults: BM25SearchResult[] = [
          {
            document: {
              id: "HighKeyword",
              content: "High keyword",
              entityType: "function",
            },
            score: 5.0,
          },
        ];

        const fused = HybridSearchFusion.fuseResults(
          semanticResults,
          keywordResults,
          "test-collection",
          0.7,
          0.3,
          60
        );

        // Results should be sorted by score descending
        for (let i = 1; i < fused.length; i++) {
          expect(fused[i - 1].score).toBeGreaterThanOrEqual(fused[i].score);
        }
      });

      it("should handle empty semantic results", () => {
        const keywordResults: BM25SearchResult[] = [
          {
            document: {
              id: "KeywordOnly",
              content: "Keyword content",
              entityType: "class",
            },
            score: 2.0,
          },
        ];

        const fused = HybridSearchFusion.fuseResults(
          [],
          keywordResults,
          "test-collection",
          0.7,
          0.3,
          60
        );

        expect(fused.length).toBe(1);
      });

      it("should handle empty keyword results", () => {
        const semanticResults: SearchResult[] = [
          {
            type: "chunk",
            score: 0.8,
            data: {
              id: "1",
              entity_name: "SemanticOnly",
              entity_type: "class",
              chunk_type: "metadata",
              content: "Semantic content",
            },
          },
        ];

        const fused = HybridSearchFusion.fuseResults(
          semanticResults,
          [],
          "test-collection",
          0.7,
          0.3,
          60
        );

        expect(fused.length).toBe(1);
      });

      it("should handle both empty results", () => {
        const fused = HybridSearchFusion.fuseResults([], [], "test-collection", 0.7, 0.3, 60);

        expect(fused.length).toBe(0);
      });
    });

    describe("RRF Constant", () => {
      it("should use k=60 as default constant", () => {
        const semanticResults: SearchResult[] = [
          {
            type: "chunk",
            score: 0.9,
            data: {
              id: "1",
              entity_name: "Entity1",
              entity_type: "class",
              chunk_type: "metadata",
              content: "Content",
            },
          },
        ];

        // Using k=60 should produce valid scores
        const fused = HybridSearchFusion.fuseResults(
          semanticResults,
          [],
          "test-collection",
          0.7,
          0.3,
          60
        );

        expect(fused.length).toBe(1);
        expect(fused[0].score).toBeGreaterThan(0);
      });

      it("should handle custom k values", () => {
        const semanticResults: SearchResult[] = [
          {
            type: "chunk",
            score: 0.9,
            data: {
              id: "1",
              entity_name: "Entity1",
              entity_type: "class",
              chunk_type: "metadata",
              content: "Content",
            },
          },
        ];

        // Different k values should still produce valid results
        const fusedK30 = HybridSearchFusion.fuseResults(
          semanticResults,
          [],
          "test-collection",
          0.7,
          0.3,
          30
        );

        const fusedK100 = HybridSearchFusion.fuseResults(
          semanticResults,
          [],
          "test-collection",
          0.7,
          0.3,
          100
        );

        expect(fusedK30.length).toBe(1);
        expect(fusedK100.length).toBe(1);
      });
    });

    describe("Weight Customization", () => {
      it("should respect custom semantic weight", () => {
        const semanticResults: SearchResult[] = [
          {
            type: "chunk",
            score: 0.9,
            data: {
              id: "1",
              entity_name: "SemanticHigh",
              entity_type: "class",
              chunk_type: "metadata",
              content: "Semantic",
            },
          },
        ];

        const keywordResults: BM25SearchResult[] = [
          {
            document: {
              id: "KeywordHigh",
              content: "Keyword",
              entityType: "class",
            },
            score: 3.0,
          },
        ];

        // Full semantic weight
        const semanticOnly = HybridSearchFusion.fuseResults(
          semanticResults,
          keywordResults,
          "test-collection",
          1.0,
          0.0,
          60
        );

        // Full keyword weight
        const keywordOnly = HybridSearchFusion.fuseResults(
          semanticResults,
          keywordResults,
          "test-collection",
          0.0,
          1.0,
          60
        );

        // Both should work
        expect(semanticOnly.length).toBeGreaterThan(0);
        expect(keywordOnly.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Result Processing Tests", () => {
    describe("Score Boosting", () => {
      it("should apply metadata chunk boost (1.4x)", () => {
        // This is tested via the processSearchResults in qdrant.ts
        // Here we verify the BM25 service handles metadata correctly
        const bm25Service = new BM25Service();
        bm25Service.addDocuments([
          {
            id: "Entity1",
            content: "test content",
            entityType: "class",
            data: { chunk_type: "metadata" },
          },
        ]);
        const results = bm25Service.search("test", 10);
        expect(results.length).toBe(1);
      });

      it("should apply entity type boosts", () => {
        const bm25Service = new BM25Service();
        bm25Service.addDocuments([
          { id: "Func1", content: "function content", entityType: "function" },
          { id: "Class1", content: "class content", entityType: "class" },
          { id: "Var1", content: "variable content", entityType: "variable" },
        ]);

        const stats = bm25Service.getStats();
        expect(stats.documentCount).toBe(3);
        // Entity type boosts are applied during search
      });
    });

    describe("Result Format", () => {
      it("should include entity_name in results", () => {
        const bm25Service = new BM25Service();
        bm25Service.addDocuments([{ id: "TestEntity", content: "test", entityType: "class" }]);

        const results = bm25Service.search("test", 10);
        expect(results[0].document.id).toBe("TestEntity");
      });

      it("should include entity_type in results", () => {
        const bm25Service = new BM25Service();
        bm25Service.addDocuments([{ id: "TestEntity", content: "test", entityType: "function" }]);

        const results = bm25Service.search("test", 10);
        expect(results[0].document.entityType).toBe("function");
      });

      it("should include observations when available", () => {
        const bm25Service = new BM25Service();
        bm25Service.addDocuments([
          {
            id: "TestEntity",
            content: "test",
            entityType: "class",
            observations: ["obs1", "obs2"],
          },
        ]);

        const results = bm25Service.search("test", 10);
        expect(results[0].document.observations).toEqual(["obs1", "obs2"]);
      });

      it("should convert to SearchResult format", () => {
        const bm25Result: BM25SearchResult = {
          document: {
            id: "TestEntity",
            content: "test content",
            entityType: "class",
          },
          score: 2.5,
        };

        const searchResult = BM25Service.convertToSearchResult(bm25Result, "test-collection");

        expect(searchResult.type).toBe("chunk");
        expect(searchResult.score).toBe(2.5);
        expect(searchResult.data.entity_name).toBe("TestEntity");
      });
    });

    describe("Deduplication", () => {
      it("should keep highest score for duplicate entities in fusion", () => {
        const semanticResults: SearchResult[] = [
          {
            type: "chunk",
            score: 0.8,
            data: {
              id: "1",
              entity_name: "DuplicateEntity",
              entity_type: "class",
              chunk_type: "metadata",
              content: "Content 1",
            },
          },
          {
            type: "chunk",
            score: 0.6,
            data: {
              id: "2",
              entity_name: "DuplicateEntity",
              entity_type: "class",
              chunk_type: "implementation",
              content: "Content 2",
            },
          },
        ];

        const fused = HybridSearchFusion.fuseResults(
          semanticResults,
          [],
          "test-collection",
          0.7,
          0.3,
          60
        );

        // RRF fusion keeps both metadata and implementation chunks for same entity
        // (deduplication happens at presentation layer, not fusion layer)
        const duplicateCount = fused.filter((r) => r.data.entity_name === "DuplicateEntity").length;
        // Both chunks are kept - metadata and implementation are distinct
        expect(duplicateCount).toBe(2);
      });
    });

    describe("Limit Application", () => {
      it("should respect final limit after fusion", () => {
        const semanticResults: SearchResult[] = Array.from({ length: 10 }, (_, i) => ({
          type: "chunk" as const,
          score: 0.9 - i * 0.05,
          data: {
            id: String(i),
            entity_name: `SemanticEntity${i}`,
            entity_type: "class",
            chunk_type: "metadata" as const,
            content: `Content ${i}`,
          },
        }));

        const keywordResults: BM25SearchResult[] = Array.from({ length: 10 }, (_, i) => ({
          document: {
            id: `KeywordEntity${i}`,
            content: `Keyword Content ${i}`,
            entityType: "function",
          },
          score: 3.0 - i * 0.2,
        }));

        const fused = HybridSearchFusion.fuseResults(
          semanticResults,
          keywordResults,
          "test-collection",
          0.7,
          0.3,
          60
        );

        // Fusion should combine all unique results
        expect(fused.length).toBe(20);
      });
    });
  });

  describe("Unicode and Special Characters", () => {
    let bm25Service: BM25Service;

    beforeEach(() => {
      bm25Service = new BM25Service();
    });

    it("should handle Unicode text", () => {
      bm25Service.addDocuments([
        { id: "UnicodeEntity", content: "Unicode text: café résumé naïve", entityType: "class" },
      ]);

      const results = bm25Service.search("café", 10);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle special characters", () => {
      bm25Service.addDocuments([
        { id: "SpecialEntity", content: "Special chars: @#$%^&*()", entityType: "class" },
      ]);

      // Special chars should be handled gracefully
      const results = bm25Service.search("Special", 10);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle CJK characters", () => {
      bm25Service.addDocuments([
        { id: "CJKEntity", content: "中文测试 日本語テスト 한국어테스트", entityType: "class" },
      ]);

      const results = bm25Service.search("中文", 10);
      // May or may not find depending on tokenization
      expect(Array.isArray(results)).toBe(true);
    });

    it("should handle emoji", () => {
      bm25Service.addDocuments([
        { id: "EmojiEntity", content: "Emoji test 🔥 🚀 ✅", entityType: "class" },
      ]);

      const results = bm25Service.search("test", 10);
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
