import { configLogger } from "./logger.js";

// Check for required environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  configLogger.error("Missing required environment variable", null, { variable: "OPENAI_API_KEY" });
  process.exit(1);
}

const QDRANT_URL = process.env.QDRANT_URL;
if (!QDRANT_URL) {
  configLogger.error("Missing required environment variable", null, { variable: "QDRANT_URL" });
  process.exit(1);
}

const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || null;
// Note: COLLECTION_NAME is now optional at startup - can be provided per-request

/**
 * Resolve collection name with optional override for multi-project support.
 * Falls back to QDRANT_COLLECTION_NAME env var when no override provided.
 */
export function getCollectionName(override?: string): string {
  if (override?.trim()) {
    return override.trim();
  }
  if (!COLLECTION_NAME) {
    throw new Error(
      "No collection specified and QDRANT_COLLECTION_NAME environment variable is not set"
    );
  }
  return COLLECTION_NAME;
}

const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
// Note: QDRANT_API_KEY is optional, so we don't check if it exists

export { OPENAI_API_KEY, QDRANT_URL, COLLECTION_NAME, QDRANT_API_KEY };
