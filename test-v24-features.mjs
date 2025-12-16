#!/usr/bin/env node

/**
 * Test script for v2.4 Progressive Disclosure features
 */

import { spawn } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

const TEST_CONFIG = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  VOYAGE_API_KEY: process.env.VOYAGE_API_KEY,
  QDRANT_URL: "http://localhost:6333",
  QDRANT_API_KEY: process.env.QDRANT_API_KEY,
  QDRANT_COLLECTION_NAME: "memory-project",
};

console.log("🚀 Testing v2.4 Progressive Disclosure Features");
console.log("=".repeat(50));

// Test 1: search_similar (always metadata-only in v2.4)
const testMetadataSearch = {
  method: "call",
  params: {
    name: "search_similar",
    arguments: {
      query: "authentication function",
      limit: 5,
    },
  },
};

// Test 2: get_implementation (for detailed code access)
const testImplementationSearch = {
  method: "call",
  params: {
    name: "get_implementation",
    arguments: {
      entityName: "AuthenticationService",
    },
  },
};

// Test 3: get_implementation tool
const testGetImplementation = {
  method: "call",
  params: {
    name: "get_implementation",
    arguments: {
      entityName: "CoreIndexer",
    },
  },
};

async function runTest(testName, testData) {
  console.log(`\n🧪 Test: ${testName}`);
  console.log("-".repeat(30));

  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const mcp = spawn("node", ["dist/index.js"], {
      env: { ...process.env, ...TEST_CONFIG },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    mcp.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    mcp.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    // Send test request
    mcp.stdin.write(JSON.stringify(testData) + "\n");

    // Give it time to process
    setTimeout(() => {
      mcp.kill();
      const duration = Date.now() - startTime;

      if (stderr) {
        console.log("❌ Error:", stderr.slice(0, 200));
        reject(new Error(stderr));
      } else {
        console.log(`✅ Duration: ${duration}ms`);
        console.log("📊 Response length:", stdout.length, "chars");

        // Try to parse response
        try {
          const lines = stdout.split("\n").filter((line) => line.trim());
          if (lines.length > 0) {
            const response = JSON.parse(lines[lines.length - 1]);
            console.log("📋 Response type:", typeof response.result);
            if (response.result && typeof response.result === "object") {
              console.log("🔍 Keys:", Object.keys(response.result).slice(0, 5));
            }
          }
        } catch (e) {
          console.log("📄 Raw output preview:", stdout.slice(0, 100));
        }

        resolve({ duration, stdout, stderr });
      }
    }, 5000);
  });
}

async function main() {
  try {
    // Verify environment
    if (!TEST_CONFIG.OPENAI_API_KEY && !TEST_CONFIG.VOYAGE_API_KEY) {
      console.log("❌ No API keys found. Please set OPENAI_API_KEY or VOYAGE_API_KEY");
      process.exit(1);
    }

    console.log("🔧 Configuration:");
    console.log("- OpenAI API Key:", TEST_CONFIG.OPENAI_API_KEY ? "✅ Set" : "❌ Missing");
    console.log("- Voyage API Key:", TEST_CONFIG.VOYAGE_API_KEY ? "✅ Set" : "❌ Missing");
    console.log("- Qdrant URL:", TEST_CONFIG.QDRANT_URL);
    console.log("- Collection:", TEST_CONFIG.QDRANT_COLLECTION_NAME);

    // Run tests
    const metadataResult = await runTest("Metadata Search (v2.4)", testMetadataSearch);
    const implSearchResult = await runTest(
      "Implementation Search (v2.4)",
      testImplementationSearch
    );
    const implResult = await runTest("Get Implementation (v2.4)", testGetImplementation);

    // Performance comparison
    console.log("\n📈 Performance Analysis");
    console.log("=".repeat(30));
    console.log(`🚀 Metadata search: ${metadataResult.duration}ms`);
    console.log(`🔍 Implementation search: ${implSearchResult.duration}ms`);
    console.log(`📋 Get implementation: ${implResult.duration}ms`);

    console.log("✅ Progressive disclosure v2.4 workflow tested successfully");

    console.log("\n🎉 v2.4 Testing Complete");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  }
}

main();
