import { describe, it, expect, vi } from "vitest";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
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
} from "../validation.js";

// Mock console.error to suppress debug logging
vi.spyOn(console, "error").mockImplementation(() => {});

describe("validation.ts", () => {
  describe("validateCreateEntitiesRequest", () => {
    it("should accept valid entities with camelCase entityType", () => {
      const input = {
        entities: [
          { name: "TestEntity", entityType: "class", observations: ["obs1"] },
        ],
      };
      expect(() => validateCreateEntitiesRequest(input)).not.toThrow();
    });

    it("should accept valid entities with snake_case entity_type", () => {
      const input = {
        entities: [
          { name: "TestEntity", entity_type: "function", observations: [] },
        ],
      };
      expect(() => validateCreateEntitiesRequest(input)).not.toThrow();
    });

    it("should accept optional collection parameter", () => {
      const input = {
        entities: [{ name: "Test", entityType: "class", observations: [] }],
        collection: "my-collection",
      };
      const result = validateCreateEntitiesRequest(input);
      expect(result.collection).toBe("my-collection");
    });

    it("should throw on non-object input", () => {
      expect(() => validateCreateEntitiesRequest(null)).toThrow(McpError);
      expect(() => validateCreateEntitiesRequest("string")).toThrow(McpError);
      expect(() => validateCreateEntitiesRequest(123)).toThrow(McpError);
    });

    it("should throw on missing entities array", () => {
      expect(() => validateCreateEntitiesRequest({})).toThrow(McpError);
    });

    it("should throw on invalid entity structure", () => {
      const input = { entities: [{ name: "Test" }] }; // missing entityType, observations
      expect(() => validateCreateEntitiesRequest(input)).toThrow(McpError);
    });

    it("should throw on non-string collection", () => {
      const input = {
        entities: [{ name: "Test", entityType: "class", observations: [] }],
        collection: 123,
      };
      expect(() => validateCreateEntitiesRequest(input)).toThrow(McpError);
    });

    it("should throw on non-array observations", () => {
      const input = {
        entities: [
          { name: "Test", entityType: "class", observations: "not-an-array" },
        ],
      };
      expect(() => validateCreateEntitiesRequest(input)).toThrow(McpError);
    });

    it("should throw on non-string observation items", () => {
      const input = {
        entities: [{ name: "Test", entityType: "class", observations: [123] }],
      };
      expect(() => validateCreateEntitiesRequest(input)).toThrow(McpError);
    });

    it("should accept multiple entities", () => {
      const input = {
        entities: [
          { name: "Entity1", entityType: "class", observations: [] },
          { name: "Entity2", entityType: "function", observations: ["obs"] },
        ],
      };
      const result = validateCreateEntitiesRequest(input);
      expect(result.entities.length).toBe(2);
    });
  });

  describe("validateCreateRelationsRequest", () => {
    it("should accept valid relations", () => {
      const input = {
        relations: [{ from: "A", to: "B", relationType: "imports" }],
      };
      expect(() => validateCreateRelationsRequest(input)).not.toThrow();
    });

    it("should throw on invalid relation structure", () => {
      const input = { relations: [{ from: "A" }] };
      expect(() => validateCreateRelationsRequest(input)).toThrow(McpError);
    });

    it("should throw on missing to field", () => {
      const input = { relations: [{ from: "A", relationType: "uses" }] };
      expect(() => validateCreateRelationsRequest(input)).toThrow(McpError);
    });

    it("should throw on missing relationType", () => {
      const input = { relations: [{ from: "A", to: "B" }] };
      expect(() => validateCreateRelationsRequest(input)).toThrow(McpError);
    });

    it("should accept collection parameter", () => {
      const input = {
        relations: [{ from: "A", to: "B", relationType: "uses" }],
        collection: "test-collection",
      };
      const result = validateCreateRelationsRequest(input);
      expect(result.collection).toBe("test-collection");
    });

    it("should throw on non-object input", () => {
      expect(() => validateCreateRelationsRequest(null)).toThrow(McpError);
    });
  });

  describe("validateAddObservationsRequest", () => {
    it("should accept valid observations", () => {
      const input = {
        observations: [{ entityName: "Test", contents: ["obs1", "obs2"] }],
      };
      expect(() => validateAddObservationsRequest(input)).not.toThrow();
    });

    it("should throw on invalid observations array", () => {
      expect(() => validateAddObservationsRequest({})).toThrow(McpError);
    });

    it("should throw on missing entityName", () => {
      const input = {
        observations: [{ contents: ["obs1"] }],
      };
      expect(() => validateAddObservationsRequest(input)).toThrow(McpError);
    });

    it("should throw on non-array contents", () => {
      const input = {
        observations: [{ entityName: "Test", contents: "not-array" }],
      };
      expect(() => validateAddObservationsRequest(input)).toThrow(McpError);
    });

    it("should throw on non-string contents items", () => {
      const input = {
        observations: [{ entityName: "Test", contents: [123] }],
      };
      expect(() => validateAddObservationsRequest(input)).toThrow(McpError);
    });
  });

  describe("validateDeleteEntitiesRequest", () => {
    it("should accept valid entity names", () => {
      const input = { entityNames: ["Entity1", "Entity2"] };
      expect(() => validateDeleteEntitiesRequest(input)).not.toThrow();
    });

    it("should throw on non-array entityNames", () => {
      const input = { entityNames: "not-array" };
      expect(() => validateDeleteEntitiesRequest(input)).toThrow(McpError);
    });

    it("should throw on non-string items in entityNames", () => {
      const input = { entityNames: [123, "valid"] };
      expect(() => validateDeleteEntitiesRequest(input)).toThrow(McpError);
    });

    it("should accept collection parameter", () => {
      const input = { entityNames: ["Entity1"], collection: "test" };
      const result = validateDeleteEntitiesRequest(input);
      expect(result.collection).toBe("test");
    });
  });

  describe("validateDeleteObservationsRequest", () => {
    it("should accept valid deletions", () => {
      const input = {
        deletions: [{ entityName: "Test", observations: ["obs1"] }],
      };
      expect(() => validateDeleteObservationsRequest(input)).not.toThrow();
    });

    it("should throw on missing deletions array", () => {
      expect(() => validateDeleteObservationsRequest({})).toThrow(McpError);
    });

    it("should throw on invalid deletion format", () => {
      const input = {
        deletions: [{ entityName: 123, observations: ["obs1"] }],
      };
      expect(() => validateDeleteObservationsRequest(input)).toThrow(McpError);
    });
  });

  describe("validateDeleteRelationsRequest", () => {
    it("should accept valid relations to delete", () => {
      const input = {
        relations: [{ from: "A", to: "B", relationType: "uses" }],
      };
      expect(() => validateDeleteRelationsRequest(input)).not.toThrow();
    });

    it("should throw on invalid relations array", () => {
      const input = { relations: [{ from: "A" }] };
      expect(() => validateDeleteRelationsRequest(input)).toThrow(McpError);
    });
  });

  describe("validateSearchSimilarRequest", () => {
    it("should accept valid query", () => {
      const input = { query: "authentication" };
      const result = validateSearchSimilarRequest(input);
      expect(result.query).toBe("authentication");
    });

    it("should accept optional limit", () => {
      const input = { query: "test", limit: 10 };
      const result = validateSearchSimilarRequest(input);
      expect(result.limit).toBe(10);
    });

    it("should accept valid searchMode values", () => {
      ["semantic", "keyword", "hybrid"].forEach((mode) => {
        const input = { query: "test", searchMode: mode };
        expect(() => validateSearchSimilarRequest(input)).not.toThrow();
      });
    });

    it("should throw on invalid searchMode", () => {
      const input = { query: "test", searchMode: "invalid" };
      expect(() => validateSearchSimilarRequest(input)).toThrow(McpError);
    });

    it("should throw on missing query", () => {
      const input = { limit: 10 };
      expect(() => validateSearchSimilarRequest(input)).toThrow(McpError);
    });

    it("should throw on non-string query", () => {
      const input = { query: 123 };
      expect(() => validateSearchSimilarRequest(input)).toThrow(McpError);
    });

    it("should throw on negative limit", () => {
      const input = { query: "test", limit: -1 };
      expect(() => validateSearchSimilarRequest(input)).toThrow(McpError);
    });

    it("should throw on zero limit", () => {
      const input = { query: "test", limit: 0 };
      expect(() => validateSearchSimilarRequest(input)).toThrow(McpError);
    });

    it("should accept entityTypes array", () => {
      const input = { query: "test", entityTypes: ["class", "function"] };
      const result = validateSearchSimilarRequest(input);
      expect(result.entityTypes).toEqual(["class", "function"]);
    });

    it("should throw on non-array entityTypes", () => {
      const input = { query: "test", entityTypes: "class" };
      expect(() => validateSearchSimilarRequest(input)).toThrow(McpError);
    });

    it("should throw on non-string items in entityTypes", () => {
      const input = { query: "test", entityTypes: [123] };
      expect(() => validateSearchSimilarRequest(input)).toThrow(McpError);
    });
  });

  describe("validateGetImplementationRequest", () => {
    it("should accept entityName in camelCase", () => {
      const input = { entityName: "MyClass" };
      const result = validateGetImplementationRequest(input);
      expect(result.entityName).toBe("MyClass");
    });

    it("should accept entity_name in snake_case", () => {
      const input = { entity_name: "MyClass" };
      const result = validateGetImplementationRequest(input);
      expect(result.entityName).toBe("MyClass");
    });

    it("should default scope to minimal", () => {
      const input = { entityName: "Test" };
      const result = validateGetImplementationRequest(input);
      expect(result.scope).toBe("minimal");
    });

    it("should accept valid scope values", () => {
      ["minimal", "logical", "dependencies"].forEach((scope) => {
        const input = { entityName: "Test", scope };
        expect(() => validateGetImplementationRequest(input)).not.toThrow();
      });
    });

    it("should throw on invalid scope", () => {
      const input = { entityName: "Test", scope: "invalid" };
      expect(() => validateGetImplementationRequest(input)).toThrow(McpError);
    });

    it("should throw on missing entityName", () => {
      const input = { scope: "minimal" };
      expect(() => validateGetImplementationRequest(input)).toThrow(McpError);
    });

    it("should throw on non-string entityName", () => {
      const input = { entityName: 123 };
      expect(() => validateGetImplementationRequest(input)).toThrow(McpError);
    });
  });

  describe("validateReadGraphRequest", () => {
    it("should accept empty object", () => {
      expect(() => validateReadGraphRequest({})).not.toThrow();
    });

    it("should accept valid mode values", () => {
      ["smart", "entities", "relationships", "raw"].forEach((mode) => {
        expect(() => validateReadGraphRequest({ mode })).not.toThrow();
      });
    });

    it("should throw on invalid mode", () => {
      expect(() => validateReadGraphRequest({ mode: "invalid" })).toThrow(
        McpError
      );
    });

    it("should accept entity parameter for filtering", () => {
      const input = { entity: "AuthService", mode: "smart" };
      const result = validateReadGraphRequest(input);
      expect(result.entity).toBe("AuthService");
    });

    it("should throw on non-string entity", () => {
      const input = { entity: 123 };
      expect(() => validateReadGraphRequest(input)).toThrow(McpError);
    });

    it("should accept limit parameter", () => {
      const input = { limit: 50 };
      const result = validateReadGraphRequest(input);
      expect(result.limit).toBe(50);
    });

    it("should throw on invalid limit", () => {
      expect(() => validateReadGraphRequest({ limit: -1 })).toThrow(McpError);
      expect(() => validateReadGraphRequest({ limit: 0 })).toThrow(McpError);
    });

    it("should accept entityTypes array", () => {
      const input = { entityTypes: ["class", "function"] };
      const result = validateReadGraphRequest(input);
      expect(result.entityTypes).toEqual(["class", "function"]);
    });
  });

  describe("validateSearchDocsRequest", () => {
    it("should accept valid query", () => {
      const input = { query: "authentication" };
      const result = validateSearchDocsRequest(input);
      expect(result.query).toBe("authentication");
    });

    it("should require non-empty query", () => {
      expect(() => validateSearchDocsRequest({ query: "" })).toThrow(McpError);
      expect(() => validateSearchDocsRequest({ query: "   " })).toThrow(
        McpError
      );
    });

    it("should accept valid docTypes", () => {
      const input = { query: "auth", docTypes: ["prd", "tdd", "adr", "spec"] };
      expect(() => validateSearchDocsRequest(input)).not.toThrow();
    });

    it("should throw on invalid docType", () => {
      const input = { query: "auth", docTypes: ["invalid"] };
      expect(() => validateSearchDocsRequest(input)).toThrow(McpError);
    });

    it("should accept limit parameter", () => {
      const input = { query: "test", limit: 20 };
      const result = validateSearchDocsRequest(input);
      expect(result.limit).toBe(20);
    });
  });

  describe("validateGetDocRequest", () => {
    it("should accept valid docId", () => {
      const input = { docId: "doc-123" };
      const result = validateGetDocRequest(input);
      expect(result.docId).toBe("doc-123");
    });

    it("should require non-empty docId", () => {
      expect(() => validateGetDocRequest({ docId: "" })).toThrow(McpError);
      expect(() => validateGetDocRequest({ docId: "   " })).toThrow(McpError);
    });

    it("should accept optional section", () => {
      const input = { docId: "doc-123", section: "Introduction" };
      const result = validateGetDocRequest(input);
      expect(result.section).toBe("Introduction");
    });

    it("should throw on non-string section", () => {
      const input = { docId: "doc-123", section: 123 };
      expect(() => validateGetDocRequest(input)).toThrow(McpError);
    });
  });

  describe("validateSearchTicketsRequest", () => {
    it("should require at least one search parameter", () => {
      expect(() => validateSearchTicketsRequest({})).toThrow(McpError);
    });

    it("should accept query parameter", () => {
      const input = { query: "bug fix" };
      const result = validateSearchTicketsRequest(input);
      expect(result.query).toBe("bug fix");
    });

    it("should accept valid status values", () => {
      const input = { status: ["open", "in_progress", "done", "cancelled"] };
      expect(() => validateSearchTicketsRequest(input)).not.toThrow();
    });

    it("should throw on invalid status", () => {
      const input = { status: ["invalid"] };
      expect(() => validateSearchTicketsRequest(input)).toThrow(McpError);
    });

    it("should accept valid source values", () => {
      const input = { source: ["linear", "github"] };
      expect(() => validateSearchTicketsRequest(input)).not.toThrow();
    });

    it("should throw on invalid source", () => {
      const input = { source: ["jira"] };
      expect(() => validateSearchTicketsRequest(input)).toThrow(McpError);
    });

    it("should accept labels array", () => {
      const input = { labels: ["bug", "critical"] };
      const result = validateSearchTicketsRequest(input);
      expect(result.labels).toEqual(["bug", "critical"]);
    });

    it("should throw on non-string labels", () => {
      const input = { labels: [123] };
      expect(() => validateSearchTicketsRequest(input)).toThrow(McpError);
    });
  });

  describe("validateGetTicketRequest", () => {
    it("should accept valid ticketId", () => {
      const input = { ticketId: "PROJ-123" };
      const result = validateGetTicketRequest(input);
      expect(result.ticketId).toBe("PROJ-123");
    });

    it("should require non-empty ticketId", () => {
      expect(() => validateGetTicketRequest({ ticketId: "" })).toThrow(
        McpError
      );
      expect(() => validateGetTicketRequest({ ticketId: "   " })).toThrow(
        McpError
      );
    });

    it("should accept includeComments boolean", () => {
      const input = { ticketId: "PROJ-123", includeComments: true };
      const result = validateGetTicketRequest(input);
      expect(result.includeComments).toBe(true);
    });

    it("should throw on non-boolean includeComments", () => {
      const input = { ticketId: "PROJ-123", includeComments: "true" };
      expect(() => validateGetTicketRequest(input)).toThrow(McpError);
    });

    it("should accept includePRs boolean", () => {
      const input = { ticketId: "PROJ-123", includePRs: false };
      const result = validateGetTicketRequest(input);
      expect(result.includePRs).toBe(false);
    });

    it("should throw on non-boolean includePRs", () => {
      const input = { ticketId: "PROJ-123", includePRs: 1 };
      expect(() => validateGetTicketRequest(input)).toThrow(McpError);
    });
  });

  describe("validateSetPlanModeRequest", () => {
    it("should accept boolean enabled true", () => {
      const result = validateSetPlanModeRequest({ enabled: true });
      expect(result.enabled).toBe(true);
    });

    it("should accept boolean enabled false", () => {
      const result = validateSetPlanModeRequest({ enabled: false });
      expect(result.enabled).toBe(false);
    });

    it("should throw on string enabled", () => {
      expect(() => validateSetPlanModeRequest({ enabled: "true" })).toThrow(
        McpError
      );
    });

    it("should throw on number enabled", () => {
      expect(() => validateSetPlanModeRequest({ enabled: 1 })).toThrow(
        McpError
      );
    });

    it("should throw on missing enabled", () => {
      expect(() => validateSetPlanModeRequest({})).toThrow(McpError);
    });

    it("should throw on non-object input", () => {
      expect(() => validateSetPlanModeRequest(null)).toThrow(McpError);
      expect(() => validateSetPlanModeRequest("true")).toThrow(McpError);
    });
  });
});
