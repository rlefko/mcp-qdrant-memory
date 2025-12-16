// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintConfigPrettier,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Relaxed rules for existing codebase - Phase 1: Infrastructure Setup
      // These can be gradually tightened as codebase is cleaned up

      // Type safety - warnings for existing patterns
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",

      // Unused variables - allow underscore prefix pattern
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // Template literal expressions - relax for existing code
      "@typescript-eslint/restrict-template-expressions": "warn",
      "@typescript-eslint/no-base-to-string": "warn",

      // Async/await patterns
      "@typescript-eslint/require-await": "warn",
      "@typescript-eslint/no-floating-promises": "error",

      // Type imports
      "@typescript-eslint/consistent-type-imports": "warn",

      // Other relaxed rules for existing patterns
      "@typescript-eslint/no-redundant-type-constituents": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "no-case-declarations": "warn",
      "no-useless-escape": "warn",
      "no-useless-catch": "warn",
    },
  },
  {
    ignores: [
      "dist/",
      "node_modules/",
      "coverage/",
      "*.js",
      "*.mjs",
      "test*.js",
      "test*.mjs",
      "vitest.config.ts",
    ],
  }
);
