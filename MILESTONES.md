# MCP-Qdrant-Memory Enhancement Milestones

**Version:** 1.0.0
**Status:** Active
**Author:** Ryan Lefkowitz
**Created:** December 2025
**Related:** [PRD.md](./docs/PRD.md) | [TDD.md](./docs/TDD.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Success Criteria](#2-success-criteria)
3. [Phase Overview](#3-phase-overview)
4. [Detailed Milestones](#4-detailed-milestones)
5. [Complete Task Inventory](#5-complete-task-inventory)
6. [File Inventory](#6-file-inventory)
7. [Risk Assessment](#7-risk-assessment)
8. [Progress Tracking](#8-progress-tracking)

---

## 1. Executive Summary

This document tracks all phases, milestones, and tasks required to transform `mcp-qdrant-memory` from a functional MCP server into a production-quality open-source project with:

- **Comprehensive testing** (0% -> 80% coverage)
- **Automated CI/CD** (GitHub Actions)
- **Code quality tooling** (ESLint, Prettier, Husky)
- **Complete documentation** (README, CONTRIBUTING, CHANGELOG, LICENSE)
- **Robust error handling** (Result types, timeouts, structured logging)
- **Security hardening** (scoped fetch, input validation)
- **Resource management** (graceful shutdown, BM25 cleanup)

**Total Estimated Tasks:** 127 tasks across 6 phases
**Timeline Reference:** PRD Section 6 defines 5 milestones over 6 weeks

---

## 2. Success Criteria

### Primary Success Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Test coverage | 0% | 80%+ | Not Started |
| CI pipeline | None | All PRs gated | Not Started |
| Documentation | CLAUDE.md only | Full suite | Not Started |
| Silent failures | 4 locations | 0 | Not Started |
| Security issues | 2 known | 0 | Not Started |

### Definition of Done

- [ ] All PRs require passing CI checks (build, lint, typecheck, test)
- [ ] Coverage report shows >80% line coverage
- [ ] README.md provides complete setup and usage guide
- [ ] No `return []` or `return null` in error handling paths
- [ ] Fetch override scoped to Qdrant URLs only
- [ ] Input size validation prevents DoS
- [ ] Graceful shutdown handles SIGTERM/SIGINT
- [ ] BM25 services cleaned up via LRU
- [ ] Unicode text supported in BM25 search

---

## 3. Phase Overview

```
Phase 1: Testing Foundation     [P0] ████░░░░░░░░░░░░░░░░ 20%
Phase 2: CI/CD Pipeline         [P0] ████░░░░░░░░░░░░░░░░ 20%
Phase 3: Code Quality & Docs    [P1] ████████░░░░░░░░░░░░ 40%
Phase 4: Error Handling         [P1] ████████░░░░░░░░░░░░ 40%
Phase 5: Security & Resources   [P2] ████████████░░░░░░░░ 60%
Phase 6: Coverage Target        [P2] ████████████████████ 100%
```

| Phase | PRD Priority | PRD Sections | TDD Sections | Effort | Dependencies |
|-------|-------------|--------------|--------------|--------|--------------|
| 1 | P0 | 4.1 | 3.1 | High | None |
| 2 | P0 | 4.2 | 3.2 | Medium | Phase 1 |
| 3 | P1 | 4.3, 4.4 | 4.1-4.3, 9.1-9.2 | Medium | Phase 2 |
| 4 | P1 | 4.5 | 3.3 | High | Phase 1 |
| 5 | P2 | 4.6, 4.7, 4.8 | 3.4, 3.5, 9.3 | Medium | Phase 4 |
| 6 | P2 | - | 7.1, 7.2, 7.3 | High | Phase 1-5 |

---

## 4. Detailed Milestones

### Phase 1: Testing Foundation

**PRD Reference:** Section 4.1 (Testing Infrastructure)
**TDD Reference:** Section 3.1 (Testing Architecture)
**Priority:** P0 (Critical)
**Effort:** High
**Dependencies:** None
**Target Coverage:** 60% baseline

#### Milestone 1.1: Vitest Configuration

**PRD:** 4.1.1 | **TDD:** 3.1.4
**Effort:** S
**Acceptance Criteria:**
- Vitest configured with proper Node.js environment
- Coverage reporting enabled with v8 provider
- Test patterns set for `**/*.test.ts` and `**/*.spec.ts`
- Coverage thresholds configured (80% lines, branches, functions)

**Tasks:**
- [ ] Create `vitest.config.ts` with Node environment
- [ ] Configure coverage provider (v8)
- [ ] Set coverage thresholds (80%)
- [ ] Configure test file patterns
- [ ] Set test timeout (10000ms)
- [ ] Configure coverage exclusions (tests, types)
- [ ] Set coverage reporters (text, json, html, lcov)

#### Milestone 1.2: Test Setup & Mocks (Partial)

**PRD:** 4.1.5 | **TDD:** 3.1.2, 3.1.3
**Effort:** M
**Acceptance Criteria:**
- Test setup file initializes environment
- All external dependencies have mocks
- Environment variables stubbed for tests

**Tasks:**
- [ ] Create `src/__tests__/setup.ts`
- [x] Configure mock environment variables (done in integration tests via vi.stubEnv)
- [x] Create `src/__tests__/mocks/` directory
- [x] Implement `qdrantClient.mock.ts`
- [x] Implement `openaiClient.mock.ts` (OpenAI embeddings mock)
- [ ] Implement `fetch.mock.ts` (for Linear/GitHub)
- [x] Create test fixtures directory
- [x] Add `entities.json` fixture
- [x] Add `relations.json` fixture
- [ ] Add `searchResults.json` fixture
- [ ] Add `embeddings.json` fixture

#### Milestone 1.3: Core Unit Tests

**PRD:** 4.1.3 | **TDD:** 7.1
**Effort:** L
**Acceptance Criteria:**
- All core modules have unit tests
- Pure functions have >95% coverage
- Test coverage reaches 60% baseline

**Tasks:**
- [ ] Create `src/__tests__/unit/` directory
- [ ] Write `validation.test.ts` (target: 95%)
  - [ ] Test valid request validation
  - [ ] Test invalid input rejection
  - [ ] Test default value handling
  - [ ] Test edge cases (empty, null, undefined)
  - [ ] Test size limit enforcement
- [ ] Write `tokenCounter.test.ts` (target: 95%)
  - [ ] Test token counting accuracy
  - [ ] Test edge cases (empty string, large text)
  - [ ] Test truncation behavior
- [ ] Write `planModeGuard.test.ts` (target: 95%)
  - [ ] Test access check for blocked tools
  - [ ] Test access check for allowed tools
  - [ ] Test plan mode enable/disable
  - [ ] Test getBlockedTools()
- [ ] Write `bm25Service.test.ts` (target: 90%)
  - [ ] Test document addition
  - [ ] Test index building
  - [ ] Test search ranking
  - [ ] Test empty index handling
  - [ ] Test Unicode text (Phase 5 prep)

#### Milestone 1.4: Test Scripts

**PRD:** 4.1.2 | **TDD:** 4.3
**Effort:** S
**Acceptance Criteria:**
- All test scripts added to package.json
- Scripts run correctly from command line

**Tasks:**
- [ ] Add `"test": "vitest run"` script
- [ ] Add `"test:watch": "vitest"` script
- [ ] Add `"test:coverage": "vitest run --coverage"` script
- [ ] Add `"test:ui": "vitest --ui"` script
- [ ] Install `@vitest/coverage-v8` devDependency
- [ ] Install `@vitest/ui` devDependency
- [ ] Verify all scripts execute correctly

---

### Phase 2: CI/CD Pipeline

**PRD Reference:** Section 4.2 (CI/CD Pipeline)
**TDD Reference:** Section 3.2 (CI/CD Architecture)
**Priority:** P0 (Critical)
**Effort:** Medium
**Dependencies:** Phase 1 (testing must exist for CI to gate)

#### Milestone 2.1: GitHub Actions CI Workflow

**PRD:** 4.2.1 | **TDD:** 3.2.1
**Effort:** M
**Acceptance Criteria:**
- CI runs on push and PR
- Build, lint, typecheck, and test jobs defined
- Node.js matrix (18, 20, 22)
- Dependency caching enabled

**Tasks:**
- [ ] Create `.github/workflows/` directory
- [ ] Create `ci.yml` workflow
- [ ] Configure workflow triggers (push, PR to main/master)
- [ ] Add concurrency group with cancel-in-progress
- [ ] Add `build` job
  - [ ] Checkout code
  - [ ] Setup Node.js with cache
  - [ ] Install dependencies
  - [ ] Run build
  - [ ] Upload build artifacts
- [ ] Add `lint` job
  - [ ] Run ESLint
  - [ ] Check formatting
- [ ] Add `typecheck` job
  - [ ] Run `tsc --noEmit`
- [ ] Add `test` job
  - [ ] Configure Node.js matrix (18, 20, 22)
  - [ ] Run tests with coverage
  - [ ] Upload coverage to Codecov (optional)
- [ ] Add `security` job
  - [ ] Run `npm audit --audit-level=high`

#### Milestone 2.2: Release Workflow

**PRD:** 4.2.2 | **TDD:** 3.2.2
**Effort:** S
**Acceptance Criteria:**
- Release workflow triggers on version tags
- Builds, tests, and publishes to npm
- Creates GitHub release with notes

**Tasks:**
- [ ] Create `release.yml` workflow
- [ ] Configure trigger on `v*.*.*` tags
- [ ] Add build and test steps
- [ ] Configure npm registry authentication
- [ ] Add npm publish step with provenance
- [ ] Add GitHub release creation step
- [ ] Configure release notes generation

#### Milestone 2.3: Dependency Management

**PRD:** 4.2.3 | **TDD:** 3.2.3
**Effort:** S
**Acceptance Criteria:**
- Dependabot configured for weekly updates
- Security PRs automatically created
- Dependencies grouped logically

**Tasks:**
- [ ] Create `.github/dependabot.yml`
- [ ] Configure npm ecosystem
- [ ] Set weekly schedule (Monday)
- [ ] Configure PR limit (10)
- [ ] Add commit message prefix (chore(deps))
- [ ] Add dependency label
- [ ] Configure dependency groups (dev-dependencies)

---

### Phase 3: Code Quality & Documentation

**PRD Reference:** Sections 4.3 (Code Quality), 4.4 (Documentation)
**TDD Reference:** Sections 4.1-4.3, 9.1-9.2
**Priority:** P1 (High)
**Effort:** Medium
**Dependencies:** Phase 2 (CI should enforce quality)

#### Milestone 3.1: ESLint Configuration

**PRD:** 4.3.1 | **TDD:** 9.1
**Effort:** S
**Acceptance Criteria:**
- ESLint configured with TypeScript support
- Strict type checking enabled
- Prettier integration configured

**Tasks:**
- [ ] Install `eslint` devDependency
- [ ] Install `@typescript-eslint/eslint-plugin` devDependency
- [ ] Install `@typescript-eslint/parser` devDependency
- [ ] Install `eslint-config-prettier` devDependency
- [ ] Create `.eslintrc.json` configuration
- [ ] Configure TypeScript parser options
- [ ] Enable recommended and strict rules
- [ ] Add custom rules (no-unused-vars, no-explicit-any)
- [ ] Configure ignore patterns (dist/, node_modules/)
- [ ] Add `"lint": "eslint src/"` script
- [ ] Add `"lint:fix": "eslint src/ --fix"` script
- [ ] Fix all existing linting errors

#### Milestone 3.2: Prettier Configuration

**PRD:** 4.3.2 | **TDD:** 9.2
**Effort:** S
**Acceptance Criteria:**
- Prettier configured with consistent settings
- Format scripts added to package.json

**Tasks:**
- [ ] Install `prettier` devDependency
- [ ] Create `.prettierrc` configuration
- [ ] Configure settings (semi, singleQuote, tabWidth, etc.)
- [ ] Add `"format": "prettier --write ."` script
- [ ] Add `"format:check": "prettier --check ."` script
- [ ] Format all existing files

#### Milestone 3.3: Pre-commit Hooks

**PRD:** 4.3.3 | **TDD:** 4.3
**Effort:** S
**Acceptance Criteria:**
- Husky installed and configured
- lint-staged runs on staged files
- Hooks prevent bad commits

**Tasks:**
- [ ] Install `husky` devDependency
- [ ] Install `lint-staged` devDependency
- [ ] Initialize Husky (`npx husky init`)
- [ ] Configure lint-staged in package.json
- [ ] Create pre-commit hook
- [ ] Configure hooks for TS/JS files (eslint, prettier)
- [ ] Configure hooks for JSON/MD files (prettier)
- [ ] Add `"prepare": "husky"` script

#### Milestone 3.4: README.md

**PRD:** 4.4.1 | **TDD:** 4.1
**Effort:** M
**Acceptance Criteria:**
- Comprehensive README with all required sections
- Architecture diagram included
- Installation and usage documented

**Tasks:**
- [ ] Create `README.md` in project root
- [ ] Write project description and features
- [ ] Add architecture diagram (Mermaid)
- [ ] Write quick start guide
- [ ] Document installation instructions
- [ ] Create configuration reference
- [ ] Document all MCP tools with examples
- [ ] Add Docker setup instructions
- [ ] Add development setup section
- [ ] Add contributing link
- [ ] Add license section
- [ ] Add badges (CI, coverage, npm version)

#### Milestone 3.5: CONTRIBUTING.md

**PRD:** 4.4.2 | **TDD:** 6.2
**Effort:** S
**Acceptance Criteria:**
- Complete contributor guide
- Setup instructions clear and testable

**Tasks:**
- [ ] Create `CONTRIBUTING.md`
- [ ] Write development environment setup
- [ ] Document code style guidelines
- [ ] Define testing requirements
- [ ] Describe pull request process
- [ ] Add issue reporting guidelines
- [ ] Document code review expectations

#### Milestone 3.6: CHANGELOG.md & LICENSE

**PRD:** 4.4.3, 4.4.4 | **TDD:** 4.1
**Effort:** S
**Acceptance Criteria:**
- CHANGELOG follows Keep a Changelog format
- LICENSE file contains MIT license text

**Tasks:**
- [ ] Create `CHANGELOG.md`
- [ ] Add Unreleased section
- [ ] Document current version changes
- [ ] Create `LICENSE` file
- [ ] Add MIT license text
- [ ] Set copyright year and author

---

### Phase 4: Error Handling

**PRD Reference:** Section 4.5 (Error Handling Improvements)
**TDD Reference:** Section 3.3 (Error Handling Design)
**Priority:** P1 (High)
**Effort:** High
**Dependencies:** Phase 1 (tests needed to verify error handling)

#### Milestone 4.1: Result Type Pattern

**PRD:** 4.5.1 | **TDD:** 3.3.1
**Effort:** M
**Acceptance Criteria:**
- Result type implemented with helpers
- Type guards for success/error cases
- Async tryCatch wrapper available

**Tasks:**
- [ ] Create `src/types/` directory
- [ ] Create `src/types/result.ts`
- [ ] Define `Result<T, E>` discriminated union
- [ ] Implement `ok<T>()` helper
- [ ] Implement `err<E>()` helper
- [ ] Implement `isOk()` type guard
- [ ] Implement `isErr()` type guard
- [ ] Implement `mapResult()` transformer
- [ ] Implement `tryCatch()` async wrapper
- [ ] Write tests for Result type
- [ ] Export from types index

#### Milestone 4.2: Timeout Utilities

**PRD:** 4.5.2 | **TDD:** 3.3.2
**Effort:** M
**Acceptance Criteria:**
- fetchWithTimeout utility available
- Generic withTimeout wrapper available
- Configurable timeout per service

**Tasks:**
- [ ] Create `src/utils/` directory
- [ ] Create `src/utils/timeout.ts`
- [ ] Define `TimeoutError` class
- [ ] Implement `fetchWithTimeout()` function
- [ ] Implement `withTimeout()` generic wrapper
- [ ] Update `src/config.ts` with timeout configuration
- [ ] Add QDRANT_TIMEOUT_MS env support
- [ ] Add OPENAI_TIMEOUT_MS env support
- [ ] Add VOYAGE_TIMEOUT_MS env support
- [ ] Add LINEAR_TIMEOUT_MS env support
- [ ] Add GITHUB_TIMEOUT_MS env support
- [ ] Write tests for timeout utilities

#### Milestone 4.3: Structured Logger

**PRD:** 4.5.3 | **TDD:** 3.3.3
**Effort:** M
**Acceptance Criteria:**
- Logger interface defined
- JSON logger implementation
- Outputs to stderr (not stdout)

**Tasks:**
- [ ] Create `src/utils/logger.ts`
- [ ] Define `LogLevel` type
- [ ] Define `LogContext` interface
- [ ] Define `Logger` interface
- [ ] Implement `JsonLogger` class
- [ ] Implement log level filtering
- [ ] Configure JSON output format
- [ ] Output to stderr (MCP compatibility)
- [ ] Add LOG_LEVEL env support
- [ ] Export singleton logger instance
- [ ] Write tests for logger

#### Milestone 4.4: Error Utilities

**PRD:** 4.5.4 | **TDD:** 3.3.4
**Effort:** S
**Acceptance Criteria:**
- Error context preserved when wrapping
- Stack traces available for debugging

**Tasks:**
- [ ] Create `src/utils/errors.ts`
- [ ] Implement `wrapError()` function
- [ ] Preserve original error as cause
- [ ] Preserve original stack trace
- [ ] Implement `getErrorMessage()` helper
- [ ] Write tests for error utilities

#### Milestone 4.5: Update Search Functions

**PRD:** 4.5.1 | **TDD:** 3.3.1 (Usage Example)
**Effort:** L
**Acceptance Criteria:**
- searchSimilar returns Result type
- searchLinearTickets returns Result type
- searchGitHubTickets returns Result type
- No silent failures in search paths

**Tasks:**
- [ ] Update `searchSimilar()` return type to Result
- [ ] Update `searchSimilar()` error handling
- [ ] Update `searchLinearTickets()` return type to Result
- [ ] Update `searchLinearTickets()` error handling
- [ ] Update `searchGitHubTickets()` return type to Result
- [ ] Update `searchGitHubTickets()` error handling
- [ ] Update `getLinearTicket()` return type to Result
- [ ] Update `getGitHubTicket()` return type to Result
- [ ] Update MCP handlers to handle Result types
- [ ] Write tests for updated functions

---

### Phase 5: Security & Resource Management

**PRD Reference:** Sections 4.6, 4.7, 4.8
**TDD Reference:** Sections 3.4, 3.5, 9.3
**Priority:** P2 (Medium)
**Effort:** Medium
**Dependencies:** Phase 4 (error handling must be in place)

#### Milestone 5.1: Graceful Shutdown

**PRD:** 4.6.1 | **TDD:** 3.4.1
**Effort:** M
**Acceptance Criteria:**
- SIGTERM and SIGINT handled
- Shutdown handlers run in priority order
- Timeout prevents hung shutdown

**Tasks:**
- [ ] Create `src/utils/shutdown.ts`
- [ ] Define `ShutdownHandler` interface
- [ ] Implement `ShutdownManager` class
- [ ] Implement handler registration
- [ ] Implement priority-ordered execution
- [ ] Implement shutdown timeout (30s)
- [ ] Handle uncaught exceptions
- [ ] Handle unhandled rejections
- [ ] Implement `initializeShutdown()` function
- [ ] Register Qdrant connection cleanup
- [ ] Register BM25 service cleanup
- [ ] Call `initializeShutdown()` in index.ts
- [ ] Write tests for shutdown manager

#### Milestone 5.2: BM25 Service Cleanup

**PRD:** 4.6.2 | **TDD:** 3.4.2
**Effort:** M
**Acceptance Criteria:**
- LRU cleanup removes stale services
- Maximum service count enforced
- Cleanup runs periodically

**Tasks:**
- [ ] Update `QdrantPersistence` with `BM25ServiceEntry` interface
- [ ] Add `lastAccessTime` tracking
- [ ] Configure BM25_SERVICE_MAX_COUNT (10)
- [ ] Configure BM25_SERVICE_TTL_MS (30 min)
- [ ] Configure BM25_CLEANUP_INTERVAL_MS (5 min)
- [ ] Implement `startBM25Cleanup()` method
- [ ] Implement `cleanupStaleBM25Services()` method
- [ ] Implement LRU eviction logic
- [ ] Update `getBM25Service()` to track access
- [ ] Implement `clearBM25Services()` method
- [ ] Write tests for BM25 cleanup

#### Milestone 5.3: Scoped Fetch Override

**PRD:** 4.7.1 | **TDD:** 3.5.1
**Effort:** S
**Acceptance Criteria:**
- API key only added to Qdrant URLs
- Other fetch requests unmodified

**Tasks:**
- [ ] Update `src/fetch-override.ts`
- [ ] Parse URL from input parameter
- [ ] Check if URL starts with QDRANT_URL
- [ ] Only add api-key header for Qdrant requests
- [ ] Pass through other requests unchanged
- [ ] Write tests for fetch override

#### Milestone 5.4: Input Size Validation

**PRD:** 4.7.2 | **TDD:** 3.5.2
**Effort:** M
**Acceptance Criteria:**
- Query string limited to 10,000 chars
- Entity array limited to 1,000 items
- All limits enforced with clear errors

**Tasks:**
- [ ] Add `INPUT_LIMITS` constants to validation.ts
- [ ] QUERY_MAX_LENGTH: 10000
- [ ] ENTITY_NAME_MAX_LENGTH: 500
- [ ] ENTITY_ARRAY_MAX_SIZE: 1000
- [ ] OBSERVATIONS_MAX_PER_ENTITY: 100
- [ ] OBSERVATION_CONTENT_MAX_LENGTH: 50000
- [ ] RELATIONS_ARRAY_MAX_SIZE: 5000
- [ ] Implement `validateStringLength()` helper
- [ ] Implement `validateArraySize()` helper
- [ ] Update `validateSearchSimilarRequest()`
- [ ] Update `validateCreateEntitiesRequest()`
- [ ] Update `validateAddObservationsRequest()`
- [ ] Update `validateCreateRelationsRequest()`
- [ ] Write tests for size validation

#### Milestone 5.5: Unicode Support in BM25

**PRD:** 4.8.1 | **TDD:** 9.3
**Effort:** S
**Acceptance Criteria:**
- Non-ASCII characters preserved in BM25
- Japanese, Chinese, Korean text searchable
- Emoji handled gracefully

**Tasks:**
- [ ] Update `prepareText()` in bm25Service.ts
- [ ] Replace `/[^\w\s]/g` with `/[^\p{L}\p{N}\s]/gu`
- [ ] Preserve Unicode letters and numbers
- [ ] Write tests for Unicode text
- [ ] Test Japanese text search
- [ ] Test emoji handling

---

### Phase 6: Coverage Target & Integration

**PRD Reference:** Section 3 (Goals & Success Metrics)
**TDD Reference:** Section 7 (Testing Strategy)
**Priority:** P2 (Medium)
**Effort:** High
**Dependencies:** Phases 1-5

#### Milestone 6.1: Additional Unit Tests

**PRD:** 4.1.3 | **TDD:** 7.1
**Effort:** L
**Acceptance Criteria:**
- streamingResponseBuilder has 85% coverage
- qdrant.ts has 80% coverage
- index.ts MCP handlers have 75% coverage

**Tasks:**
- [ ] Write `streamingResponseBuilder.test.ts`
  - [ ] Test token limiting
  - [ ] Test auto-reduce behavior
  - [ ] Test priority scoring
  - [ ] Test section building
- [ ] Write `qdrant.test.ts`
  - [ ] Test connection handling
  - [ ] Test entity CRUD operations
  - [ ] Test relation CRUD operations
  - [ ] Test search with mocks
  - [ ] Test scroll operations
  - [ ] Test BM25 hybrid search
- [ ] Write `mcp-handlers.test.ts`
  - [ ] Test search_similar handler
  - [ ] Test read_graph handler
  - [ ] Test get_implementation handler
  - [ ] Test create_entities handler
  - [ ] Test error responses

#### Milestone 6.2: Integration Tests ✅ DONE

**PRD:** 4.1.4 | **TDD:** 7.2
**Effort:** M
**Acceptance Criteria:**
- MCP request/response cycle tested
- Hybrid search flow tested
- External service mocking comprehensive

**Tasks:**
- [x] Create `src/__tests__/integration/` directory
- [x] Write `qdrant.integration.test.ts` (45 tests)
  - [x] Test full CRUD cycle
  - [x] Test search with mocked Qdrant
- [x] Write `mcp-tools.integration.test.ts` (50 tests)
  - [x] Test complete tool request cycle
  - [x] Test error propagation
- [x] Write `hybrid-search.integration.test.ts` (30 tests)
  - [x] Test semantic + BM25 fusion
  - [x] Test result ranking

**Implementation Notes:**
- Created mock infrastructure in `src/__tests__/mocks/`
  - `qdrantClient.mock.ts`: In-memory Qdrant simulation with failure injection
  - `openaiClient.mock.ts`: Deterministic embedding generation
- Total integration tests: 155 (added to existing 207 unit tests = 362 total)
- All tests pass, TypeScript build successful

#### Milestone 6.3: Coverage Target Achievement

**PRD:** Section 3 | **TDD:** 7.1
**Effort:** M
**Acceptance Criteria:**
- Overall coverage >80%
- All coverage thresholds passing
- CI reports coverage

**Tasks:**
- [ ] Run coverage report
- [ ] Identify uncovered code paths
- [ ] Write targeted tests for gaps
- [ ] Verify 80% line coverage
- [ ] Verify 80% function coverage
- [ ] Verify 75% branch coverage
- [ ] Verify 80% statement coverage
- [ ] Configure Codecov integration (optional)
- [ ] Add coverage badge to README

---

## 5. Complete Task Inventory

### Summary by Phase

| Phase | Total Tasks | Status |
|-------|-------------|--------|
| Phase 1: Testing Foundation | 33 | Not Started |
| Phase 2: CI/CD Pipeline | 23 | Not Started |
| Phase 3: Code Quality & Docs | 38 | Not Started |
| Phase 4: Error Handling | 36 | Not Started |
| Phase 5: Security & Resources | 29 | Not Started |
| Phase 6: Coverage Target | 22 | Not Started |
| **Total** | **181** | **0% Complete** |

### Task Status Legend

- [ ] Not Started
- [x] Completed
- [~] In Progress
- [!] Blocked

---

## 6. File Inventory

### Files to Create

| File | Phase | Milestone | Est. Lines |
|------|-------|-----------|------------|
| `vitest.config.ts` | 1 | 1.1 | 40 |
| `src/__tests__/setup.ts` | 1 | 1.2 | 30 |
| `src/__tests__/mocks/qdrantClient.mock.ts` | 1 | 1.2 | 50 |
| `src/__tests__/mocks/openai.mock.ts` | 1 | 1.2 | 30 |
| `src/__tests__/mocks/fetch.mock.ts` | 1 | 1.2 | 40 |
| `src/__tests__/fixtures/entities.json` | 1 | 1.2 | 100 |
| `src/__tests__/fixtures/relations.json` | 1 | 1.2 | 50 |
| `src/__tests__/fixtures/searchResults.json` | 1 | 1.2 | 50 |
| `src/__tests__/fixtures/embeddings.json` | 1 | 1.2 | 20 |
| `src/__tests__/unit/validation.test.ts` | 1 | 1.3 | 200 |
| `src/__tests__/unit/tokenCounter.test.ts` | 1 | 1.3 | 100 |
| `src/__tests__/unit/planModeGuard.test.ts` | 1 | 1.3 | 150 |
| `src/__tests__/unit/bm25Service.test.ts` | 1 | 1.3 | 200 |
| `.github/workflows/ci.yml` | 2 | 2.1 | 120 |
| `.github/workflows/release.yml` | 2 | 2.2 | 50 |
| `.github/dependabot.yml` | 2 | 2.3 | 25 |
| `.eslintrc.json` | 3 | 3.1 | 50 |
| `.prettierrc` | 3 | 3.2 | 10 |
| `README.md` | 3 | 3.4 | 300 |
| `CONTRIBUTING.md` | 3 | 3.5 | 150 |
| `CHANGELOG.md` | 3 | 3.6 | 50 |
| `LICENSE` | 3 | 3.6 | 20 |
| `src/types/result.ts` | 4 | 4.1 | 60 |
| `src/utils/timeout.ts` | 4 | 4.2 | 80 |
| `src/utils/logger.ts` | 4 | 4.3 | 100 |
| `src/utils/errors.ts` | 4 | 4.4 | 40 |
| `src/utils/shutdown.ts` | 5 | 5.1 | 100 |
| `src/__tests__/unit/streamingResponseBuilder.test.ts` | 6 | 6.1 | 150 |
| `src/__tests__/unit/qdrant.test.ts` | 6 | 6.1 | 300 |
| `src/__tests__/unit/mcp-handlers.test.ts` | 6 | 6.1 | 250 |
| `src/__tests__/integration/qdrant.integration.test.ts` | 6 | 6.2 | 150 |
| `src/__tests__/integration/mcp-handlers.integration.test.ts` | 6 | 6.2 | 150 |
| `src/__tests__/integration/hybrid-search.integration.test.ts` | 6 | 6.2 | 100 |

**Total New Files:** 33
**Total New Lines:** ~2,945

### Files to Modify

| File | Phase | Changes |
|------|-------|---------|
| `package.json` | 1, 3 | Add scripts, devDependencies |
| `src/config.ts` | 4 | Add timeout configuration |
| `src/validation.ts` | 5 | Add size validation |
| `src/fetch-override.ts` | 5 | Scope to Qdrant URLs |
| `src/bm25/bm25Service.ts` | 5 | Unicode support |
| `src/persistence/qdrant.ts` | 4, 5 | Result types, BM25 cleanup, timeouts |
| `src/index.ts` | 4, 5 | Shutdown integration, error handling |

**Total Modified Files:** 7

---

## 7. Risk Assessment

### High Risk Items

| Risk | Impact | Mitigation | Owner |
|------|--------|------------|-------|
| Breaking changes to MCP tool responses | High | Result type changes internal only; MCP schema unchanged | TBD |
| Test coverage takes longer than expected | Medium | Start with pure functions; use mocks aggressively | TBD |
| CI workflow fails on edge cases | Medium | Test workflow in fork first | TBD |

### Medium Risk Items

| Risk | Impact | Mitigation | Owner |
|------|--------|------------|-------|
| ESLint finds many existing errors | Medium | Phase fixes; use --fix where safe | TBD |
| Graceful shutdown affects MCP transport | Medium | Extensive manual testing | TBD |
| BM25 Unicode changes affect search quality | Low | Compare search results before/after | TBD |

### Dependencies on External Systems

| Dependency | Risk | Mitigation |
|------------|------|------------|
| GitHub Actions | Low | Well-documented; fallback to local CI |
| npm Registry | Low | Required for release only |
| Codecov (optional) | Low | Coverage still tracked locally |

---

## 8. Progress Tracking

### Overall Progress

```
Phase 1: [                    ]   0%
Phase 2: [                    ]   0%
Phase 3: [                    ]   0%
Phase 4: [                    ]   0%
Phase 5: [                    ]   0%
Phase 6: [                    ]   0%
─────────────────────────────────────
Total:   [                    ]   0%
```

### Completion Formula

```
Completion % = (Completed Tasks / Total Tasks) * 100
             = (0 / 181) * 100
             = 0%
```

### Milestone Completion Status

| Milestone | Tasks | Done | % |
|-----------|-------|------|---|
| 1.1 Vitest Config | 7 | 0 | 0% |
| 1.2 Test Setup & Mocks | 11 | 0 | 0% |
| 1.3 Core Unit Tests | 15 | 0 | 0% |
| 1.4 Test Scripts | 7 | 0 | 0% |
| 2.1 CI Workflow | 13 | 0 | 0% |
| 2.2 Release Workflow | 7 | 0 | 0% |
| 2.3 Dependency Management | 7 | 0 | 0% |
| 3.1 ESLint Config | 12 | 0 | 0% |
| 3.2 Prettier Config | 5 | 0 | 0% |
| 3.3 Pre-commit Hooks | 8 | 0 | 0% |
| 3.4 README.md | 12 | 0 | 0% |
| 3.5 CONTRIBUTING.md | 6 | 0 | 0% |
| 3.6 CHANGELOG & LICENSE | 6 | 0 | 0% |
| 4.1 Result Type | 11 | 0 | 0% |
| 4.2 Timeout Utilities | 12 | 0 | 0% |
| 4.3 Structured Logger | 11 | 0 | 0% |
| 4.4 Error Utilities | 5 | 0 | 0% |
| 4.5 Update Search Functions | 10 | 0 | 0% |
| 5.1 Graceful Shutdown | 13 | 0 | 0% |
| 5.2 BM25 Cleanup | 11 | 0 | 0% |
| 5.3 Scoped Fetch | 5 | 0 | 0% |
| 5.4 Input Validation | 14 | 0 | 0% |
| 5.5 Unicode Support | 6 | 0 | 0% |
| 6.1 Additional Unit Tests | 9 | 0 | 0% |
| 6.2 Integration Tests | 6 | 6 | 100% |
| 6.3 Coverage Target | 9 | 0 | 0% |

---

## Appendix: Quick Reference

### PRD Section Mapping

| PRD Section | Phase | Milestone(s) |
|-------------|-------|--------------|
| 4.1 Testing Infrastructure | 1 | 1.1-1.4 |
| 4.2 CI/CD Pipeline | 2 | 2.1-2.3 |
| 4.3 Code Quality Tooling | 3 | 3.1-3.3 |
| 4.4 Documentation | 3 | 3.4-3.6 |
| 4.5 Error Handling | 4 | 4.1-4.5 |
| 4.6 Concurrency & Resources | 5 | 5.1-5.2 |
| 4.7 Security Hardening | 5 | 5.3-5.4 |
| 4.8 Edge Case Handling | 5 | 5.5 |

### TDD Section Mapping

| TDD Section | Phase | Milestone(s) |
|-------------|-------|--------------|
| 3.1 Testing Architecture | 1 | 1.1-1.3 |
| 3.2 CI/CD Architecture | 2 | 2.1-2.3 |
| 3.3 Error Handling Design | 4 | 4.1-4.5 |
| 3.4 Concurrency Design | 5 | 5.1-5.2 |
| 3.5 Security Design | 5 | 5.3-5.4 |
| 7 Testing Strategy | 6 | 6.1-6.3 |
| 9.1 ESLint Configuration | 3 | 3.1 |
| 9.2 Prettier Configuration | 3 | 3.2 |
| 9.3 BM25 Unicode Fix | 5 | 5.5 |

---

*Last Updated: December 2025*
*Next Review: Upon Phase 1 Completion*
