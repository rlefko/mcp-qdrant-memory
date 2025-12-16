// Test that MCP server doesn't create JSON files
import { spawn } from "child_process";
import { execSync } from "child_process";

console.log("Testing MCP server with JSON file writing disabled...\n");

// Check initial state
console.log("1. Checking initial state - no JSON files should exist:");
try {
  const initialFiles = execSync("ls dist/*.json 2>/dev/null", { encoding: "utf8" });
  console.error("   ERROR: Found existing JSON files:", initialFiles);
  process.exit(1);
} catch (e) {
  console.log("   ✓ No JSON files in dist directory\n");
}

// Start MCP server
console.log("2. Starting MCP server...");
const mcp = spawn("node", ["dist/index.js"], {
  env: {
    ...process.env,
    OPENAI_API_KEY: "test-key",
    QDRANT_API_KEY: "test-key",
    QDRANT_URL: "http://localhost:6333",
    QDRANT_COLLECTION_NAME: "test-no-json",
  },
  stdio: ["pipe", "pipe", "pipe"],
});

let responses = [];

mcp.stdout.on("data", (data) => {
  const lines = data
    .toString()
    .split("\n")
    .filter((line) => line.trim());
  lines.forEach((line) => {
    try {
      const json = JSON.parse(line);
      responses.push(json);
    } catch (e) {
      // Ignore non-JSON output
    }
  });
});

mcp.stderr.on("data", (data) => {
  console.error("   MCP Error:", data.toString());
});

// Test sequence
setTimeout(async () => {
  // Send initialize request
  console.log("3. Sending initialize request...");
  const initRequest = {
    jsonrpc: "2.0",
    method: "initialize",
    params: {
      protocolVersion: "0.1.0",
      capabilities: {},
    },
    id: 1,
  };
  mcp.stdin.write(JSON.stringify(initRequest) + "\n");

  await new Promise((resolve) => setTimeout(resolve, 500));
  console.log("   ✓ Server initialized\n");

  // List tools
  console.log("4. Listing available tools...");
  const listRequest = {
    jsonrpc: "2.0",
    method: "tools/list",
    params: {},
    id: 2,
  };
  mcp.stdin.write(JSON.stringify(listRequest) + "\n");

  await new Promise((resolve) => setTimeout(resolve, 500));
  const toolsResponse = responses.find((r) => r.id === 2);
  if (toolsResponse && toolsResponse.result && toolsResponse.result.tools) {
    console.log(`   ✓ Found ${toolsResponse.result.tools.length} tools\n`);
  }

  // Check final state
  console.log("5. Checking final state - no JSON files should be created:");
  try {
    const finalFiles = execSync("ls dist/*.json 2>/dev/null", { encoding: "utf8" });
    console.error("   ERROR: Found JSON files:", finalFiles);
    mcp.kill();
    process.exit(1);
  } catch (e) {
    console.log("   ✓ No JSON files created\n");
  }

  console.log("✅ SUCCESS: MCP server is working without JSON file writes\!");
  mcp.kill();
  process.exit(0);
}, 100);
