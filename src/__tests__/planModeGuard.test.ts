import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PlanModeGuard } from "../plan-mode-guard.js";

// Mock console.error to suppress logging during tests
vi.spyOn(console, "error").mockImplementation(() => {});

describe("plan-mode-guard.ts", () => {
  describe("PlanModeGuard", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    describe("constructor", () => {
      it("should default to inactive when no env var set", () => {
        const guard = new PlanModeGuard();
        expect(guard.isActive()).toBe(false);
      });

      it("should detect CLAUDE_PLAN_MODE=true", () => {
        vi.stubEnv("CLAUDE_PLAN_MODE", "true");
        const guard = new PlanModeGuard();
        expect(guard.isActive()).toBe(true);
      });

      it("should detect CLAUDE_PLAN_MODE=1", () => {
        vi.stubEnv("CLAUDE_PLAN_MODE", "1");
        const guard = new PlanModeGuard();
        expect(guard.isActive()).toBe(true);
      });

      it("should detect CLAUDE_PLAN_MODE=yes", () => {
        vi.stubEnv("CLAUDE_PLAN_MODE", "yes");
        const guard = new PlanModeGuard();
        expect(guard.isActive()).toBe(true);
      });

      it("should detect CLAUDE_PLAN_MODE=on", () => {
        vi.stubEnv("CLAUDE_PLAN_MODE", "on");
        const guard = new PlanModeGuard();
        expect(guard.isActive()).toBe(true);
      });

      it("should be case-insensitive for TRUE", () => {
        vi.stubEnv("CLAUDE_PLAN_MODE", "TRUE");
        const guard = new PlanModeGuard();
        expect(guard.isActive()).toBe(true);
      });

      it("should be case-insensitive for Yes", () => {
        vi.stubEnv("CLAUDE_PLAN_MODE", "Yes");
        const guard = new PlanModeGuard();
        expect(guard.isActive()).toBe(true);
      });

      it("should ignore invalid values", () => {
        vi.stubEnv("CLAUDE_PLAN_MODE", "invalid");
        const guard = new PlanModeGuard();
        expect(guard.isActive()).toBe(false);
      });

      it("should ignore empty string", () => {
        vi.stubEnv("CLAUDE_PLAN_MODE", "");
        const guard = new PlanModeGuard();
        expect(guard.isActive()).toBe(false);
      });

      it("should ignore false value", () => {
        vi.stubEnv("CLAUDE_PLAN_MODE", "false");
        const guard = new PlanModeGuard();
        expect(guard.isActive()).toBe(false);
      });
    });

    describe("setPlanMode", () => {
      let guard: PlanModeGuard;

      beforeEach(() => {
        guard = new PlanModeGuard();
      });

      it("should enable Plan Mode", () => {
        guard.setPlanMode(true);
        expect(guard.isActive()).toBe(true);
      });

      it("should disable Plan Mode", () => {
        guard.setPlanMode(true);
        guard.setPlanMode(false);
        expect(guard.isActive()).toBe(false);
      });

      it("should toggle Plan Mode multiple times", () => {
        expect(guard.isActive()).toBe(false);
        guard.setPlanMode(true);
        expect(guard.isActive()).toBe(true);
        guard.setPlanMode(false);
        expect(guard.isActive()).toBe(false);
        guard.setPlanMode(true);
        expect(guard.isActive()).toBe(true);
      });
    });

    describe("checkAccess", () => {
      let guard: PlanModeGuard;

      beforeEach(() => {
        guard = new PlanModeGuard();
      });

      describe("when Plan Mode is inactive", () => {
        it("should allow all tools", () => {
          const result = guard.checkAccess("create_entities");
          expect(result.allowed).toBe(true);
          expect(result.reason).toBe("Plan Mode not active");
        });

        it("should include tool name in result", () => {
          const result = guard.checkAccess("some_tool");
          expect(result.toolName).toBe("some_tool");
        });

        it("should allow write operations when inactive", () => {
          expect(guard.checkAccess("create_entities").allowed).toBe(true);
          expect(guard.checkAccess("delete_entities").allowed).toBe(true);
          expect(guard.checkAccess("add_observations").allowed).toBe(true);
        });
      });

      describe("when Plan Mode is active", () => {
        beforeEach(() => {
          guard.setPlanMode(true);
        });

        // Test blocked tools
        it("should block create_entities", () => {
          const result = guard.checkAccess("create_entities");
          expect(result.allowed).toBe(false);
          expect(result.toolName).toBe("create_entities");
        });

        it("should block create_relations", () => {
          const result = guard.checkAccess("create_relations");
          expect(result.allowed).toBe(false);
        });

        it("should block add_observations", () => {
          const result = guard.checkAccess("add_observations");
          expect(result.allowed).toBe(false);
        });

        it("should block delete_entities", () => {
          const result = guard.checkAccess("delete_entities");
          expect(result.allowed).toBe(false);
        });

        it("should block delete_observations", () => {
          const result = guard.checkAccess("delete_observations");
          expect(result.allowed).toBe(false);
        });

        it("should block delete_relations", () => {
          const result = guard.checkAccess("delete_relations");
          expect(result.allowed).toBe(false);
        });

        // Test allowed tools
        it("should allow search_similar", () => {
          const result = guard.checkAccess("search_similar");
          expect(result.allowed).toBe(true);
          expect(result.reason).toBe("Tool allowed in Plan Mode");
        });

        it("should allow read_graph", () => {
          const result = guard.checkAccess("read_graph");
          expect(result.allowed).toBe(true);
        });

        it("should allow get_implementation", () => {
          const result = guard.checkAccess("get_implementation");
          expect(result.allowed).toBe(true);
        });

        it("should allow search_docs", () => {
          const result = guard.checkAccess("search_docs");
          expect(result.allowed).toBe(true);
        });

        it("should allow get_doc", () => {
          const result = guard.checkAccess("get_doc");
          expect(result.allowed).toBe(true);
        });

        it("should allow search_tickets", () => {
          const result = guard.checkAccess("search_tickets");
          expect(result.allowed).toBe(true);
        });

        it("should allow get_ticket", () => {
          const result = guard.checkAccess("get_ticket");
          expect(result.allowed).toBe(true);
        });

        it("should always allow set_plan_mode", () => {
          const result = guard.checkAccess("set_plan_mode");
          expect(result.allowed).toBe(true);
        });

        it("should allow unknown tools by default", () => {
          const result = guard.checkAccess("unknown_new_tool");
          expect(result.allowed).toBe(true);
        });

        it("should include blocked tools list in reason for blocked tools", () => {
          const result = guard.checkAccess("create_entities");
          expect(result.reason).toContain("create_entities");
          expect(result.reason).toContain("blocked");
        });
      });
    });

    describe("getBlockedTools", () => {
      let guard: PlanModeGuard;

      beforeEach(() => {
        guard = new PlanModeGuard();
      });

      it("should return list of blocked tools", () => {
        const blocked = guard.getBlockedTools();
        expect(blocked).toContain("create_entities");
        expect(blocked).toContain("create_relations");
        expect(blocked).toContain("add_observations");
        expect(blocked).toContain("delete_entities");
        expect(blocked).toContain("delete_observations");
        expect(blocked).toContain("delete_relations");
      });

      it("should return exactly 6 blocked tools", () => {
        const blocked = guard.getBlockedTools();
        expect(blocked.length).toBe(6);
      });

      it("should return a copy (not reference)", () => {
        const blocked1 = guard.getBlockedTools();
        blocked1.push("custom_tool");
        const blocked2 = guard.getBlockedTools();
        expect(blocked2).not.toContain("custom_tool");
        expect(blocked2.length).toBe(6);
      });
    });

    describe("getAllowedTools", () => {
      let guard: PlanModeGuard;

      beforeEach(() => {
        guard = new PlanModeGuard();
      });

      it("should return list of allowed tools", () => {
        const allowed = guard.getAllowedTools();
        expect(allowed).toContain("search_similar");
        expect(allowed).toContain("read_graph");
        expect(allowed).toContain("get_implementation");
        expect(allowed).toContain("search_docs");
        expect(allowed).toContain("get_doc");
        expect(allowed).toContain("search_tickets");
        expect(allowed).toContain("get_ticket");
        expect(allowed).toContain("set_plan_mode");
      });

      it("should return exactly 8 allowed tools", () => {
        const allowed = guard.getAllowedTools();
        expect(allowed.length).toBe(8);
      });

      it("should return a copy (not reference)", () => {
        const allowed1 = guard.getAllowedTools();
        allowed1.push("custom_tool");
        const allowed2 = guard.getAllowedTools();
        expect(allowed2).not.toContain("custom_tool");
        expect(allowed2.length).toBe(8);
      });
    });
  });
});
