# MCP-Qdrant-Memory Enhancement PRD

**Version:** 1.0.0
**Status:** Draft
**Author:** Ryan Lefkowitz
**Last Updated:** December 2025

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [Requirements](#4-requirements)
   - [4.1 Testing Infrastructure (P0)](#41-testing-infrastructure-p0)
   - [4.2 CI/CD Pipeline (P0)](#42-cicd-pipeline-p0)
   - [4.3 Code Quality Tooling (P1)](#43-code-quality-tooling-p1)
   - [4.4 Documentation (P1)](#44-documentation-p1)
   - [4.5 Error Handling Improvements (P1)](#45-error-handling-improvements-p1)
   - [4.6 Concurrency & Resource Management (P2)](#46-concurrency--resource-management-p2)
   - [4.7 Security Hardening (P2)](#47-security-hardening-p2)
   - [4.8 Edge Case Handling (P2)](#48-edge-case-handling-p2)
5. [Non-Goals](#5-non-goals)
6. [Milestones](#6-milestones)
7. [Open Questions](#7-open-questions)
8. [Appendix: Audit Findings](#8-appendix-audit-findings)

---

## 1. Executive Summary

The `mcp-qdrant-memory` MCP server provides semantic code memory capabilities for Claude Code, enabling intelligent code search, knowledge graph management, and hybrid BM25/semantic search. While the core functionality is robust, the project lacks essential infrastructure for open-source sustainability:

- **No automated testing** (0% coverage)
- **No CI/CD pipeline**
- **Incomplete documentation**
- **Silent error handling** that masks failures
- **Missing security hardening**

This PRD defines requirements to transform `mcp-qdrant-memory` into a production-quality open-source project with comprehensive testing, automated CI/CD, proper documentation, and robust error handling.

---

## 2. Problem Statement

### Current State Issues

#### 2.1 Testing Gap (Critical)
- Vitest is installed as a dependency but **never configured**
- 9 manual test files exist using a custom `TestRunner` class, not a proper test framework
- **0% formal test coverage** - no way to detect regressions
- No integration tests for Qdrant or external API interactions

#### 2.2 CI/CD Absence (Critical)
- No `.github/workflows/` directory
- No automated builds, linting, or testing on pull requests
- No release automation or version management
- No dependency vulnerability scanning

#### 2.3 Documentation Gaps (High)
- **No README.md** in project root (only CLAUDE.md exists)
- No CONTRIBUTING.md for external contributors
- No CHANGELOG.md for version history
- No LICENSE file (though MIT is declared in package.json)
- No API documentation beyond inline comments

#### 2.4 Silent Error Handling (High)
- `searchSimilar()` returns empty array `[]` on any error (line 501-504)
- `searchLinearTickets()`/`searchGitHubTickets()` swallow API errors
- BM25 initialization failures are logged but not propagated
- Stack traces lost when wrapping errors in McpError

#### 2.5 Security Concerns (Medium)
- `fetch-override.ts` adds Qdrant API key to **all** fetch requests, not just Qdrant URLs
- No input size/length validation (potential DoS vector)
- No rate limiting on external API calls

#### 2.6 Resource Management (Medium)
- No graceful shutdown handling (SIGTERM/SIGINT)
- Per-collection BM25 services created but never cleaned up
- No timeout configuration for Linear/GitHub/OpenAI/Voyage API calls

#### 2.7 Edge Cases (Low-Medium)
- BM25 text processing strips Unicode characters (`/[^\w\s]/g` regex)
- Empty collection handling returns silently without notification
- No handling for very large entity arrays

---

## 3. Goals & Success Metrics

### Primary Goals

| Goal | Success Metric |
|------|----------------|
| Establish testing infrastructure | >80% code coverage; all MCP tools have unit tests |
| Implement CI/CD pipeline | All PRs pass build, lint, test, typecheck; automated releases |
| Complete documentation | README, CONTRIBUTING, CHANGELOG, LICENSE; API docs |
| Fix error handling | No silent failures; all errors distinguishable from empty results |
| Harden security | Scoped API key injection; validated input sizes |

### Secondary Goals

| Goal | Success Metric |
|------|----------------|
| Improve concurrency handling | Graceful shutdown; BM25 service cleanup |
| Support internationalization | BM25 handles Unicode text correctly |
| Enable contributor onboarding | New contributor can set up and run tests in <10 minutes |

---

## 4. Requirements

### 4.1 Testing Infrastructure (P0)

**Priority:** P0 (Critical)
**Effort:** High

#### 4.1.1 Vitest Configuration

**Requirement:** Configure Vitest test runner with proper settings.

**Acceptance Criteria:**
- [ ] Create `vitest.config.ts` with appropriate settings
- [ ] Configure test environment for Node.js
- [ ] Enable coverage reporting with Istanbul
- [ ] Set up test file patterns (`**/*.test.ts`, `**/*.spec.ts`)

**Files:**
- New: `vitest.config.ts`
- Modified: `package.json` (add test scripts)

#### 4.1.2 Test Scripts

**Requirement:** Add npm scripts for testing workflows.

**Scripts Required:**
```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:ui": "vitest --ui"
}
```

#### 4.1.3 Unit Tests

**Requirement:** Create unit tests for all core modules.

**Test Coverage Targets:**

| Module | Target Coverage | Priority |
|--------|-----------------|----------|
| `validation.ts` | 95% | P0 |
| `tokenCounter.ts` | 95% | P0 |
| `bm25Service.ts` | 90% | P0 |
| `plan-mode-guard.ts` | 95% | P0 |
| `streamingResponseBuilder.ts` | 85% | P1 |
| `persistence/qdrant.ts` | 80% | P1 |
| `index.ts` (MCP handlers) | 75% | P1 |

**Test File Structure:**
```
src/
  __tests__/
    validation.test.ts
    tokenCounter.test.ts
    bm25Service.test.ts
    planModeGuard.test.ts
    streamingResponseBuilder.test.ts
    qdrant.test.ts
    mcp-handlers.test.ts
    fixtures/
      entities.json
      relations.json
      searchResults.json
```

#### 4.1.4 Integration Tests

**Requirement:** Create integration tests for external service interactions.

**Integration Test Scenarios:**
- Qdrant CRUD operations (mocked Qdrant client)
- Embedding generation (mocked OpenAI/Voyage)
- MCP tool request/response cycle
- BM25 hybrid search flow

#### 4.1.5 Mocking Strategy

**Requirement:** Establish mocking patterns for external dependencies.

**Dependencies to Mock:**
| Dependency | Mock Strategy |
|------------|---------------|
| `@qdrant/js-client-rest` | Vitest mock with fixtures |
| `openai` | Vitest mock returning fixed embeddings |
| `fetch` (Linear/GitHub APIs) | MSW or manual mock |
| Environment variables | `vi.stubEnv()` |

---

### 4.2 CI/CD Pipeline (P0)

**Priority:** P0 (Critical)
**Effort:** Medium

#### 4.2.1 GitHub Actions Workflow

**Requirement:** Create comprehensive CI workflow.

**File:** `.github/workflows/ci.yml`

**Jobs Required:**

| Job | Trigger | Steps |
|-----|---------|-------|
| `build` | push, PR | Install deps, compile TypeScript |
| `lint` | push, PR | Run ESLint |
| `typecheck` | push, PR | Run `tsc --noEmit` |
| `test` | push, PR | Run Vitest with coverage |
| `security` | push, PR, weekly | Run `npm audit`, Snyk/Dependabot |

**Workflow Features:**
- [ ] Node.js matrix (18.x, 20.x, 22.x)
- [ ] Dependency caching (`actions/cache` for node_modules)
- [ ] Build artifact caching
- [ ] Parallel job execution where possible
- [ ] Required status checks for PR merge

#### 4.2.2 Release Automation

**Requirement:** Automate npm package releases.

**Release Workflow:**
- [ ] Trigger on version tag push (`v*.*.*`)
- [ ] Build and publish to npm registry
- [ ] Generate GitHub release with changelog
- [ ] Update CHANGELOG.md

#### 4.2.3 Dependency Management

**Requirement:** Automated dependency updates and security scanning.

**Tools:**
- [ ] Dependabot configuration for npm
- [ ] Weekly security audit job
- [ ] Automated PR for dependency updates

---

### 4.3 Code Quality Tooling (P1)

**Priority:** P1 (High)
**Effort:** Medium

#### 4.3.1 ESLint Configuration

**Requirement:** Configure ESLint with TypeScript support.

**File:** `.eslintrc.json`

**Rules to Enable:**
- `@typescript-eslint/recommended`
- `@typescript-eslint/strict-type-checked`
- No unused variables
- No explicit any (warnings)
- Consistent return types
- Import ordering

#### 4.3.2 Prettier Configuration

**Requirement:** Configure Prettier for consistent formatting.

**File:** `.prettierrc`

**Settings:**
```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

#### 4.3.3 Pre-commit Hooks

**Requirement:** Enforce quality checks before commit.

**Tools:**
- [ ] Husky for git hooks
- [ ] lint-staged for staged file linting

**Hook Configuration:**
```json
{
  "*.{ts,js}": ["eslint --fix", "prettier --write"],
  "*.{json,md}": ["prettier --write"]
}
```

#### 4.3.4 Package.json Scripts

**Additional Scripts:**
```json
{
  "lint": "eslint src/",
  "lint:fix": "eslint src/ --fix",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "typecheck": "tsc --noEmit"
}
```

---

### 4.4 Documentation (P1)

**Priority:** P1 (High)
**Effort:** Medium

#### 4.4.1 README.md

**Requirement:** Create comprehensive project README.

**Sections Required:**
- [ ] Project description and features
- [ ] Architecture diagram (Mermaid)
- [ ] Quick start guide
- [ ] Installation instructions
- [ ] Configuration reference
- [ ] MCP tools documentation
- [ ] Docker setup
- [ ] Development setup
- [ ] Contributing link
- [ ] License

#### 4.4.2 CONTRIBUTING.md

**Requirement:** Create contributor guide.

**Sections Required:**
- [ ] Development environment setup
- [ ] Code style guidelines
- [ ] Testing requirements
- [ ] Pull request process
- [ ] Issue reporting guidelines
- [ ] Code review expectations

#### 4.4.3 CHANGELOG.md

**Requirement:** Create version history log.

**Format:** Keep a Changelog (https://keepachangelog.com/)

**Sections per version:**
- Added, Changed, Deprecated, Removed, Fixed, Security

#### 4.4.4 LICENSE

**Requirement:** Add MIT license file.

**File:** `LICENSE`

#### 4.4.5 API Documentation

**Requirement:** Document all MCP tools with examples.

**Location:** `docs/API.md` or inline in README

**Per-tool documentation:**
- Description
- Input schema
- Output format
- Example usage
- Error conditions

---

### 4.5 Error Handling Improvements (P1)

**Priority:** P1 (High)
**Effort:** High

#### 4.5.1 Result Type Pattern

**Requirement:** Implement Result type for distinguishing errors from empty results.

**Design:**
```typescript
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };
```

**Functions to Update:**
- `searchSimilar()` - currently returns `[]` on error
- `searchLinearTickets()` - currently returns `[]` on error
- `searchGitHubTickets()` - currently returns `[]` on error
- `getLinearTicket()` - currently returns `null` on error
- `getGitHubTicket()` - currently returns `null` on error

#### 4.5.2 Timeout Configuration

**Requirement:** Add configurable timeouts for all HTTP calls.

**Default Timeouts:**
| Service | Timeout | Configurable |
|---------|---------|--------------|
| Qdrant | 60s | Yes (existing) |
| OpenAI | 30s | Yes (new) |
| Voyage AI | 30s | Yes (new) |
| Linear API | 10s | Yes (new) |
| GitHub API | 10s | Yes (new) |

**Implementation:**
```typescript
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response>
```

#### 4.5.3 Structured Logging

**Requirement:** Replace console.error with structured logger.

**Logger Interface:**
```typescript
interface Logger {
  debug(message: string, context?: object): void;
  info(message: string, context?: object): void;
  warn(message: string, context?: object): void;
  error(message: string, error?: Error, context?: object): void;
}
```

**Implementation Options:**
- Simple: Custom implementation with JSON output
- Advanced: pino or winston integration

#### 4.5.4 Error Context Preservation

**Requirement:** Preserve stack traces and context when wrapping errors.

**Current Problem (index.ts:934-936):**
```typescript
throw new McpError(
  ErrorCode.InternalError,
  error instanceof Error ? error.message : String(error)
  // Stack trace lost!
);
```

**Solution:**
```typescript
throw new McpError(
  ErrorCode.InternalError,
  error instanceof Error ? error.message : String(error),
  { cause: error }  // Preserve original error
);
```

---

### 4.6 Concurrency & Resource Management (P2)

**Priority:** P2 (Medium)
**Effort:** Medium

#### 4.6.1 Graceful Shutdown

**Requirement:** Handle process termination signals properly.

**Signals to Handle:**
- `SIGTERM` - Kubernetes/Docker termination
- `SIGINT` - Ctrl+C in terminal

**Shutdown Actions:**
1. Stop accepting new MCP requests
2. Wait for in-flight requests to complete (with timeout)
3. Close Qdrant connections
4. Flush any pending logs
5. Exit with code 0

**Implementation Location:** `src/index.ts`

#### 4.6.2 BM25 Service Cleanup

**Requirement:** Implement LRU cleanup for per-collection BM25 services.

**Current Problem:** BM25 services accumulate indefinitely in `bm25Services` Map.

**Solution:**
- Track last access time per service
- Implement cleanup for services not accessed in N minutes
- Set maximum number of cached services

**Configuration:**
```typescript
const BM25_SERVICE_MAX_COUNT = 10;
const BM25_SERVICE_TTL_MS = 30 * 60 * 1000; // 30 minutes
```

#### 4.6.3 Connection Lifecycle Management

**Requirement:** Proper connection handling for long-running process.

**Improvements:**
- [ ] Health check for Qdrant connection
- [ ] Automatic reconnection on connection loss
- [ ] Connection state logging

---

### 4.7 Security Hardening (P2)

**Priority:** P2 (Medium)
**Effort:** Low

#### 4.7.1 Scoped Fetch Override

**Requirement:** Restrict API key injection to Qdrant URLs only.

**Current Problem (fetch-override.ts):**
```typescript
// Adds API key to ALL fetch requests
globalThis.fetch = function(input, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('api-key', process.env.QDRANT_API_KEY!);
  return originalFetch(input, { ...init, headers });
};
```

**Solution:**
```typescript
globalThis.fetch = function(input, init = {}) {
  const url = typeof input === 'string' ? input : input.url;
  const qdrantUrl = process.env.QDRANT_URL || '';

  // Only add API key for Qdrant requests
  if (url.startsWith(qdrantUrl)) {
    const headers = new Headers(init.headers);
    headers.set('api-key', process.env.QDRANT_API_KEY!);
    return originalFetch(input, { ...init, headers });
  }

  return originalFetch(input, init);
};
```

#### 4.7.2 Input Size Validation

**Requirement:** Add limits to prevent DoS via oversized payloads.

**Limits to Add:**
| Input | Limit |
|-------|-------|
| Query string | 10,000 characters |
| Entities array | 1,000 items |
| Entity name | 500 characters |
| Observations array | 100 items per entity |
| Observation content | 50,000 characters |

**Implementation Location:** `src/validation.ts`

#### 4.7.3 API Key Validation

**Requirement:** Validate API keys at startup, not on first use.

**Checks:**
- [ ] OPENAI_API_KEY format validation (sk-...)
- [ ] QDRANT_API_KEY presence check if QDRANT_URL is cloud
- [ ] VOYAGE_API_KEY format validation if provider is voyage

---

### 4.8 Edge Case Handling (P2)

**Priority:** P2 (Medium)
**Effort:** Medium

#### 4.8.1 Unicode Support in BM25

**Requirement:** Handle non-ASCII characters in BM25 text processing.

**Current Problem (bm25Service.ts:224-256):**
```typescript
.replace(/[^\w\s]/g, ' ')  // Strips Unicode!
```

**Solution:**
```typescript
// Use Unicode-aware word boundary
.replace(/[^\p{L}\p{N}\s]/gu, ' ')  // Preserves Unicode letters and numbers
```

#### 4.8.2 Empty Collection Handling

**Requirement:** Provide clear feedback when collection is empty or misconfigured.

**Current Problem (qdrant.ts:221-224):**
```typescript
if (!currentVectorSize) {
  return;  // Silent return
}
```

**Solution:**
- Log warning when collection has no vector config
- Return informative error in MCP response
- Suggest remediation steps

#### 4.8.3 Large Payload Handling

**Requirement:** Handle very large response payloads gracefully.

**Current Mitigations (Good):**
- `autoReduceResponse()` with exponential backoff
- Token limits enforced at multiple levels
- Safety limits on scroll operations (50 batches, 50,000 items)

**Improvements:**
- [ ] Add streaming response support for very large graphs
- [ ] Implement pagination for `read_graph` results
- [ ] Add `total_count` to paginated responses

---

## 5. Non-Goals

The following are explicitly **out of scope** for this enhancement:

1. **New MCP Tools** - No new tools will be added; focus is on hardening existing functionality
2. **Performance Optimization** - Current performance is acceptable; no major algorithmic changes
3. **Database Migration** - Qdrant schema will remain unchanged
4. **Multi-tenancy** - Existing collection-based isolation is sufficient
5. **Authentication** - MCP transport security is handled by Claude Code
6. **Monitoring/Alerting** - No APM or observability integration (future consideration)
7. **Web UI** - No admin interface or dashboard

---

## 6. Milestones

### Milestone 1: Testing Foundation (Week 1-2)

| Deliverable | Description |
|-------------|-------------|
| Vitest configuration | `vitest.config.ts` with coverage |
| Core module tests | validation, tokenCounter, planModeGuard |
| Test scripts | npm test, test:watch, test:coverage |
| 60% coverage | Baseline coverage established |

### Milestone 2: CI/CD Pipeline (Week 2-3)

| Deliverable | Description |
|-------------|-------------|
| CI workflow | `.github/workflows/ci.yml` |
| Quality gates | Build, lint, typecheck, test on PR |
| Dependency scanning | npm audit integration |

### Milestone 3: Code Quality & Docs (Week 3-4)

| Deliverable | Description |
|-------------|-------------|
| ESLint + Prettier | Linting and formatting configured |
| Pre-commit hooks | Husky + lint-staged |
| README.md | Comprehensive project README |
| CONTRIBUTING.md | Contributor guide |
| CHANGELOG.md | Version history |
| LICENSE | MIT license file |

### Milestone 4: Error Handling (Week 4-5)

| Deliverable | Description |
|-------------|-------------|
| Result type | Error/success distinction pattern |
| Timeout configuration | HTTP call timeouts |
| Structured logging | Logger interface implementation |
| Error context | Stack trace preservation |

### Milestone 5: Hardening (Week 5-6)

| Deliverable | Description |
|-------------|-------------|
| Graceful shutdown | Signal handlers |
| BM25 cleanup | LRU service management |
| Fetch scoping | API key injection fix |
| Input validation | Size limits |
| Unicode support | BM25 i18n fix |
| 80% coverage | Target coverage achieved |

---

## 7. Open Questions

| Question | Owner | Status |
|----------|-------|--------|
| Should we use pino or winston for logging, or keep it simple? | TBD | Open |
| What's the minimum Node.js version to support? (Currently 18+) | TBD | Open |
| Should we add OpenAPI spec for MCP tools documentation? | TBD | Open |
| Do we need rate limiting for external APIs or is timeout sufficient? | TBD | Open |
| Should BM25 services be persisted across restarts? | TBD | Open |

---

## 8. Appendix: Audit Findings

### A. Files Audited

| File | Lines | Issues Found |
|------|-------|--------------|
| `src/index.ts` | 1038 | Error context loss (line 934-936) |
| `src/persistence/qdrant.ts` | ~1200 | Silent failures (501, 835, 1023, 1080) |
| `src/validation.ts` | 510 | No size limits |
| `src/bm25/bm25Service.ts` | 331 | Unicode stripping (line 224) |
| `src/fetch-override.ts` | 7 | Over-broad API key injection |
| `src/plan-mode-guard.ts` | 164 | Well-implemented |
| `src/tokenCounter.ts` | 241 | Well-implemented |
| `src/streamingResponseBuilder.ts` | 546 | Well-implemented |

### B. Dependency Analysis

| Dependency | Version | Security Status |
|------------|---------|-----------------|
| `@modelcontextprotocol/sdk` | ^1.0.1 | OK |
| `@qdrant/js-client-rest` | ^1.13.0 | OK |
| `axios` | ^1.8.1 | OK |
| `dotenv` | ^16.3.1 | OK |
| `minimatch` | ^9.0.0 | OK |
| `okapibm25` | ^1.4.1 | OK |
| `openai` | ^4.24.1 | OK |

### C. Test Coverage Baseline

| Module | Current | Target |
|--------|---------|--------|
| All modules | 0% | 80%+ |

---

*End of PRD*
