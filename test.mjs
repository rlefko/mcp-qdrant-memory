import "dotenv/config";
import { QdrantPersistence } from "./dist/persistence/qdrant.js";

async function test() {
  console.log("Creating client...");
  const client = new QdrantPersistence();

  console.log("Initializing...");
  await client.initialize();
  console.log("Successfully initialized!");

  console.log("\nTesting entity creation...");
  const testEntity = {
    name: "test_entity",
    entityType: "test",
    observations: ["This is a test entity to verify the system is working"],
  };
  await client.persistEntity(testEntity);
  console.log("Entity created successfully");

  console.log("\nTesting search...");
  const results = await client.searchSimilar("test");
  console.log("Search results:", JSON.stringify(results, null, 2));

  console.log("\nDeleting test entity...");
  await client.deleteEntity("test_entity");
  console.log("Test entity deleted");
}

test().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
