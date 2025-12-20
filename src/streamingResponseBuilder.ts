/**
 * StreamingResponseBuilder for progressive content building with token enforcement
 * Builds responses section by section while monitoring token usage in real-time
 */

import type {
  Entity,
  Relation,
  SmartGraph,
  StreamingGraphResponse,
  TokenBudget,
  ScrollOptions,
} from "./types.js";
import { KnowledgeGraph, ContentSection } from "./types.js";
import { tokenCounter, TOKEN_CONFIG } from "./tokenCounter.js";

// Section priorities for consistent ordering
const SECTION_PRIORITIES = {
  SUMMARY: 5, // Highest - always include
  API_SURFACE: 4, // High - core functionality
  FILE_STRUCTURE: 3, // Medium - structure overview
  DEPENDENCIES: 2, // Medium - external deps
  RELATIONS: 1, // Lowest - detailed connections
} as const;

// Minimum token reserves for sections
const MIN_TOKEN_RESERVES = {
  FILE_STRUCTURE: 1000,
  API_SURFACE: 500,
  DEPENDENCIES: 300,
  RELATIONS: 200,
} as const;

export class StreamingResponseBuilder {
  /**
   * Build streaming response with progressive content and token enforcement
   */
  async buildStreamingResponse(
    entities: Entity[],
    relations: Relation[],
    options: ScrollOptions = {}
  ): Promise<StreamingGraphResponse> {
    const mode = options.mode || "smart";
    const limit = options.limit || 50;
    const tokenLimit = TOKEN_CONFIG.DEFAULT_TOKEN_LIMIT;

    // Test filtering: OFF by default in smart mode (user decision)
    // Set includeTests explicitly to true to include test code
    const includeTests = options.includeTests ?? false;

    // Filter out test code unless explicitly included
    let filteredEntities = entities;
    let filteredRelations = relations;
    if (!includeTests) {
      filteredEntities = entities.filter((e) => !this.isTestCode(e));
      // Also filter relations involving test entities
      const testEntityNames = new Set(
        entities.filter((e) => this.isTestCode(e)).map((e) => e.name)
      );
      filteredRelations = relations.filter(
        (r) => !testEntityNames.has(r.from) && !testEntityNames.has(r.to)
      );
    }

    const budget = tokenCounter.createBudget(tokenLimit);
    const context = {
      entities: filteredEntities,
      relations: filteredRelations,
      limit,
      budget,
      sectionsIncluded: [] as string[],
      truncated: false,
      truncationReason: undefined as string | undefined,
    };

    try {
      const builders = {
        smart: () => this.buildSmartStreamingResponse(context),
        entities: () => this.buildEntitiesStreamingResponse(context, options),
        relationships: () => this.buildRelationshipsStreamingResponse(context),
        raw: () => this.buildRawStreamingResponse(context),
      };

      const builder = builders[mode];
      if (!builder) {
        throw new Error(`Unknown mode: ${mode}`);
      }

      return await builder();
    } catch (error) {
      return this.createErrorResponse(error, tokenLimit);
    }
  }

  /**
   * Create error response with consistent format
   */
  private createErrorResponse(error: any, tokenLimit: number): StreamingGraphResponse {
    return {
      content: { entities: [], relations: [] },
      meta: {
        tokenCount: 0,
        tokenLimit,
        truncated: true,
        truncationReason: `Error building response: ${error}`,
        sectionsIncluded: [],
      },
    };
  }

