# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Graceful shutdown handling (SIGTERM/SIGINT) with `ShutdownManager` class
- HTTP client with timeout support (`fetchWithTimeout`) for external API calls
- BM25 service LRU cleanup with configurable TTL and max service count
- New environment variables for timeout configuration
- ESLint configuration with TypeScript support
- Prettier configuration for consistent formatting
- Husky + lint-staged for pre-commit hooks
- CONTRIBUTING.md with development guidelines
- LICENSE file (MIT)
- Lint job in CI/CD workflow

### Changed

- External API calls now have configurable timeouts:
  - Voyage AI: 30s (default)
  - Linear API: 10s (default)
  - GitHub API: 10s (default)
- BM25 services are now cleaned up after 30 minutes of inactivity
- Updated package.json with lint and format scripts

### Fixed

- Requests no longer hang indefinitely on slow external APIs
- Memory leaks from accumulating BM25 services prevented

## [0.2.5] - 2024-12-15

### Added

- Comprehensive test suite with Vitest (362 tests)
- CI/CD pipeline with GitHub Actions
- Test coverage reporting (v8 provider)
- Integration tests for MCP tools
- Mock infrastructure for isolated testing

### Fixed

- BM25 vitest import compatibility issue

## [0.2.4] - 2024-12-01

### Added

- Progressive disclosure architecture
- BM25 hybrid search support with RRF fusion
- Multi-collection support via `collection` parameter
- Token management with auto-reduction
- Plan mode guard for read-only access control

### Changed

- Search defaults to hybrid mode (70% semantic + 30% BM25)

## [0.2.0] - 2024-11-12

### Added

- Initial public release
- Semantic search capabilities
- Knowledge graph implementation
- MCP protocol integration
- Entity and relation management
- `search_similar` tool
- `read_graph` tool with multiple modes
- `get_implementation` tool with scope control
- Entity management tools (create, update, delete)
