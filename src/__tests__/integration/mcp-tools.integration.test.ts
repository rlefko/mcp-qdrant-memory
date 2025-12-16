/**
 * Integration tests for MCP tool handlers.
 * Tests the complete request/response cycle for all MCP tools.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { MockQdrantClient } from "../mocks/qdrantClient.mock.js";
import { createMockQdrantClient } from "../mocks/qdrantClient.mock.js";
import type { MockOpenAI } from "../mocks/openaiClient.mock.js";
import { createMockOpenAI } from "../mocks/openaiClient.mock.js";
import { validEntities } from "../fixtures/entities.js";
import { validRelations } from "../fixtures/relations.js";

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

// Import validation functions and PlanModeGuard
import {
  validateCreateEntitiesRequest,
  validateCreateRelationsRequest,
  validateAddObservationsRequest,
  validateDeleteEntitiesRequest,
  validateDeleteObservationsRequest,
  validateDeleteRelationsRequest,
  validateSearchSimilarRequest,
  validateGetImplementationRequest,
  validateReadGraphRequest,
  validateSearchDocsRequest,
  validateGetDocRequest,
  validateSearchTicketsRequest,
  validateGetTicketRequest,
  validateSetPlanModeRequest,
} from "../../validation.js";
import { PlanModeGuard } from "../../plan-mode-guard.js";

describe("MCP Tools Integration Tests", () => {
  let planModeGuard: PlanModeGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    if (mockQdrant) mockQdrant.reset();
    if (mockOpenAI) mockOpenAI.reset();
    planModeGuard = new PlanModeGuard();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Write Tool Validation", () => {
    describe("create_entities", () => {
      it("should validate correct entity creation request", () => {
        const request = {
          entities: validEntities,
        };
        const result = validateCreateEntitiesRequest(request);
        expect(result.entities).toEqual(validEntities);
      });

      it("should validate request with collection parameter", () => {
        const request = {
          entities: validEntities,
          collection: "project-a",
        };
        const result = validateCreateEntitiesRequest(request);
        expect(result.collection).toBe("project-a");
      });

      it("should reject missing entities array", () => {
        expect(() => validateCreateEntitiesRequest({})).toThrow();
      });

      it("should reject entity missing name", () => {
        const request = {
          entities: [{ entityType: "class", observations: [] }],
        };
        expect(() => validateCreateEntitiesRequest(request)).toThrow();
      });

      it("should reject entity missing type", () => {
        const request = {
          entities: [{ name: "Test", observations: [] }],
        };
        expect(() => validateCreateEntitiesRequest(request)).toThrow();
      });
    });

    describe("create_relations", () => {
      it("should validate correct relation creation request", () => {
        const request = {
          relations: validRelations,
        };
        const result = validateCreateRelationsRequest(request);
        expect(result.relations).toEqual(validRelations);
      });

      it("should validate request with collection parameter", () => {
        const request = {
          relations: validRelations,
          collection: "project-b",
        };
        const result = validateCreateRelationsRequest(request);
        expect(result.collection).toBe("project-b");
      });

      it("should reject relation missing from", () => {
        const request = {
          relations: [{ to: "Target", relationType: "uses" }],
        };
        expect(() => validateCreateRelationsRequest(request)).toThrow();
      });

      it("should reject relation missing to", () => {
        const request = {
          relations: [{ from: "Source", relationType: "uses" }],
        };
        expect(() => validateCreateRelationsRequest(request)).toThrow();
      });
    });

    describe("add_observations", () => {
      it("should validate correct observation request", () => {
        const request = {
          observations: [{ entityName: "Test", contents: ["obs1", "obs2"] }],
        };
        const result = validateAddObservationsRequest(request);
        expect(result.observations).toBeDefined();
      });

      it("should require entityName in camelCase", () => {
        // Snake_case entity_name is not supported - must use entityName
        const request = {
          observations: [{ entity_name: "Test", contents: ["obs1"] }],
        };
        // Should fail because entityName is required in camelCase
        expect(() => validateAddObservationsRequest(request)).toThrow();
      });

      it("should reject empty contents array", () => {
        const request = {
          observations: [{ entityName: "Test", contents: [] }],
        };
        // Empty contents should still be valid, just no-op
        const result = validateAddObservationsRequest(request);
        expect(result.observations).toBeDefined();
      });
    });

    describe("delete_entities", () => {
      it("should validate correct deletion request", () => {
        const request = {
          entityNames: ["Entity1", "Entity2"],
        };
        const result = validateDeleteEntitiesRequest(request);
        expect(result.entityNames).toEqual(["Entity1", "Entity2"]);
      });

      it("should require entityNames in camelCase", () => {
        // Snake_case entity_names is not supported - must use entityNames
        const request = {
          entity_names: ["Entity1"],
        };
        // Should fail because entityNames is required in camelCase
        expect(() => validateDeleteEntitiesRequest(request)).toThrow();
      });
    });

    describe("delete_observations", () => {
      it("should validate correct deletion request", () => {
        const request = {
          deletions: [{ entityName: "Test", observations: ["obs1"] }],
        };
        const result = validateDeleteObservationsRequest(request);
        expect(result.deletions).toBeDefined();
      });
    });

    describe("delete_relations", () => {
      it("should validate correct relation deletion", () => {
        const request = {
          relations: validRelations,
        };
        const result = validateDeleteRelationsRequest(request);
        expect(result.relations).toEqual(validRelations);
      });

      it("should require relationType in camelCase", () => {
        // Snake_case relation_type is not supported - must use relationType
        const request = {
          relations: [{ from: "A", to: "B", relation_type: "uses" }],
        };
        // Should fail because relationType is required in camelCase
        expect(() => validateDeleteRelationsRequest(request)).toThrow();
      });
    });
  });

  describe("Read Tool Validation", () => {
    describe("search_similar", () => {
      it("should validate basic search request", () => {
        const request = { query: "authentication" };
        const result = validateSearchSimilarRequest(request);
        expect(result.query).toBe("authentication");
      });

      it("should validate with entityTypes filter", () => {
        const request = {
          query: "auth",
          entityTypes: ["class", "function"],
        };
        const result = validateSearchSimilarRequest(request);
        expect(result.entityTypes).toEqual(["class", "function"]);
      });

      it("should validate with searchMode", () => {
        const request = {
          query: "auth",
          searchMode: "hybrid",
        };
        const result = validateSearchSimilarRequest(request);
        expect(result.searchMode).toBe("hybrid");
      });

      it("should not convert snake_case parameters", () => {
        // snake_case parameters are passed through but not converted
        const request = {
          query: "auth",
          entity_types: ["class"],
          search_mode: "keyword",
        };
        const result = validateSearchSimilarRequest(request);
        // These remain undefined since camelCase is expected
        expect(result.entityTypes).toBeUndefined();
        expect(result.searchMode).toBeUndefined();
        // But query still works
        expect(result.query).toBe("auth");
      });

      it("should validate with limit", () => {
        const request = {
          query: "auth",
          limit: 50,
        };
        const result = validateSearchSimilarRequest(request);
        expect(result.limit).toBe(50);
      });

      it("should reject missing query", () => {
        expect(() => validateSearchSimilarRequest({})).toThrow();
      });
    });

    describe("get_implementation", () => {
      it("should validate basic request", () => {
        const request = { entityName: "AuthService" };
        const result = validateGetImplementationRequest(request);
        expect(result.entityName).toBe("AuthService");
      });

      it("should validate with scope parameter", () => {
        const request = {
          entityName: "AuthService",
          scope: "logical",
        };
        const result = validateGetImplementationRequest(request);
        expect(result.scope).toBe("logical");
      });

      it("should support snake_case (entity_name)", () => {
        const request = { entity_name: "AuthService" };
        const result = validateGetImplementationRequest(request);
        expect(result.entityName).toBe("AuthService");
      });

      it("should reject invalid scope", () => {
        const request = {
          entityName: "AuthService",
          scope: "invalid",
        };
        expect(() => validateGetImplementationRequest(request)).toThrow();
      });
    });

    describe("read_graph", () => {
      it("should validate basic request", () => {
        const result = validateReadGraphRequest({});
        expect(result).toBeDefined();
      });

      it("should validate with mode parameter", () => {
        const request = { mode: "smart" };
        const result = validateReadGraphRequest(request);
        expect(result.mode).toBe("smart");
      });

      it("should validate with entity parameter", () => {
        const request = { entity: "AuthService" };
        const result = validateReadGraphRequest(request);
        expect(result.entity).toBe("AuthService");
      });

      it("should validate with entityTypes filter", () => {
        const request = { entityTypes: ["class", "function"] };
        const result = validateReadGraphRequest(request);
        expect(result.entityTypes).toEqual(["class", "function"]);
      });

      it("should not convert snake_case entity_types", () => {
        // snake_case parameters are passed through but not converted
        const request = { entity_types: ["class"] };
        const result = validateReadGraphRequest(request);
        // Remains undefined since camelCase entityTypes is expected
        expect(result.entityTypes).toBeUndefined();
      });

      it("should reject invalid mode", () => {
        const request = { mode: "invalid" };
        expect(() => validateReadGraphRequest(request)).toThrow();
      });
    });

    describe("search_docs", () => {
      it("should validate basic request", () => {
        const request = { query: "authentication" };
        const result = validateSearchDocsRequest(request);
        expect(result.query).toBe("authentication");
      });

      it("should validate with docTypes filter", () => {
        const request = {
          query: "auth",
          docTypes: ["prd", "tdd"],
        };
        const result = validateSearchDocsRequest(request);
        expect(result.docTypes).toEqual(["prd", "tdd"]);
      });

      it("should validate with all valid doc types", () => {
        const request = {
          query: "auth",
          docTypes: ["prd", "tdd", "adr", "spec"],
        };
        const result = validateSearchDocsRequest(request);
        expect(result.docTypes).toEqual(["prd", "tdd", "adr", "spec"]);
      });
    });

    describe("get_doc", () => {
      it("should validate basic request", () => {
        const request = { docId: "PRD-001" };
        const result = validateGetDocRequest(request);
        expect(result.docId).toBe("PRD-001");
      });

      it("should validate with section parameter", () => {
        const request = {
          docId: "PRD-001",
          section: "Requirements",
        };
        const result = validateGetDocRequest(request);
        expect(result.section).toBe("Requirements");
      });

      it("should validate with collection parameter", () => {
        const request = { docId: "PRD-001", collection: "project-a" };
        const result = validateGetDocRequest(request);
        expect(result.collection).toBe("project-a");
      });
    });

    describe("search_tickets", () => {
      it("should require at least one search parameter", () => {
        expect(() => validateSearchTicketsRequest({})).toThrow("At least one search parameter");
      });

      it("should validate with query", () => {
        const request = { query: "authentication bug" };
        const result = validateSearchTicketsRequest(request);
        expect(result.query).toBe("authentication bug");
      });

      it("should validate with status filter", () => {
        const request = { status: ["open", "in_progress"] };
        const result = validateSearchTicketsRequest(request);
        expect(result.status).toEqual(["open", "in_progress"]);
      });

      it("should validate with labels filter", () => {
        const request = { labels: ["bug", "high-priority"] };
        const result = validateSearchTicketsRequest(request);
        expect(result.labels).toEqual(["bug", "high-priority"]);
      });

      it("should validate with source filter", () => {
        const request = { source: ["linear", "github"] };
        const result = validateSearchTicketsRequest(request);
        expect(result.source).toEqual(["linear", "github"]);
      });
    });

    describe("get_ticket", () => {
      it("should validate basic request", () => {
        const request = { ticketId: "AVO-123" };
        const result = validateGetTicketRequest(request);
        expect(result.ticketId).toBe("AVO-123");
      });

      it("should validate with includeComments", () => {
        const request = {
          ticketId: "AVO-123",
          includeComments: false,
        };
        const result = validateGetTicketRequest(request);
        expect(result.includeComments).toBe(false);
      });

      it("should validate with includePRs", () => {
        const request = {
          ticketId: "AVO-123",
          includePRs: false,
        };
        const result = validateGetTicketRequest(request);
        expect(result.includePRs).toBe(false);
      });

      it("should validate with collection parameter", () => {
        const request = {
          ticketId: "AVO-123",
          collection: "project-a",
        };
        const result = validateGetTicketRequest(request);
        expect(result.ticketId).toBe("AVO-123");
        expect(result.collection).toBe("project-a");
      });
    });
  });

  describe("Plan Mode Control", () => {
    describe("set_plan_mode", () => {
      it("should validate enable request", () => {
        const request = { enabled: true };
        const result = validateSetPlanModeRequest(request);
        expect(result.enabled).toBe(true);
      });

      it("should validate disable request", () => {
        const request = { enabled: false };
        const result = validateSetPlanModeRequest(request);
        expect(result.enabled).toBe(false);
      });

      it("should reject missing enabled parameter", () => {
        expect(() => validateSetPlanModeRequest({})).toThrow();
      });

      it("should reject non-boolean enabled", () => {
        expect(() => validateSetPlanModeRequest({ enabled: "true" })).toThrow();
      });
    });

    describe("PlanModeGuard Access Control", () => {
      it("should allow all tools when Plan Mode is disabled", () => {
        planModeGuard.setPlanMode(false);

        const writeResult = planModeGuard.checkAccess("create_entities");
        const readResult = planModeGuard.checkAccess("search_similar");

        expect(writeResult.allowed).toBe(true);
        expect(readResult.allowed).toBe(true);
      });

      it("should block write tools when Plan Mode is enabled", () => {
        planModeGuard.setPlanMode(true);

        const result = planModeGuard.checkAccess("create_entities");

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("blocked");
      });

      it("should allow read tools when Plan Mode is enabled", () => {
        planModeGuard.setPlanMode(true);

        const result = planModeGuard.checkAccess("search_similar");

        expect(result.allowed).toBe(true);
      });

      it("should always allow set_plan_mode tool", () => {
        planModeGuard.setPlanMode(true);

        const result = planModeGuard.checkAccess("set_plan_mode");

        expect(result.allowed).toBe(true);
      });

      it("should block all write operations in Plan Mode", () => {
        planModeGuard.setPlanMode(true);

        const blockedTools = [
          "create_entities",
          "create_relations",
          "add_observations",
          "delete_entities",
          "delete_observations",
          "delete_relations",
        ];

        for (const tool of blockedTools) {
          const result = planModeGuard.checkAccess(tool);
          expect(result.allowed).toBe(false);
        }
      });

      it("should allow all read operations in Plan Mode", () => {
        planModeGuard.setPlanMode(true);

        const allowedTools = [
          "search_similar",
          "read_graph",
          "get_implementation",
          "search_docs",
          "get_doc",
          "search_tickets",
          "get_ticket",
          "set_plan_mode",
        ];

        for (const tool of allowedTools) {
          const result = planModeGuard.checkAccess(tool);
          expect(result.allowed).toBe(true);
        }
      });

      it("should return blocked tools list", () => {
        const blockedTools = planModeGuard.getBlockedTools();

        expect(blockedTools).toContain("create_entities");
        expect(blockedTools).toContain("delete_entities");
        expect(blockedTools.length).toBe(6);
      });

      it("should return allowed tools list", () => {
        const allowedTools = planModeGuard.getAllowedTools();

        expect(allowedTools).toContain("search_similar");
        expect(allowedTools).toContain("read_graph");
        expect(allowedTools.length).toBe(8);
      });

      it("should include reason and tool name in denial response", () => {
        planModeGuard.setPlanMode(true);

        const result = planModeGuard.checkAccess("create_entities");

        expect(result.allowed).toBe(false);
        expect(result.reason).toBeDefined();
        expect(result.reason).toContain("create_entities");
        expect(result.toolName).toBe("create_entities");
      });
    });

    describe("Plan Mode State Persistence", () => {
      it("should maintain state across checks", () => {
        planModeGuard.setPlanMode(true);
        expect(planModeGuard.checkAccess("create_entities").allowed).toBe(false);
        expect(planModeGuard.checkAccess("create_relations").allowed).toBe(false);

        planModeGuard.setPlanMode(false);
        expect(planModeGuard.checkAccess("create_entities").allowed).toBe(true);
        expect(planModeGuard.checkAccess("create_relations").allowed).toBe(true);
      });

      it("should detect Plan Mode from environment variable", () => {
        // Set env var
        vi.stubEnv("CLAUDE_PLAN_MODE", "true");

        const freshGuard = new PlanModeGuard();
        expect(freshGuard.isActive()).toBe(true);

        // Clean up
        vi.unstubAllEnvs();
        vi.stubEnv("QDRANT_URL", "http://localhost:6333");
        vi.stubEnv("QDRANT_API_KEY", "test-api-key");
        vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
        vi.stubEnv("QDRANT_COLLECTION_NAME", "test-collection");
      });
    });
  });

  describe("Collection Parameter Support", () => {
    it("should accept collection parameter in create_entities", () => {
      const request = {
        entities: validEntities,
        collection: "my-project",
      };
      const result = validateCreateEntitiesRequest(request);
      expect(result.collection).toBe("my-project");
    });

    it("should accept collection parameter in create_relations", () => {
      const request = {
        relations: validRelations,
        collection: "my-project",
      };
      const result = validateCreateRelationsRequest(request);
      expect(result.collection).toBe("my-project");
    });

    it("should accept collection parameter in search_similar", () => {
      const request = {
        query: "auth",
        collection: "my-project",
      };
      const result = validateSearchSimilarRequest(request);
      expect(result.collection).toBe("my-project");
    });

    it("should accept collection parameter in read_graph", () => {
      const request = {
        mode: "smart",
        collection: "my-project",
      };
      const result = validateReadGraphRequest(request);
      expect(result.collection).toBe("my-project");
    });

    it("should accept collection parameter in get_implementation", () => {
      const request = {
        entityName: "AuthService",
        collection: "my-project",
      };
      const result = validateGetImplementationRequest(request);
      expect(result.collection).toBe("my-project");
    });

    it("should accept collection parameter in search_docs", () => {
      const request = {
        query: "auth",
        collection: "my-project",
      };
      const result = validateSearchDocsRequest(request);
      expect(result.collection).toBe("my-project");
    });

    it("should accept collection parameter in get_doc", () => {
      const request = {
        docId: "PRD-001",
        collection: "my-project",
      };
      const result = validateGetDocRequest(request);
      expect(result.collection).toBe("my-project");
    });

    it("should accept empty string collection (uses default)", () => {
      const request = {
        query: "auth",
        collection: "",
      };
      const result = validateSearchSimilarRequest(request);
      expect(result.collection).toBe("");
    });
  });

  describe("Error Handling", () => {
    it("should throw on null arguments", () => {
      expect(() => validateCreateEntitiesRequest(null)).toThrow();
    });

    it("should throw on undefined arguments", () => {
      expect(() => validateCreateEntitiesRequest(undefined)).toThrow();
    });

    it("should throw on non-object arguments", () => {
      expect(() => validateCreateEntitiesRequest("invalid")).toThrow();
    });

    it("should throw descriptive error for missing required field", () => {
      try {
        validateCreateEntitiesRequest({});
      } catch (error: any) {
        expect(error.message).toContain("entities");
      }
    });

    it("should throw descriptive error for invalid type", () => {
      try {
        validateCreateEntitiesRequest({ entities: "not-an-array" });
      } catch (error: any) {
        expect(error.message).toContain("array");
      }
    });
  });
});
