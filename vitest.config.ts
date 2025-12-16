import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Test environment
    environment: "node",

    // Include patterns
    include: ["src/**/*.{test,spec}.ts"],

    // Exclude patterns
    exclude: ["node_modules", "dist"],

    // Global test setup
    globals: true,

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/__tests__/**",
        "src/index.ts", // Main entry - integration tested separately
        "src/persistence/qdrant.ts", // Heavy external deps - integration tested
      ],
    },

    // Reporter configuration
    reporters: ["verbose"],

    // Timeout for tests
    testTimeout: 10000,
  },
});
