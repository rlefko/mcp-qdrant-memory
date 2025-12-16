/**
 * Mock QdrantClient for isolated integration testing.
 * Provides in-memory storage simulation without real network calls.
 */

import { vi } from "vitest";

// Types for mock data
export interface MockPoint {
  id: number | string;
  vector?: number[] | { [key: string]: number[] };
  payload: Record<string, unknown>;
}

export interface MockCollection {
  points: Map<string | number, MockPoint>;
  config: {
    params: {
      vectors: { size: number; distance: string };
    };
  };
}

export interface ScrollParams {
  limit?: number;
  offset?: number | string | null;
  with_payload?: boolean;
  with_vector?: boolean;
  filter?: unknown;
}

export interface ScrollResult {
  points: MockPoint[];
  next_page_offset: number | string | null;
}

export interface SearchParams {
  vector: number[];
  limit?: number;
  filter?: unknown;
  with_payload?: boolean;
  score_threshold?: number;
}

export type FailureType = "connection" | "timeout" | "not_found" | "invalid_api_key" | null;

/**
 * Mock QdrantClient that simulates Qdrant database operations in-memory.
 */
export class MockQdrantClient {
  private collections: Map<string, MockCollection>;
  private failureType: FailureType = null;
  private failureCount = 0;
  private maxFailures = 0;

  constructor() {
    this.collections = new Map();
  }

  /**
   * Configure the mock to fail with a specific error type.
   * @param type - The type of failure to simulate
   * @param count - Number of times to fail (0 = always fail until cleared)
   */
  setFailure(type: FailureType, count = 0): void {
    this.failureType = type;
    this.failureCount = 0;
    this.maxFailures = count;
  }

  /**
   * Clear any configured failure state.
   */
  clearFailure(): void {
    this.failureType = null;
    this.failureCount = 0;
    this.maxFailures = 0;
  }

  /**
   * Reset all data and failure state.
   */
  reset(): void {
    this.collections.clear();
    this.clearFailure();
  }

  /**
   * Seed a collection with test data.
   */
  seedData(collectionName: string, points: MockPoint[]): void {
    const collection = this.getOrCreateCollection(collectionName);
    for (const point of points) {
      collection.points.set(point.id, point);
    }
  }

  /**
   * Get current point count for a collection.
   */
  getPointCount(collectionName: string): number {
    const collection = this.collections.get(collectionName);
    return collection?.points.size ?? 0;
  }

  private getOrCreateCollection(name: string, vectorSize = 1536): MockCollection {
    if (!this.collections.has(name)) {
      this.collections.set(name, {
        points: new Map(),
        config: {
          params: {
            vectors: { size: vectorSize, distance: "Cosine" },
          },
        },
      });
    }
    return this.collections.get(name)!;
  }

  private checkFailure(): void {
    if (this.failureType === null) return;

    if (this.maxFailures > 0 && this.failureCount >= this.maxFailures) {
      this.clearFailure();
      return;
    }

    this.failureCount++;

    switch (this.failureType) {
      case "connection":
        throw new Error("Connection refused: ECONNREFUSED");
      case "timeout":
        throw new Error("Request timeout after 60000ms");
      case "not_found":
        throw new Error("Collection not found");
      case "invalid_api_key":
        throw new Error("Invalid API key provided");
    }
  }

  // --- Qdrant API Methods ---

  async getCollections(): Promise<{ collections: Array<{ name: string }> }> {
    this.checkFailure();
    return {
      collections: Array.from(this.collections.keys()).map((name) => ({ name })),
    };
  }

