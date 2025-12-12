/**
 * CLI utilities for managing integrations
 * Provides commands for listing, validating, and managing integrations
 */

import {
  initializeIntegrations,
  listIntegrations,
  formatInitializationResult,
  formatIntegrationList,
} from "./startup.ts";
import { generateDefaultConfig } from "./config-loader.ts";
import { registry } from "./registry.ts";
import { validateIntegration, formatValidationResult } from "./validator.ts";

/**
 * List all integrations
 */
export async function listCommand(options: { verbose?: boolean } = {}): Promise<void> {
  console.log("Loading integrations...\n");
  
  const integrations = await listIntegrations();
  console.log(formatIntegrationList(integrations));
  
  if (options.verbose) {
    console.log("\nRegistry status:");
    console.log(`  Total registered: ${registry.size}`);
    console.log(`  Registered names: ${registry.getAllNames().join(", ") || "none"}`);
  }
}

/**
 * Validate all integrations
 */
export async function validateCommand(): Promise<void> {
  console.log("Validating integrations...\n");
  
  const result = await initializeIntegrations();
  console.log(formatInitializationResult(result));
  
  if (!result.success) {
    Deno.exit(1);
  }
}

/**
 * Initialize integrations and show status
 */
export async function initCommand(options: { verbose?: boolean } = {}): Promise<void> {
  console.log("Initializing integration system...\n");
  
  const result = await initializeIntegrations();
  console.log(formatInitializationResult(result));
  
  if (options.verbose && result.validationResults.size > 0) {
    console.log("\nDetailed validation results:");
    result.validationResults.forEach((validation, name) => {
      console.log(`\n${name}:`);
      console.log(formatValidationResult(validation));
    });
  }
  
  if (!result.success) {
    Deno.exit(1);
  }
}

/**
 * Generate a default config file
 */
export async function generateConfigCommand(options: { force?: boolean } = {}): Promise<void> {
  const configPath = "avalon.config.ts";
  
  // Check if file already exists
  try {
    await Deno.stat(configPath);
    
    if (!options.force) {
      console.error(`Error: ${configPath} already exists. Use --force to overwrite.`);
      Deno.exit(1);
    }
  } catch {
    // File doesn't exist, proceed
  }
  
  const content = generateDefaultConfig();
  await Deno.writeTextFile(configPath, content);
  
  console.log(`✓ Generated ${configPath}`);
}

/**
 * Validate a specific integration
 */
export async function validateIntegrationCommand(name: string): Promise<void> {
  console.log(`Validating integration '${name}'...\n`);
  
  try {
    const integration = await registry.load(name);
    const result = validateIntegration(integration);
    
    console.log(formatValidationResult(result));
    
    if (!result.valid) {
      Deno.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    Deno.exit(1);
  }
}

/**
 * Show information about a specific integration
 */
export async function infoCommand(name: string): Promise<void> {
  try {
    const integration = await registry.load(name);
    const config = integration.config();
    
    console.log(`Integration: ${integration.name}`);
    console.log(`Version: ${integration.version}`);
    console.log(`\nConfiguration:`);
    console.log(`  File extensions: ${config.fileExtensions.join(", ")}`);
    
    if (config.jsxImportSources && config.jsxImportSources.length > 0) {
      console.log(`  JSX import sources: ${config.jsxImportSources.join(", ")}`);
    }
    
    console.log(`\nDetection patterns:`);
    console.log(`  Import patterns: ${config.detectionPatterns.imports.length}`);
    console.log(`  Content patterns: ${config.detectionPatterns.content.length}`);
    
    console.log(`\nMethods:`);
    console.log(`  render: ${typeof integration.render === "function" ? "✓" : "✗"}`);
    console.log(`  getHydrationScript: ${typeof integration.getHydrationScript === "function" ? "✓" : "✗"}`);
    console.log(`  config: ${typeof integration.config === "function" ? "✓" : "✗"}`);
    console.log(`  vitePlugin: ${typeof integration.vitePlugin === "function" ? "✓" : "not provided"}`);
    
    // Validate
    const validation = validateIntegration(integration);
    console.log(`\nValidation: ${validation.valid ? "✓ Valid" : "✗ Invalid"}`);
    
    if (validation.errors.length > 0) {
      console.log("\nErrors:");
      validation.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    if (validation.warnings.length > 0) {
      console.log("\nWarnings:");
      validation.warnings.forEach(warning => console.log(`  - ${warning}`));
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    Deno.exit(1);
  }
}

/**
 * Main CLI entry point
 */
export async function main(args: string[]): Promise<void> {
  const command = args[0];
  
  switch (command) {
    case "list":
      await listCommand({ verbose: args.includes("--verbose") || args.includes("-v") });
      break;
      
    case "validate":
      if (args[1]) {
        await validateIntegrationCommand(args[1]);
      } else {
        await validateCommand();
      }
      break;
      
    case "init":
      await initCommand({ verbose: args.includes("--verbose") || args.includes("-v") });
      break;
      
    case "generate-config":
      await generateConfigCommand({ force: args.includes("--force") || args.includes("-f") });
      break;
      
    case "info":
      if (!args[1]) {
        console.error("Error: Please specify an integration name");
        console.error("Usage: avalon integrations info <name>");
        Deno.exit(1);
      }
      await infoCommand(args[1]);
      break;
      
    case "help":
    case "--help":
    case "-h":
    default:
      console.log(`
Avalon Integration Management CLI

Usage:
  avalon integrations <command> [options]

Commands:
  list                    List all configured integrations
  validate [name]         Validate all integrations or a specific one
  init                    Initialize the integration system
  info <name>             Show detailed information about an integration
  generate-config         Generate a default avalon.config.ts file
  help                    Show this help message

Options:
  --verbose, -v           Show detailed output
  --force, -f             Force overwrite (for generate-config)

Examples:
  avalon integrations list
  avalon integrations validate preact
  avalon integrations info vue
  avalon integrations generate-config
      `.trim());
      break;
  }
}

// Run CLI if this is the main module
if (import.meta.main) {
  await main(Deno.args);
}
