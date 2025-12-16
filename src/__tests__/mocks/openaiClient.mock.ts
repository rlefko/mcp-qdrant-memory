/**
 * Mock OpenAI client for isolated integration testing.
 * Provides deterministic embedding generation without real API calls.
 */

import { vi } from "vitest";

export type EmbeddingErrorType = "rate_limit" | "invalid_key" | "quota_exceeded" | null;

/**
 * Generate a deterministic embedding based on text hash.
 * This ensures reproducible test results.
 */
export function generateDeterministicEmbedding(text: string, dimension: number): number[] {
  const embedding: number[] = [];
  let hash = 0;

  // Simple hash function
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Generate deterministic vector from hash
  for (let i = 0; i < dimension; i++) {
    // Mix hash with index for varied values
    const mixed = hash ^ (i * 0x9e3779b9);
    // Normalize to [-1, 1] range
    const value = (((mixed >>> 0) % 10000) / 10000) * 2 - 1;
    embedding.push(value);
  }

  // Normalize to unit vector
  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return embedding.map((v) => v / magnitude);
}

/**
 * Mock OpenAI client for testing embedding generation.
 */
export class MockOpenAI {
  private dimension: number;
  private errorType: EmbeddingErrorType = null;
  private callCount = 0;
  private delayMs = 0;

  embeddings: {
    create: (params: {
      model: string;
      input: string | string[];
    }) => Promise<{
      data: Array<{ embedding: number[]; index: number }>;
      model: string;
      usage: { prompt_tokens: number; total_tokens: number };
    }>;
  };

  constructor(dimension = 1536) {
    this.dimension = dimension;

    this.embeddings = {
      create: vi.fn().mockImplementation(async (params) => {
        this.callCount++;

        // Apply delay if configured
        if (this.delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, this.delayMs));
        }

        // Check for configured errors
        this.checkError();

        const inputs = Array.isArray(params.input) ? params.input : [params.input];
        const data = inputs.map((text: string, index: number) => ({
          embedding: generateDeterministicEmbedding(text, this.dimension),
          index,
        }));

        return {
          data,
          model: params.model,
          usage: {
            prompt_tokens: inputs.reduce((sum: number, t: string) => sum + Math.ceil(t.length / 4), 0),
            total_tokens: inputs.reduce((sum: number, t: string) => sum + Math.ceil(t.length / 4), 0),
          },
        };
      }),
    };
  }

  /**
   * Set the embedding dimension (512 for Voyage, 1536 for OpenAI).
   */
  setDimension(dim: number): void {
    this.dimension = dim;
  }

  /**
   * Configure the mock to return an error.
   */
  setError(type: EmbeddingErrorType): void {
    this.errorType = type;
  }

  /**
   * Clear any configured error state.
   */
  clearError(): void {
    this.errorType = null;
  }

  /**
   * Set artificial delay for testing timeout scenarios.
   */
  setDelay(ms: number): void {
    this.delayMs = ms;
  }

  /**
   * Get the number of times embeddings.create was called.
   */
  getCallCount(): number {
    return this.callCount;
  }

  /**
   * Reset all state.
   */
  reset(): void {
    this.callCount = 0;
    this.delayMs = 0;
    this.clearError();
    (this.embeddings.create as ReturnType<typeof vi.fn>).mockClear();
  }

  private checkError(): void {
    if (this.errorType === null) return;

    switch (this.errorType) {
      case "rate_limit":
        throw new Error("Rate limit exceeded. Please retry after 20 seconds.");
      case "invalid_key":
        throw new Error("Invalid API key provided.");
      case "quota_exceeded":
        throw new Error("You exceeded your current quota.");
    }
  }
}

/**
 * Create a fresh MockOpenAI instance.
 */
export function createMockOpenAI(dimension = 1536): MockOpenAI {
  return new MockOpenAI(dimension);
}

/**
 * Factory function that returns a mock OpenAI constructor for vi.mock().
 */
export function getMockOpenAIClass(dimension = 1536) {
  const instance = new MockOpenAI(dimension);

  return {
    OpenAI: vi.fn().mockImplementation(() => instance),
    default: vi.fn().mockImplementation(() => instance),
    instance,
  };
}
