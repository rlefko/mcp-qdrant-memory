# Contributing to MCP-Qdrant-Memory

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 18+ (20+ recommended)
- npm 9+
- Docker (for Qdrant)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/rlefko/mcp-qdrant-memory.git
   cd mcp-qdrant-memory
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment:

   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. Build the project:
   ```bash
   npm run build
   ```

## Code Style

This project uses:

- **ESLint** with TypeScript support for linting
- **Prettier** for code formatting
- **Husky** + **lint-staged** for pre-commit hooks

### Commands

```bash
npm run lint          # Check for linting errors
npm run lint:fix      # Auto-fix linting errors
npm run format        # Format all files
npm run format:check  # Check formatting
npm run typecheck     # Run TypeScript type checking
```

### Style Guidelines

- Use double quotes for strings
- Use semicolons
- Use 2-space indentation
- Maximum line width: 100 characters

## Testing

```bash
npm test              # Run tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

All new features should include tests. Target coverage is >80% for core modules.

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Ensure all checks pass:
   ```bash
   npm run lint
   npm run format:check
   npm run typecheck
   npm test
   ```
5. Commit your changes (pre-commit hooks will run automatically)
6. Push to your fork and create a Pull Request

### PR Requirements

- All CI checks must pass (Build, TypeCheck, Lint, Test, Security)
- New features should include tests
- Documentation should be updated if applicable
- Commit messages should follow conventional format

## Commit Messages

Use conventional commit format:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting)
- `refactor:` - Code refactoring
- `test:` - Test additions/changes
- `chore:` - Maintenance tasks

Examples:

```
feat: add hybrid search mode
fix: resolve token counting for unicode
docs: update MCP tools documentation
```

## Project Structure

```
mcp-qdrant-memory/
├── src/
│   ├── index.ts              # Main MCP server entry
│   ├── persistence/          # Qdrant database integration
│   ├── bm25/                  # BM25 hybrid search
│   ├── claudeignore/          # Ignore pattern handling
│   ├── validation.ts          # Input validation
│   ├── tokenCounter.ts        # Token management
│   └── __tests__/             # Test suite
├── dist/                      # Compiled output
├── docs/                      # Documentation
└── .github/workflows/         # CI/CD pipelines
```

## Questions?

Open an issue for any questions or concerns.
