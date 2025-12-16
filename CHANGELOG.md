# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- ESLint configuration with TypeScript support
- Prettier configuration for consistent formatting
- Husky + lint-staged for pre-commit hooks
- CONTRIBUTING.md with development guidelines
- LICENSE file (MIT)
- Lint job in CI/CD workflow

### Changed

- Updated package.json with lint and format scripts

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