  async getCollection(
    collectionName: string
  ): Promise<{ config: MockCollection["config"] }> {
    this.checkFailure();
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Collection '${collectionName}' not found`);
    }
    return { config: collection.config };
  }

  async createCollection(
    collectionName: string,
    params: { vectors: { size: number; distance: string } }
  ): Promise<boolean> {
    this.checkFailure();
    if (this.collections.has(collectionName)) {
      throw new Error(`Collection '${collectionName}' already exists`);
    }
    this.collections.set(collectionName, {
      points: new Map(),
      config: { params },
    });
    return true;
  }

  async deleteCollection(collectionName: string): Promise<boolean> {
    this.checkFailure();
    if (!this.collections.has(collectionName)) {
      throw new Error(`Collection '${collectionName}' not found`);
    }
    this.collections.delete(collectionName);
    return true;
  }

  async scroll(
    collectionName: string,
    params: ScrollParams
  ): Promise<ScrollResult> {
    this.checkFailure();
    const collection = this.getOrCreateCollection(collectionName);
    const limit = params.limit ?? 10;
    const offset = typeof params.offset === "number" ? params.offset : 0;

    const allPoints = Array.from(collection.points.values());

    // Apply filter if provided
    let filteredPoints = allPoints;
    if (params.filter) {
      filteredPoints = this.applyFilter(allPoints, params.filter);
    }

    const startIndex = offset;
    const endIndex = Math.min(startIndex + limit, filteredPoints.length);
    const pagePoints = filteredPoints.slice(startIndex, endIndex);

    // Format points based on params
    const formattedPoints = pagePoints.map((p) => ({
      id: p.id,
      payload: params.with_payload !== false ? p.payload : undefined,
      vector: params.with_vector ? p.vector : undefined,
    })) as MockPoint[];

    const hasMore = endIndex < filteredPoints.length;
    return {
      points: formattedPoints,
      next_page_offset: hasMore ? endIndex : null,
    };
  }

  async search(
    collectionName: string,
    params: SearchParams
  ): Promise<Array<{ id: number | string; score: number; payload?: Record<string, unknown> }>> {
    this.checkFailure();
    const collection = this.getOrCreateCollection(collectionName);
    const limit = params.limit ?? 10;

    let points = Array.from(collection.points.values());

    // Apply filter if provided
    if (params.filter) {
      points = this.applyFilter(points, params.filter);
    }

    // Simulate vector similarity scoring (random for mock, but consistent per point)
    const results = points.map((point) => {
      // Generate consistent score based on point id
      const idStr = String(point.id);
      let score = 0.5;
      for (let i = 0; i < idStr.length; i++) {
        score += idStr.charCodeAt(i) * 0.001;
      }
      score = Math.min(score % 1, 0.99);
      return {
        id: point.id,
        score,
        payload: params.with_payload !== false ? point.payload : undefined,
      };
    });

    // Sort by score descending and apply limit
    results.sort((a, b) => b.score - a.score);

    // Apply score threshold
    const threshold = params.score_threshold ?? 0;
    const filteredResults = results.filter((r) => r.score >= threshold);

    return filteredResults.slice(0, limit);
  }

  async upsert(
    collectionName: string,
    params: {
      wait?: boolean;
      points: Array<{
        id: number | string;
        vector?: number[] | { [key: string]: number[] };
        payload?: Record<string, unknown>;
      }>;
    }
  ): Promise<{ status: string; operation_id: number }> {
    this.checkFailure();
    const collection = this.getOrCreateCollection(collectionName);

    for (const point of params.points) {
      collection.points.set(point.id, {
        id: point.id,
        vector: point.vector,
        payload: point.payload ?? {},
      });
    }

    return { status: "completed", operation_id: Date.now() };
  }

  async delete(
    collectionName: string,
    params: {
      wait?: boolean;
      points?: Array<number | string>;
      filter?: unknown;
    }
  ): Promise<{ status: string; operation_id: number }> {
    this.checkFailure();
    const collection = this.getOrCreateCollection(collectionName);

    if (params.points) {
      for (const id of params.points) {
        collection.points.delete(id);
      }
    }

    if (params.filter) {
      const toDelete = this.applyFilter(
        Array.from(collection.points.values()),
        params.filter
      );
      for (const point of toDelete) {
        collection.points.delete(point.id);
      }
    }

    return { status: "completed", operation_id: Date.now() };
  }

  // --- Filter Application ---

  private applyFilter(points: MockPoint[], filter: unknown): MockPoint[] {
    if (!filter || typeof filter !== "object") return points;

    const filterObj = filter as Record<string, unknown>;

    // Handle "must" conditions
    if (filterObj.must && Array.isArray(filterObj.must)) {
      for (const condition of filterObj.must) {
        points = this.applySingleCondition(points, condition);
      }
    }

    // Handle "should" conditions (OR)
    if (filterObj.should && Array.isArray(filterObj.should)) {
      const results: MockPoint[] = [];
      for (const condition of filterObj.should) {
        const matched = this.applySingleCondition(points, condition);
        for (const m of matched) {
          if (!results.some((r) => r.id === m.id)) {
            results.push(m);
          }
        }
      }
      points = results;
    }

    // Handle "must_not" conditions
    if (filterObj.must_not && Array.isArray(filterObj.must_not)) {
      for (const condition of filterObj.must_not) {
        const excluded = this.applySingleCondition(points, condition);
        const excludedIds = new Set(excluded.map((p) => p.id));
        points = points.filter((p) => !excludedIds.has(p.id));
      }
    }

    return points;
  }

  private applySingleCondition(
    points: MockPoint[],
    condition: unknown
  ): MockPoint[] {
    if (!condition || typeof condition !== "object") return points;

    const cond = condition as Record<string, unknown>;

    // Handle "key" + "match" pattern
    if (cond.key && cond.match) {
      const key = cond.key as string;
      const matchValue = (cond.match as Record<string, unknown>).value;
      return points.filter((p) => p.payload[key] === matchValue);
    }

    // Handle "key" + "match" with "any" pattern
    if (cond.key && cond.match && (cond.match as Record<string, unknown>).any) {
      const key = cond.key as string;
      const anyValues = (cond.match as Record<string, unknown>).any as unknown[];
      return points.filter((p) => anyValues.includes(p.payload[key]));
    }

    return points;
  }
}

/**
 * Create a vi.fn() wrapper around MockQdrantClient for use with vi.mock().
 */
export function createMockQdrantClient(): MockQdrantClient {
  return new MockQdrantClient();
}

/**
 * Factory function that returns a mock QdrantClient constructor.
 */
export function getMockQdrantClientClass() {
  const instance = new MockQdrantClient();

  return {
    QdrantClient: vi.fn().mockImplementation(() => instance),
    instance,
  };
}