  /**
   * Build smart mode response with progressive section building
   */
  private async buildSmartStreamingResponse(context: {
    entities: Entity[];
    relations: Relation[];
    limit: number;
    budget: TokenBudget;
    sectionsIncluded: string[];
    truncated: boolean;
    truncationReason?: string;
  }): Promise<StreamingGraphResponse> {
    const { entities, relations, limit } = context;
    const smartGraph: Partial<SmartGraph> = {};

    // Define sections with their builders, priorities, and minimum token reserves
    const sections = [
      {
        name: "summary",
        priority: SECTION_PRIORITIES.SUMMARY,
        minTokens: 0, // Always try to include
        builder: () => this.buildSummarySection(entities, relations),
        critical: true, // Must include even if truncated
      },
      {
        name: "structure",
        priority: SECTION_PRIORITIES.FILE_STRUCTURE,
        minTokens: MIN_TOKEN_RESERVES.FILE_STRUCTURE,
        builder: () => this.buildFileStructureSection(entities),
        critical: false,
      },
      {
        name: "apiSurface",
        priority: SECTION_PRIORITIES.API_SURFACE,
        minTokens: MIN_TOKEN_RESERVES.API_SURFACE,
        builder: () => this.buildApiSurfaceSection(entities, relations, limit),
        critical: false,
      },
      {
        name: "dependencies",
        priority: SECTION_PRIORITIES.DEPENDENCIES,
        minTokens: MIN_TOKEN_RESERVES.DEPENDENCIES,
        builder: () => this.buildDependenciesSection(entities, relations),
        critical: false,
      },
      {
        name: "relations",
        priority: SECTION_PRIORITIES.RELATIONS,
        minTokens: MIN_TOKEN_RESERVES.RELATIONS,
        builder: () => this.buildRelationsSection(relations),
        critical: false,
      },
    ];

    // Sort sections by priority
    sections.sort((a, b) => b.priority - a.priority);

    // Build sections progressively
    for (const section of sections) {
      if (context.budget.remaining < section.minTokens && !section.critical) {
        context.truncated = true;
        context.truncationReason = `${section.name} section excluded due to token limit`;
        continue;
      }

      const result = await this.addSection(
        smartGraph,
        section.name,
        section.builder,
        context,
        section.critical
      );

      if (!result.added && !section.critical) {
        context.truncated = true;
        context.truncationReason = `${section.name} section excluded due to token limit`;
      }
    }

    return {
      content: smartGraph as SmartGraph,
      meta: {
        tokenCount: context.budget.used,
        tokenLimit: context.budget.total,
        truncated: context.truncated,
        truncationReason: context.truncationReason,
        sectionsIncluded: context.sectionsIncluded,
      },
    };
  }

  /**
   * Add a section to the response with automatic truncation handling
   */
  private async addSection(
    graph: any,
    sectionName: string,
    builder: () => any,
    context: {
      budget: TokenBudget;
      sectionsIncluded: string[];
      truncated: boolean;
    },
    critical: boolean = false
  ): Promise<{ added: boolean }> {
    const content = builder();

    if (tokenCounter.fitsInBudget(context.budget, content)) {
      graph[sectionName] = content;
      context.budget = tokenCounter.consumeTokens(
        context.budget,
        tokenCounter.estimateTokensWithFormatting(content)
      );
      context.sectionsIncluded.push(sectionName);
      return { added: true };
    }

    // Try to truncate if critical or if there's reasonable space
    if (critical || context.budget.remaining > 100) {
      const truncated = tokenCounter.truncateToFit(content, context.budget);
      if (truncated.content) {
        graph[sectionName] = truncated.content;
        context.budget = tokenCounter.consumeTokens(
          context.budget,
          tokenCounter.estimateTokensWithFormatting(truncated.content)
        );
        context.sectionsIncluded.push(`${sectionName} (truncated)`);
        context.truncated = true;
        return { added: true };
      }
    }

    return { added: false };
  }

  /**
   * Build entities-only streaming response
   */
  private async buildEntitiesStreamingResponse(
    context: {
      entities: Entity[];
      relations: Relation[];
      limit: number;
      budget: TokenBudget;
      sectionsIncluded: string[];
      truncated: boolean;
      truncationReason?: string;
    },
    options: ScrollOptions
  ): Promise<StreamingGraphResponse> {
    const filteredEntities = this.filterAndLimitEntities(context.entities, options);
    const result = await this.fitContentToBudget(
      { entities: filteredEntities, relations: context.relations },
      context.budget,
      (content) => ({
        entities: content.entities.slice(0, Math.floor(content.entities.length * 0.8)),
        relations: content.relations, // ✅ Preserve relations during reduction
      })
    );

    return {
      content: result.content,
      meta: {
        tokenCount: tokenCounter.estimateTokensWithFormatting(result.content),
        tokenLimit: context.budget.total,
        truncated: result.truncated,
        truncationReason: result.truncated
          ? `Reduced from ${filteredEntities.length} to ${result.content.entities.length} entities`
          : undefined,
        sectionsIncluded: ["entities", "relations"],
      },
    };
  }

