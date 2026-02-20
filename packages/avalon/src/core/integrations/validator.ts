import type { Integration, IntegrationConfig } from "@avalon/core";

/**
 * Validation result for an integration
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate that an integration implements the required interface
 */
export function validateIntegration(integration: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if integration is an object
  if (!integration || typeof integration !== "object") {
    errors.push("Integration must be an object");
    return { valid: false, errors, warnings };
  }

  const int = integration as Partial<Integration>;

  // Validate required properties
  if (!int.name || typeof int.name !== "string") {
    errors.push("Integration must have a 'name' property of type string");
  }

  if (!int.version || typeof int.version !== "string") {
    errors.push("Integration must have a 'version' property of type string");
  }

  // Validate required methods
  if (!int.render || typeof int.render !== "function") {
    errors.push("Integration must have a 'render' method");
  }

  if (!int.getHydrationScript || typeof int.getHydrationScript !== "function") {
    errors.push("Integration must have a 'getHydrationScript' method");
  }

  if (!int.config || typeof int.config !== "function") {
    errors.push("Integration must have a 'config' method");
  }

  // Validate optional methods
  if (int.vitePlugin !== undefined && typeof int.vitePlugin !== "function") {
    warnings.push("'vitePlugin' property should be a function if provided");
  }

  // Validate config if method exists
  if (int.config && typeof int.config === "function") {
    try {
      const config = int.config();
      const configValidation = validateIntegrationConfig(config);
      errors.push(...configValidation.errors);
      warnings.push(...configValidation.warnings);
    } catch (error) {
      errors.push(
        `config() method threw an error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate integration configuration object
 */
export function validateIntegrationConfig(config: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config || typeof config !== "object") {
    errors.push("Integration config must be an object");
    return { valid: false, errors, warnings };
  }

  const cfg = config as Partial<IntegrationConfig>;

  // Validate required config properties
  if (!cfg.name || typeof cfg.name !== "string") {
    errors.push("Integration config must have a 'name' property of type string");
  }

  if (!Array.isArray(cfg.fileExtensions)) {
    errors.push("Integration config must have a 'fileExtensions' array");
  } else if (cfg.fileExtensions.length === 0) {
    warnings.push("Integration config has empty 'fileExtensions' array");
  } else {
    // Validate each extension
    cfg.fileExtensions.forEach((ext, index) => {
      if (typeof ext !== "string") {
        errors.push(`fileExtensions[${index}] must be a string`);
      } else if (!ext.startsWith(".")) {
        warnings.push(`fileExtensions[${index}] should start with a dot (e.g., '.tsx')`);
      }
    });
  }

  // Validate optional properties
  if (cfg.jsxImportSources !== undefined) {
    if (!Array.isArray(cfg.jsxImportSources)) {
      errors.push("'jsxImportSources' must be an array if provided");
    }
  }

  if (cfg.detectionPatterns !== undefined) {
    if (typeof cfg.detectionPatterns !== "object") {
      errors.push("'detectionPatterns' must be an object if provided");
    } else {
      const patterns = cfg.detectionPatterns;
      
      if (patterns.imports !== undefined && !Array.isArray(patterns.imports)) {
        errors.push("'detectionPatterns.imports' must be an array if provided");
      }
      
      if (patterns.content !== undefined && !Array.isArray(patterns.content)) {
        errors.push("'detectionPatterns.content' must be an array if provided");
      }

      // Validate that patterns are RegExp objects
      if (Array.isArray(patterns.imports)) {
        patterns.imports.forEach((pattern, index) => {
          if (!(pattern instanceof RegExp)) {
            errors.push(`detectionPatterns.imports[${index}] must be a RegExp`);
          }
        });
      }

      if (Array.isArray(patterns.content)) {
        patterns.content.forEach((pattern, index) => {
          if (!(pattern instanceof RegExp)) {
            errors.push(`detectionPatterns.content[${index}] must be a RegExp`);
          }
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate multiple integrations and return a summary
 */
export function validateIntegrations(
  integrations: unknown[]
): { valid: boolean; results: Map<string, ValidationResult> } {
  const results = new Map<string, ValidationResult>();
  let allValid = true;

  integrations.forEach((integration, index) => {
    const result = validateIntegration(integration);
    
    // Use integration name if available, otherwise use index
    const name = 
      integration && 
      typeof integration === "object" && 
      "name" in integration && 
      typeof integration.name === "string"
        ? integration.name
        : `integration-${index}`;
    
    results.set(name, result);
    
    if (!result.valid) {
      allValid = false;
    }
  });

  return { valid: allValid, results };
}

/**
 * Assert that an integration is valid, throwing an error if not
 */
export function assertValidIntegration(integration: unknown): asserts integration is Integration {
  const result = validateIntegration(integration);
  
  if (!result.valid) {
    const errorMessage = [
      "Integration validation failed:",
      ...result.errors.map(err => `  - ${err}`),
    ].join("\n");
    
    throw new Error(errorMessage);
  }
}

/**
 * Format validation result as a human-readable string
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];
  
  if (result.valid) {
    lines.push("✓ Integration is valid");
  } else {
    lines.push("✗ Integration validation failed");
  }
  
  if (result.errors.length > 0) {
    lines.push("\nErrors:");
    result.errors.forEach(error => {
      lines.push(`  - ${error}`);
    });
  }
  
  if (result.warnings.length > 0) {
    lines.push("\nWarnings:");
    result.warnings.forEach(warning => {
      lines.push(`  - ${warning}`);
    });
  }
  
  return lines.join("\n");
}
