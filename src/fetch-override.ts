// Configure fetch to include the api-key header ONLY for Qdrant requests
// Security fix: Previously added API key to ALL fetch requests, leaking to third-party APIs
const originalFetch = globalThis.fetch;

globalThis.fetch = function (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  // Extract URL from various input types
  let url: string;
  if (typeof input === "string") {
    url = input;
  } else if (input instanceof URL) {
    url = input.href;
  } else {
    // Request object
    url = input.url;
  }

  const qdrantUrl = process.env.QDRANT_URL || "";

  // Only add API key for Qdrant requests
  if (qdrantUrl && url.startsWith(qdrantUrl)) {
    const headers = new Headers(init.headers);
    const apiKey = process.env.QDRANT_API_KEY;
    if (apiKey) {
      headers.set("api-key", apiKey);
    }
    return originalFetch(input, { ...init, headers });
  }

  // Pass through unchanged for non-Qdrant requests (Voyage AI, Linear, GitHub, etc.)
  return originalFetch(input, init);
};

// Export for testing
export { originalFetch };
