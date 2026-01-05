/**
 * Island Validator
 * 
 * Validates island components and directory structure.
 * Provides validation for exports, naming conventions, and circular dependencies.
 */

import { resolve, relative, basename, extname } from "@std/path";
import type {
  IslandDirectory,
  DiscoveredIsland,
} from "./types.ts";
import { isSupportedIslandExtension } from "./types.ts";

/**
 * Result of validating an island or directory
 */
export interface ValidationResult {
  /** Whether validation passed (no errors) */
  valid: boolean;
  /** Validation errors (failures) */
  errors: ValidationError[];
  /** Validation warnings (non-fatal issues) */
  warnings: ValidationWarning[];
}

/**
 * A validation error (causes validation to fail)
 */
export interface ValidationError {
  /** Type of error */
  type: "invalid-export" | "circular-dependency" | "naming-convention";
  /** Human-readable error message */
  message: string;
  /** Absolute file path where error occurred */
  filePath: string;
  /** Line number (1-indexed) if applicable */
  line?: number;
  /** Column number (1-indexed) if applicable */
  column?: number;
  /** Suggested fix for the error */
  suggestion?: string;
}

/**
 * A validation warning (non-fatal issue)
 */
export interface ValidationWarning {
  /** Type of warning */
  type: "empty-directory" | "naming-collision" | "deprecated-pattern";
  /** Human-readable warning message */
  message: string;
  /** File path if applicable */
  filePath?: string;
  /** Suggested fix for the warning */
  suggestion?: string;
}

/**
 * Represents a circular dependency chain
 */
export interface CircularDependency {
  /** The cycle as an array of file paths */
  cycle: string[];
  /** Human-readable description of the cycle */
  description: string;
}

const NAMING_PATTERNS = {
  pascalCase: /^[A-Z][a-zA-Z0-9]*$/,
  validFileName: /^[a-zA-Z][a-zA-Z0-9._-]*$/,
  frameworkSuffixes: [".solid", ".react", ".lit", ".preact"],
};

const DOCS_URL = "https://avalon.dev/docs/islands";


/**
 * Island Validator class
 */
export class IslandValidator {
  private _projectRoot: string;

  constructor(projectRoot: string) {
    this._projectRoot = projectRoot;
  }

  get projectRoot(): string {
    return this._projectRoot;
  }

  private extractComponentName(filePath: string): string {
    const fileName = basename(filePath);
    for (const suffix of NAMING_PATTERNS.frameworkSuffixes) {
      if (fileName.includes(suffix)) {
        const idx = fileName.indexOf(suffix);
        return fileName.slice(0, idx);
      }
    }
    const ext = extname(fileName);
    return fileName.slice(0, -ext.length);
  }

  private toPascalCase(str: string): string {
    return str
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join("");
  }

