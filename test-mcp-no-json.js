import { spawn } from "child_process";

const mcp = spawn("node", ["dist/index.js"], {
  env: { ...process.env },
  stdio: ["pipe", "pipe", "pipe"],
});

// Test initialization
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

// Test list tools
setTimeout(() => {
  const listToolsRequest = {
    jsonrpc: "2.0",
    method: "tools/list",
    params: {},
    id: 2,
  };
  mcp.stdin.write(JSON.stringify(listToolsRequest) + "\n");
}, 1000);

// Test create entities (should not create JSON file)
setTimeout(() => {
  const createRequest = {
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "create_entities",
      arguments: {
        entities: [
          {
            name: "TestEntity",
            entityType: "test",
            observations: ["Test observation without JSON file"],
          },
        ],
      },
    },
    id: 3,
  };
  mcp.stdin.write(JSON.stringify(createRequest) + "\n");
}, 2000);

// Check for JSON files after operations
setTimeout(() => {
  console.log("Checking for JSON files in dist...");
  const { execSync } = require("child_process");
  try {
    const files = execSync("ls dist/*.json 2>/dev/null", { encoding: "utf8" });
    console.error("ERROR: Found JSON files:", files);
    process.exit(1);
  } catch (e) {
    console.log("SUCCESS: No JSON files created in dist directory");
  }
  mcp.kill();
  process.exit(0);
}, 4000);

mcp.stdout.on("data", (data) => {
  console.log("MCP Response:", data.toString());
});

mcp.stderr.on("data", (data) => {
  console.error("MCP Error:", data.toString());
});
