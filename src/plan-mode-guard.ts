/**
 * Plan Mode Access Control for MCP Server
 *
 * Implements read-only access enforcement during Claude Code Plan Mode.
 * When Plan Mode is active, write operations are blocked to prevent
 * accidental modifications during the planning phase.
 *
 * Milestone 8.4: Plan Mode Tool Access Control
 */

import { planModeLogger } from "./logger.js";

/**
 * Result of an access control check
 */
export interface AccessCheckResult {
  /** Whether the tool is allowed to execute */
  allowed: boolean;
  /** Human-readable reason for the decision */
  reason: string;
  /** Name of the tool being checked */
  toolName: string;
}

/**
 * Tools that are blocked during Plan Mode (write operations)
 */
const PLAN_MODE_BLOCKED: string[] = [
  "create_entities",
  "create_relations",
  "add_observations",
  "delete_entities",
  "delete_observations",
  "delete_relations",
];

/**
 * Tools that are explicitly allowed during Plan Mode (read operations)
 * Note: Any tool not in BLOCKED list is allowed, but this list
 * documents the expected read-only tools
 */
const PLAN_MODE_ALLOWED: string[] = [
  "search_similar",
  "read_graph",
  "get_implementation",
  "search_docs",
  "get_doc",
  "search_tickets",
  "get_ticket",
  "set_plan_mode", // Control tool - always allowed
];

/**
 * Environment variable name for Plan Mode detection
 * Matches Python implementation in claude_indexer/hooks/plan_mode_detector.py
 */
const PLAN_MODE_ENV_VAR = "CLAUDE_PLAN_MODE";

/**
 * PlanModeGuard - Access control for MCP tools during Plan Mode
 *
 * When Plan Mode is active (via environment variable or explicit setting),
 * write operations are blocked to ensure read-only access during planning.
 *
 * @example
 * ```typescript
 * const guard = new PlanModeGuard();
 *
 * // Check if a tool is allowed
 * const result = guard.checkAccess("create_entities");
 * if (!result.allowed) {
 *   // Handle blocked tool
 *   throw new Error(result.reason);
 * }
 *
 * // Explicitly enable/disable Plan Mode
 * guard.setPlanMode(true);  // Enable read-only mode
 * guard.setPlanMode(false); // Disable read-only mode
 * ```
 */
export class PlanModeGuard {
  private isPlanModeActive: boolean;

  constructor() {
    this.isPlanModeActive = this.detectFromEnvironment();
    if (this.isPlanModeActive) {
      planModeLogger.info("Plan Mode detected from environment", {
        envVar: PLAN_MODE_ENV_VAR,
      });
    }
  }

  /**
   * Detect Plan Mode from environment variable
   * Matches Python implementation: accepts "true", "1", "yes", "on" (case-insensitive)
   */
  private detectFromEnvironment(): boolean {
    const envValue = process.env[PLAN_MODE_ENV_VAR]?.toLowerCase();
    return ["true", "1", "yes", "on"].includes(envValue || "");
  }

  /**
   * Explicitly set Plan Mode state
   * @param enabled - true to enable Plan Mode (read-only), false to disable
   */
  setPlanMode(enabled: boolean): void {
    const previousState = this.isPlanModeActive;
    this.isPlanModeActive = enabled;
    planModeLogger.info("Plan Mode state changed", {
      enabled,
      previousState,
    });
  }

  /**
   * Check if Plan Mode is currently active
   */
  isActive(): boolean {
    return this.isPlanModeActive;
  }

  /**
   * Check if a tool is allowed to execute
   * @param toolName - Name of the MCP tool
   * @returns AccessCheckResult with allowed status and reason
   */
  checkAccess(toolName: string): AccessCheckResult {
    // If Plan Mode is not active, all tools are allowed
    if (!this.isPlanModeActive) {
      return {
        allowed: true,
        reason: "Plan Mode not active",
        toolName,
      };
    }

    // Check if the tool is blocked in Plan Mode
    if (PLAN_MODE_BLOCKED.includes(toolName)) {
      return {
        allowed: false,
        reason: `Tool '${toolName}' is blocked in Plan Mode. Plan Mode only allows read-only operations. Blocked tools: ${PLAN_MODE_BLOCKED.join(", ")}`,
        toolName,
      };
    }

    // Tool is allowed
    return {
      allowed: true,
      reason: "Tool allowed in Plan Mode",
      toolName,
    };
  }

  /**
   * Get list of blocked tools (for documentation/display)
   */
  getBlockedTools(): string[] {
    return [...PLAN_MODE_BLOCKED];
  }

  /**
   * Get list of allowed tools (for documentation/display)
   */
  getAllowedTools(): string[] {
    return [...PLAN_MODE_ALLOWED];
  }
}