  private hasValidJsExport(content: string): boolean {
    const hasDefaultExport = 
      /export\s+default\s+/.test(content) ||
      /export\s*\{\s*[^}]*\s+as\s+default\s*[,}]/.test(content);
    const hasNamedComponentExport = 
      /export\s+(function|class|const)\s+[A-Z]/.test(content);
    const hasLitElement = 
      /@customElement\s*\(/.test(content) ||
      /customElements\.define\s*\(/.test(content);
    return hasDefaultExport || hasNamedComponentExport || hasLitElement;
  }

  private isValidVueComponent(content: string): boolean {
    return /<template[\s>]/.test(content) || /<script[\s>]/.test(content);
  }

  private isValidSvelteComponent(content: string): boolean {
    return content.trim().length > 0;
  }

  private createExportError(filePath: string, type: "js" | "vue" | "svelte"): ValidationError {
    const componentName = this.extractComponentName(filePath);
    let suggestion: string;
    switch (type) {
      case "vue":
        suggestion = "Add a <template> or <script> section to your Vue component";
        break;
      case "svelte":
        suggestion = "Add component markup to your Svelte file";
        break;
      default:
        suggestion = `Add a default export: export default function ${componentName}() { return <div>...</div>; }`;
    }
    return {
      type: "invalid-export",
      message: `Island component "${componentName}" does not export a valid component`,
      filePath,
      line: 1,
      column: 1,
      suggestion: `${suggestion}\n\nSee: ${DOCS_URL}#component-exports`,
    };
  }

  private async validateExports(filePath: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    try {
      const content = await Deno.readTextFile(filePath);
      const ext = extname(filePath).toLowerCase();
      if (ext === ".vue") {
        if (!this.isValidVueComponent(content)) {
          errors.push(this.createExportError(filePath, "vue"));
        }
      } else if (ext === ".svelte") {
        if (!this.isValidSvelteComponent(content)) {
          errors.push(this.createExportError(filePath, "svelte"));
        }
      } else {
        if (!this.hasValidJsExport(content)) {
          errors.push(this.createExportError(filePath, "js"));
        }
      }
    } catch {
      errors.push({
        type: "invalid-export",
        message: `Cannot read file: ${filePath}`,
        filePath,
        suggestion: "Check file permissions and encoding",
      });
    }
    return { valid: errors.length === 0, errors, warnings };
  }

  private extractJsImports(content: string): string[] {
    const imports: string[] = [];
    const es6ImportRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = es6ImportRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    return imports;
  }

  private extractImports(content: string, filePath: string): string[] {
    const imports: string[] = [];
    const ext = extname(filePath).toLowerCase();
    if (ext === ".vue" || ext === ".svelte") {
      const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
      if (scriptMatch) {
        for (const script of scriptMatch) {
          imports.push(...this.extractJsImports(script));
        }
      }
    } else {
      imports.push(...this.extractJsImports(content));
    }
    return imports;
  }

  private resolveImportToIsland(
    importPath: string,
    fromIsland: DiscoveredIsland,
    islandByName: Map<string, DiscoveredIsland>,
    islandPaths: Set<string>
  ): DiscoveredIsland | null {
    if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
      return null;
    }
    if (importPath.startsWith(".")) {
      const fromDir = resolve(fromIsland.filePath, "..");
      const resolvedPath = resolve(fromDir, importPath);
      if (!extname(resolvedPath)) {
        const extensions = [".tsx", ".ts", ".jsx", ".js", ".vue", ".svelte"];
        for (const ext of extensions) {
          if (islandPaths.has(resolvedPath + ext)) {
            for (const island of islandByName.values()) {
              if (island.filePath === resolvedPath + ext) {
                return island;
              }
            }
          }
        }
      }
      if (islandPaths.has(resolvedPath)) {
        for (const island of islandByName.values()) {
          if (island.filePath === resolvedPath) {
            return island;
          }
        }
      }
    }
    const componentName = basename(importPath).replace(/\.[^.]+$/, "");
    return islandByName.get(componentName) || null;
  }

  private async buildImportGraph(islands: DiscoveredIsland[]): Promise<Map<string, string[]>> {
    const graph = new Map<string, string[]>();
    const islandPaths = new Set(islands.map(i => i.filePath));
    const islandByName = new Map<string, DiscoveredIsland>();
    for (const island of islands) {
      islandByName.set(island.name, island);
      const relPath = island.relativePath.replace(/\.[^.]+$/, "");
      islandByName.set(relPath, island);
    }
    for (const island of islands) {
      const imports: string[] = [];
      try {
        const content = await Deno.readTextFile(island.filePath);
        const importedPaths = this.extractImports(content, island.filePath);
        for (const importPath of importedPaths) {
          const resolvedIsland = this.resolveImportToIsland(importPath, island, islandByName, islandPaths);
          if (resolvedIsland) {
            imports.push(resolvedIsland.filePath);
          }
        }
      } catch {
        // Skip files that can't be read
      }
      graph.set(island.filePath, imports);
    }
    return graph;
  }

