/**
 * ClaudeIgnore Filter for MCP Server
 *
 * Filters search results based on .claudeignore patterns.
 * Loads patterns from:
 * 1. Global ~/.claude-indexer/.claudeignore
 * 2. Project .claudeignore (from PROJECT_PATH env var)
 *
 * Uses minimatch for gitignore-compatible pattern matching.
 */

import { minimatch } from "minimatch";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * Universal exclude patterns - always applied.
 * These are patterns that should never be indexed or returned in search results.
 */
const UNIVERSAL_EXCLUDES: string[] = [
  // Core system directories
  ".git/",
  ".claude-indexer/",
  ".claude/",
  ".svn/",
  ".hg/",
  // Python
  "*.pyc",
  "*.pyo",
  "__pycache__/",
  ".venv/",
  "venv/",
  // Node.js
  "node_modules/",
  // Build outputs
  "dist/",
  "build/",
  // Package locks
  "package-lock.json",
  "yarn.lock",
  "poetry.lock",
  // Logs
  "*.log",
  "logs/",
];

export interface ClaudeIgnoreStats {
  totalPatterns: number;
  universalPatterns: number;
  globalPatterns: number;
  projectPatterns: number;
  projectPath: string | null;
  globalIgnoreExists: boolean;
  projectIgnoreExists: boolean;
}

export class ClaudeIgnoreFilter {
  private patterns: string[] = [];
  private projectRoot: string | null = null;
  private loaded: boolean = false;
  private stats: ClaudeIgnoreStats = {
    totalPatterns: 0,
    universalPatterns: 0,
    globalPatterns: 0,
    projectPatterns: 0,
    projectPath: null,
    globalIgnoreExists: false,
    projectIgnoreExists: false,
  };

  /**
   * Create a new ClaudeIgnoreFilter.
   * @param projectRoot Optional project root path. If not provided, uses PROJECT_PATH env var.
   */
  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.env.PROJECT_PATH || null;
    this.loadPatterns();
  }

  /**
   * Load patterns from all sources.
   */
  private loadPatterns(): void {
    this.patterns = [];

    // Layer 1: Universal defaults
    this.patterns.push(...UNIVERSAL_EXCLUDES);
    this.stats.universalPatterns = UNIVERSAL_EXCLUDES.length;

    // Layer 2: Global .claudeignore
    const globalIgnorePath = path.join(os.homedir(), ".claude-indexer", ".claudeignore");
    this.stats.globalIgnoreExists = fs.existsSync(globalIgnorePath);
    if (this.stats.globalIgnoreExists) {
      const globalPatterns = this.loadFromFile(globalIgnorePath);
      this.patterns.push(...globalPatterns);
      this.stats.globalPatterns = globalPatterns.length;
    }

    // Layer 3: Project .claudeignore
    if (this.projectRoot) {
      const projectIgnorePath = path.join(this.projectRoot, ".claudeignore");
      this.stats.projectIgnoreExists = fs.existsSync(projectIgnorePath);
      if (this.stats.projectIgnoreExists) {
        const projectPatterns = this.loadFromFile(projectIgnorePath);
        this.patterns.push(...projectPatterns);
        this.stats.projectPatterns = projectPatterns.length;
      }
    }

    this.stats.projectPath = this.projectRoot;
    this.stats.totalPatterns = this.patterns.length;
    this.loaded = true;
  }

  /**
   * Load patterns from a .claudeignore file.
   */
  private loadFromFile(filePath: string): string[] {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return this.parseIgnoreContent(content);
    } catch (error) {
      console.error(`Warning: Could not read ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Parse .claudeignore content into patterns.
   */
  private parseIgnoreContent(content: string): string[] {
    const patterns: string[] = [];

    for (const line of content.split("\n")) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      // Handle escaped characters
      let pattern = trimmed;
      if (pattern.startsWith("\\#") || pattern.startsWith("\\!")) {
        pattern = pattern.substring(1);
      }

      patterns.push(pattern);
    }

    return patterns;
  }

  /**
   * Check if a file path should be ignored.
   * @param filePath The file path to check (can be relative or absolute).
   * @returns True if the path should be ignored.
   */
  shouldIgnore(filePath: string | undefined): boolean {
    if (!filePath || !this.loaded) {
      return false;
    }

    // Normalize path to forward slashes and make relative if needed
    let normalizedPath = filePath.replace(/\\/g, "/");

    // Make path relative to project root if it's absolute
    if (this.projectRoot && path.isAbsolute(normalizedPath)) {
      try {
        normalizedPath = path.relative(this.projectRoot, normalizedPath);
      } catch {
        // If we can't make it relative, use as-is
      }
    }

    // Check each pattern
    for (const pattern of this.patterns) {
      // Handle negation patterns
      if (pattern.startsWith("!")) {
        // Negation - if it matches, DON'T ignore
        const negPattern = pattern.substring(1);
        if (this.matchesPattern(normalizedPath, negPattern)) {
          return false;
        }
        continue;
      }

      if (this.matchesPattern(normalizedPath, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a path matches a single pattern.
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    // Handle directory patterns (ending with /)
    if (pattern.endsWith("/")) {
      const dirPattern = pattern.slice(0, -1);
      // Check if path starts with pattern or contains it as a directory component
      if (
        filePath.startsWith(dirPattern + "/") ||
        filePath.includes("/" + dirPattern + "/") ||
        filePath === dirPattern
      ) {
        return true;
      }
    }

    // Use minimatch for glob pattern matching
    // Add matchBase option to match patterns like "*.py" against "foo/bar.py"
    const options = {
      matchBase: !pattern.includes("/"),
      dot: true, // Match dotfiles
      nocomment: true,
      noglobstar: false,
    };

    if (minimatch(filePath, pattern, options)) {
      return true;
    }

    // Also try matching against just the filename for simple patterns
    const filename = path.basename(filePath);
    if (!pattern.includes("/") && minimatch(filename, pattern, options)) {
      return true;
    }

    return false;
  }

  /**
   * Filter search results, removing any that match ignore patterns.
   * @param results Array of search results with file_path in data.
   * @returns Filtered results with ignored files removed.
   */
  filterResults<T extends { data: { file_path?: string } }>(results: T[]): T[] {
    if (!this.loaded || this.patterns.length === 0) {
      return results;
    }

    return results.filter((result) => {
      const filePath = result.data?.file_path;
      return !this.shouldIgnore(filePath);
    });
  }

  /**
   * Get statistics about loaded patterns.
   */
  getStats(): ClaudeIgnoreStats {
    return { ...this.stats };
  }

  /**
   * Check if the filter has been loaded.
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Reload patterns (useful if .claudeignore files have changed).
   */
  reload(): void {
    this.loadPatterns();
  }
}

/**
 * Create a filter instance from environment configuration.
 * Returns null if PROJECT_PATH is not set.
 */
export function createFilterFromEnv(): ClaudeIgnoreFilter | null {
  const projectPath = process.env.PROJECT_PATH;
  if (!projectPath) {
    return null;
  }
  return new ClaudeIgnoreFilter(projectPath);
}