  /**
   * Filter and limit entities based on options
   */
  private filterAndLimitEntities(entities: Entity[], options: ScrollOptions): Entity[] {
    let result = entities;

    if (options.entityTypes && options.entityTypes.length > 0) {
      result = result.filter((e) => options.entityTypes!.includes(e.entityType));
    }

    if (options.limit) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  /**
   * Build relationships-only streaming response
   */
  private async buildRelationshipsStreamingResponse(context: {
    entities: Entity[];
    relations: Relation[];
    limit: number;
    budget: TokenBudget;
    sectionsIncluded: string[];
    truncated: boolean;
    truncationReason?: string;
  }): Promise<StreamingGraphResponse> {
    const result = await this.fitContentToBudget(
      { entities: context.entities, relations: context.relations },
      context.budget,
      (content) => ({
        ...content,
        relations: content.relations.slice(0, Math.floor(content.relations.length * 0.8)),
      })
    );

    return {
      content: result.content,
      meta: {
        tokenCount: tokenCounter.estimateTokensWithFormatting(result.content),
        tokenLimit: context.budget.total,
        truncated: result.truncated,
        truncationReason: result.truncated
          ? `Reduced from ${context.relations.length} to ${result.content.relations.length} relations`
          : undefined,
        sectionsIncluded: ["relations"],
      },
    };
  }

  /**
   * Progressively fit content to budget using a reducer function
   */
  private async fitContentToBudget<T extends { entities: Entity[]; relations: Relation[] }>(
    content: T,
    budget: TokenBudget,
    reducer: (content: T) => T
  ): Promise<{ content: T; truncated: boolean }> {
    if (tokenCounter.fitsInBudget(budget, content)) {
      return { content, truncated: false };
    }

    let current = content;
    let truncated = false;

    while (current.entities.length > 0 || current.relations.length > 0) {
      if (tokenCounter.fitsInBudget(budget, current)) {
        break;
      }
      current = reducer(current);
      truncated = true;

      // Prevent infinite loops
      if (current.entities.length === 0 && current.relations.length === 0) {
        break;
      }
    }

    return { content: current, truncated };
  }

  /**
   * Build raw streaming response with truncation if needed
   */
  private async buildRawStreamingResponse(context: {
    entities: Entity[];
    relations: Relation[];
    limit: number;
    budget: TokenBudget;
    sectionsIncluded: string[];
    truncated: boolean;
    truncationReason?: string;
  }): Promise<StreamingGraphResponse> {
    const rawResponse = { entities: context.entities, relations: context.relations };

    if (tokenCounter.fitsInBudget(context.budget, rawResponse)) {
      return {
        content: rawResponse,
        meta: {
          tokenCount: tokenCounter.estimateTokensWithFormatting(rawResponse),
          tokenLimit: context.budget.total,
          truncated: false,
          sectionsIncluded: ["entities", "relations"],
        },
      };
    }

    // Raw mode exceeded limit - return error response
    return {
      content: { entities: [], relations: [] },
      meta: {
        tokenCount: 0,
        tokenLimit: context.budget.total,
        truncated: true,
        truncationReason:
          "Raw response too large - use smart, entities, or relationships mode with limits",
        sectionsIncluded: [],
      },
    };
  }

  // Helper methods for building sections (reuse existing logic patterns)

  private buildSummarySection(entities: Entity[], relations: Relation[]) {
    const breakdown: Record<string, number> = {};
    entities.forEach((e) => {
      breakdown[e.entityType] = (breakdown[e.entityType] || 0) + 1;
    });

    const keyModules = this.extractKeyModules(entities);

    return {
      totalEntities: entities.length,
      totalRelations: relations.length,
      breakdown,
      keyModules,
      timestamp: new Date().toISOString(),
    };
  }

  private buildFileStructureSection(entities: Entity[]) {
    const structure: Record<string, any> = {};
    // Simplified structure building - can be enhanced later
    entities.forEach((entity) => {
      const observations = entity.observations || [];
      const fileObs = observations.find((o) => o.includes("Defined in:"));
      if (fileObs) {
        const filePath = fileObs.replace("Defined in:", "").trim();
        if (!structure[filePath]) {
          structure[filePath] = { type: "file", entities: 0 };
        }
        structure[filePath].entities++;
      }
    });
    return structure;
  }

  private buildApiSurfaceSection(entities: Entity[], relations: Relation[], limit: number) {
    // Find methods for classes from relations
    const methodsByClass = new Map<string, string[]>();
    const inheritsByClass = new Map<string, string[]>();

    relations.forEach((r) => {
      if (r.relationType === "has_method" || r.relationType === "contains") {
        const methods = methodsByClass.get(r.from) || [];
        methods.push(r.to);
        methodsByClass.set(r.from, methods);
      }
      if (r.relationType === "inherits") {
        const inherits = inheritsByClass.get(r.from) || [];
        inherits.push(r.to);
        inheritsByClass.set(r.from, inherits);
      }
    });

    const classes = entities
      .filter((e) => e.entityType === "class" && !e.name.startsWith("_"))
      .slice(0, limit)
      .map((cls) => {
        // Read from metadata (stored by Python indexer)
        const filePath = cls.metadata?.file_path || "";
        const lineNumber = cls.metadata?.line_number || 0;

        // Extract docstring from observations (fallback)
        const docObs = (cls.observations || []).find(
          (o) => o.includes("docstring") || o.includes("Description")
        );

        return {
          name: cls.name,
          file: filePath,
          line: lineNumber,
          docstring: docObs
            ? docObs
                .replace(/.*docstring[:\s]*/, "")
                .trim()
                .substring(0, 200)
            : undefined,
          methods: (methodsByClass.get(cls.name) || []).slice(0, 10),
          inherits: inheritsByClass.get(cls.name) || [],
        };
      });

    const functions = entities
      .filter(
        (e) => (e.entityType === "function" || e.entityType === "method") && !e.name.startsWith("_")
      )
      .slice(0, limit)
      .map((fn) => {
        // Read from metadata (stored by Python indexer)
        const filePath = fn.metadata?.file_path || "";
        const lineNumber = fn.metadata?.line_number || 0;

        // Extract signature and docstring from observations (fallback)
        const sigObs = (fn.observations || []).find(
          (o) => o.includes("Signature:") || o.includes("(")
        );
        const docObs = (fn.observations || []).find(
          (o) => o.includes("docstring") || o.includes("Description")
        );

        return {
          name: fn.name,
          file: filePath,
          line: lineNumber,
          signature: sigObs ? sigObs.trim().substring(0, 100) : undefined,
          docstring: docObs
            ? docObs
                .replace(/.*docstring[:\s]*/, "")
                .trim()
                .substring(0, 200)
            : undefined,
        };
      });

    return { classes, functions };
  }

  private buildDependenciesSection(entities: Entity[], relations: Relation[]) {
    const importRelations = relations.filter((r) => r.relationType === "imports");

    const external = new Set<string>();
    importRelations.forEach((rel) => {
      if (!rel.to.includes("/") && !rel.to.includes(".py")) {
        external.add(rel.to);
      }
    });

    const internal = importRelations
      .filter((rel) => rel.to.includes("/") || rel.to.includes(".py"))
      .map((rel) => ({ from: rel.from, to: rel.to }))
      .slice(0, 20);

    return {
      external: Array.from(external).slice(0, 20),
      internal,
    };
  }

  private buildRelationsSection(relations: Relation[]) {
    const inheritance = relations
      .filter((r) => r.relationType === "inherits")
      .map((r) => ({ from: r.from, to: r.to }));

    const keyUsages = relations
      .filter((r) => ["calls", "uses", "implements"].includes(r.relationType))
      .slice(0, 30)
      .map((r) => ({ from: r.from, to: r.to, type: r.relationType }));

    return { inheritance, keyUsages };
  }

  private extractKeyModules(entities: Entity[]): string[] {
    const modules = new Set<string>();
    entities.forEach((entity) => {
      // Read from metadata (stored by Python indexer)
      const filePath = entity.metadata?.file_path;
      if (filePath) {
        const parts = filePath.split("/");
        // Find the first meaningful directory (skip empty parts from absolute paths)
        const meaningfulParts = parts.filter((p) => p && p !== ".");
        if (meaningfulParts.length > 1) {
          // Try to find a src/lib/packages type directory
          const srcIndex = meaningfulParts.findIndex((p) =>
            ["src", "lib", "packages", "app", "components", "modules"].includes(p)
          );
          if (srcIndex >= 0 && meaningfulParts[srcIndex + 1]) {
            modules.add(meaningfulParts[srcIndex + 1]);
          } else {
            // Fallback: use first meaningful directory
            modules.add(meaningfulParts[0]);
          }
        }
      }
    });
    return Array.from(modules).slice(0, 10);
  }

  /**
   * Generic streaming response for any data type with token management
   */
  async buildGenericStreamingResponse<T>(
    data: T[],
    tokenLimit: number = TOKEN_CONFIG.DEFAULT_TOKEN_LIMIT
  ): Promise<{ content: T[]; meta: any }> {
    const budget = tokenCounter.createBudget(tokenLimit);
    const result: T[] = [];

    for (const item of data) {
      if (tokenCounter.fitsInBudget(budget, item)) {
        result.push(item);
        budget.used += tokenCounter.estimateTokensWithFormatting(item);
        budget.remaining = budget.total - budget.used;
      } else break;
    }

    return {
      content: result,
      meta: {
        tokenCount: budget.used,
        tokenLimit: budget.total,
        truncated: result.length < data.length,
        resultsIncluded: result.length,
        totalResults: data.length,
      },
    };
  }

  /**
   * Check if an entity is test code based on metadata or name patterns
   */
  private isTestCode(entity: Entity): boolean {
    // Check metadata flag (set by Python indexer)
    if (entity.metadata?.is_test_code === true) {
      return true;
    }
    if (entity.metadata?.code_category === "test" || entity.metadata?.code_category === "mock") {
      return true;
    }

    // Check file path patterns
    const filePath = entity.metadata?.file_path || "";
    const testPathPatterns = [
      "/tests/",
      "/test/",
      "/__tests__/",
      "/__mocks__/",
      "/fixtures/",
      "/stubs/",
      "_test.py",
      ".test.ts",
      ".test.tsx",
      ".test.js",
      ".spec.ts",
      ".spec.js",
      "test_",
      "conftest.py",
    ];
    if (testPathPatterns.some((pattern) => filePath.includes(pattern))) {
      return true;
    }

    // Check entity name patterns (test framework functions/classes)
    const name = entity.name || "";
    const testNamePatterns = [
      /^test_/i,
      /^Test[A-Z]/,
      /Test$/,
      /^Mock[A-Z]/,
      /Mock$/,
      /^Stub[A-Z]/,
      /^Fake[A-Z]/,
      /^Spy[A-Z]/,
      /^EXPECT_/,
      /^ASSERT_/,
      /^describe$/,
      /^it$/,
      /^beforeEach$/,
      /^afterEach$/,
    ];
    if (testNamePatterns.some((pattern) => pattern.test(name))) {
      return true;
    }

    return false;
  }
}

// Export singleton instance
export const streamingResponseBuilder = new StreamingResponseBuilder();