  private cycleExists(cycles: string[][], newCycle: string[]): boolean {
    const newSet = new Set(newCycle);
    for (const existing of cycles) {
      if (existing.length !== newCycle.length - 1) continue;
      const existingSet = new Set(existing);
      let allMatch = true;
      for (const node of newSet) {
        if (!existingSet.has(node)) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) return true;
    }
    return false;
  }

  private findCycles(graph: Map<string, string[]>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];
    const dfs = (node: string): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);
      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (recursionStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart !== -1) {
            const cycle = [...path.slice(cycleStart), neighbor];
            if (!this.cycleExists(cycles, cycle)) {
              cycles.push(cycle);
            }
          }
        }
      }
      path.pop();
      recursionStack.delete(node);
    };
    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }
    return cycles;
  }

  private formatCycleDescription(cycle: string[]): string {
    const relativePaths = cycle.map(p => relative(this._projectRoot, p));
    return `Circular dependency detected:\n  ${relativePaths.join("\n  → ")}`;
  }


  async validateComponent(filePath: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    try {
      const stat = await Deno.stat(filePath);
      if (!stat.isFile) {
        errors.push({ type: "invalid-export", message: `Path is not a file: ${filePath}`, filePath });
        return { valid: false, errors, warnings };
      }
    } catch {
      errors.push({ type: "invalid-export", message: `File not found: ${filePath}`, filePath });
      return { valid: false, errors, warnings };
    }
    const ext = extname(filePath);
    if (!isSupportedIslandExtension(ext)) {
      errors.push({
        type: "invalid-export",
        message: `Unsupported file extension: ${ext}`,
        filePath,
        suggestion: `Use one of: .tsx, .ts, .jsx, .js, .vue, .svelte`,
      });
      return { valid: false, errors, warnings };
    }
    const namingResult = this.validateNamingConvention(this.extractComponentName(filePath), filePath);
    errors.push(...namingResult.errors);
    warnings.push(...namingResult.warnings);
    const exportResult = await this.validateExports(filePath);
    errors.push(...exportResult.errors);
    warnings.push(...exportResult.warnings);
    return { valid: errors.length === 0, errors, warnings };
  }

  async validateDirectory(directory: IslandDirectory): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let hasIslands = false;
    try {
      for await (const entry of Deno.readDir(directory.path)) {
        if (!entry.isFile) continue;
        const ext = extname(entry.name);
        if (!isSupportedIslandExtension(ext)) continue;
        hasIslands = true;
        const filePath = resolve(directory.path, entry.name);
        const result = await this.validateComponent(filePath);
        errors.push(...result.errors);
        warnings.push(...result.warnings);
      }
    } catch {
      errors.push({
        type: "invalid-export",
        message: `Cannot read directory: ${directory.path}`,
        filePath: directory.path,
        suggestion: "Check directory permissions",
      });
      return { valid: false, errors, warnings };
    }
    if (!hasIslands) {
      warnings.push({
        type: "empty-directory",
        message: `Islands directory is empty: ${directory.relativePath}`,
        filePath: directory.path,
        suggestion: "Add island components or remove the empty directory",
      });
    }
    return { valid: errors.length === 0, errors, warnings };
  }

  validateNamingConvention(name: string, filePath: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    if (!NAMING_PATTERNS.pascalCase.test(name)) {
      if (name.length === 0) {
        errors.push({
          type: "naming-convention",
          message: `Invalid component name: empty name`,
          filePath,
          suggestion: `Use PascalCase naming (e.g., "Counter", "UserProfile")`,
        });
      } else if (/^[a-z]/.test(name)) {
        warnings.push({
          type: "deprecated-pattern",
          message: `Component name "${name}" should use PascalCase`,
          filePath,
          suggestion: `Rename to "${this.toPascalCase(name)}"`,
        });
      } else if (/[^a-zA-Z0-9]/.test(name)) {
        warnings.push({
          type: "deprecated-pattern",
          message: `Component name "${name}" contains special characters`,
          filePath,
          suggestion: `Use only letters and numbers in component names`,
        });
      }
    }
    return { valid: errors.length === 0, errors, warnings };
  }

  async detectCircularDependencies(islands: DiscoveredIsland[]): Promise<CircularDependency[]> {
    const graph = await this.buildImportGraph(islands);
    const cycles = this.findCycles(graph);
    return cycles.map((cycle: string[]) => ({
      cycle,
      description: this.formatCycleDescription(cycle),
    }));
  }
}


export function formatValidationError(error: ValidationError, projectRoot: string): string {
  const relativePath = relative(projectRoot, error.filePath);
  const location = error.line 
    ? `${relativePath}:${error.line}${error.column ? `:${error.column}` : ""}`
    : relativePath;
  let output = `Error: ${error.message}\n\n`;
  output += `  File: ${location}\n`;
  if (error.suggestion) {
    output += `\n  ${error.suggestion}\n`;
  }
  return output;
}

export function formatValidationWarning(warning: ValidationWarning, projectRoot: string): string {
  let output = `Warning: ${warning.message}\n`;
  if (warning.filePath) {
    const relativePath = relative(projectRoot, warning.filePath);
    output += `  File: ${relativePath}\n`;
  }
  if (warning.suggestion) {
    output += `  Suggestion: ${warning.suggestion}\n`;
  }
  return output;
}

export function formatCircularDependency(circular: CircularDependency, projectRoot: string): string {
  const relativePaths = circular.cycle.map(p => relative(projectRoot, p));
  let output = `Error: Circular dependency detected\n\n`;
  output += `  Dependency chain:\n`;
  for (let i = 0; i < relativePaths.length; i++) {
    const isLast = i === relativePaths.length - 1;
    const prefix = isLast ? "  └─" : "  ├─";
    output += `${prefix} ${relativePaths[i]}\n`;
    if (!isLast) {
      output += `  │  ↓\n`;
    }
  }
  output += `\n  Suggestion: Break the cycle by:\n`;
  output += `    - Moving shared code to a separate module\n`;
  output += `    - Using dynamic imports for one of the dependencies\n`;
  output += `    - Restructuring the component hierarchy\n`;
  output += `\n  See: ${DOCS_URL}#circular-dependencies\n`;
  return output;
}

export function formatValidationResult(result: ValidationResult, projectRoot: string): string {
  const parts: string[] = [];
  if (result.errors.length > 0) {
    parts.push(`Found ${result.errors.length} error(s):\n`);
    for (const error of result.errors) {
      parts.push(formatValidationError(error, projectRoot));
    }
  }
  if (result.warnings.length > 0) {
    if (parts.length > 0) parts.push("\n");
    parts.push(`Found ${result.warnings.length} warning(s):\n`);
    for (const warning of result.warnings) {
      parts.push(formatValidationWarning(warning, projectRoot));
    }
  }
  if (result.valid && result.warnings.length === 0) {
    parts.push("✓ Validation passed\n");
  } else if (result.valid) {
    parts.push("\n✓ Validation passed with warnings\n");
  } else {
    parts.push("\n✗ Validation failed\n");
  }
  return parts.join("\n");
}

export function createIslandValidator(projectRoot: string): IslandValidator {
  return new IslandValidator(projectRoot);
}

export async function validateAllIslands(
  islands: DiscoveredIsland[],
  projectRoot: string
): Promise<ValidationResult> {
  const validator = createIslandValidator(projectRoot);
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  for (const island of islands) {
    const result = await validator.validateComponent(island.filePath);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }
  const circularDeps = await validator.detectCircularDependencies(islands);
  for (const circular of circularDeps) {
    errors.push({
      type: "circular-dependency",
      message: circular.description,
      filePath: circular.cycle[0],
    });
  }
  return { valid: errors.length === 0, errors, warnings };
}
