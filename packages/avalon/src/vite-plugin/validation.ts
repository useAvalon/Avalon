/**
 * Integration Validation for Avalon Vite Plugin
 *
 * This module provides validation functions to ensure that framework integrations
 * implement the required interface correctly. Validation can be enabled via the
 * `validateIntegrations` configuration option.
 */

import { registry } from "../core/integrations/registry.ts";
import type { IntegrationName } from "./types.ts";

/**
 * Result of validating a single integration
 */
export interface ValidationResult {
	/** The integration name that was validated */
	integration: IntegrationName;
	/** Whether the integration passed all required checks */
	valid: boolean;
	/** Critical errors that prevent the integration from working */
	errors: string[];
	/** Non-critical warnings about the integration */
	warnings: string[];
}

/**
 * Result of validating all active integrations
 */
export interface ValidationSummary {
	/** Whether all integrations passed validation */
	allValid: boolean;
	/** Individual validation results for each integration */
	results: ValidationResult[];
	/** Total number of errors across all integrations */
	totalErrors: number;
	/** Total number of warnings across all integrations */
	totalWarnings: number;
}

/**
 * Validate that an integration implements the required interface
 *
 * Checks for the following required properties:
 * - name: string - Unique name of the integration
 * - version: string - Version of the integration package
 * - render: function - Server-side rendering function
 * - getHydrationScript: function - Returns hydration script for client
 * - config: function - Returns integration configuration
 *
 * Also checks optional properties if present:
 * - vitePlugin: function (if provided)
 *
 * @param integration - The integration object to validate
 * @returns ValidationResult with errors and warnings
 *
 * @example
 * ```ts
 * const result = validateIntegration(myIntegration);
 * if (!result.valid) {
 *   console.error('Integration validation failed:', result.errors);
 * }
 * ```
 */
export function validateIntegration(integration: unknown): ValidationResult {
	if (integration === null || integration === undefined) {
		return {
			integration: "unknown" as IntegrationName,
			valid: false,
			errors: ["Integration is null or undefined"],
			warnings: [],
		};
	}
	if (typeof integration !== "object") {
		return {
			integration: "unknown" as IntegrationName,
			valid: false,
			errors: [`Integration must be an object, got ${typeof integration}`],
			warnings: [],
		};
	}

	const obj = integration as Record<string, unknown>;
	const errors: string[] = [];
	const warnings: string[] = [];

	checkStringProp(obj, "name", errors);
	checkStringProp(obj, "version", errors);
	checkFunctionProp(obj, "render", errors);
	checkFunctionProp(obj, "getHydrationScript", errors);
	checkFunctionProp(obj, "config", errors);

	if (obj.vitePlugin !== undefined && typeof obj.vitePlugin !== "function") {
		warnings.push(`'vitePlugin' should be a function if provided, got ${typeof obj.vitePlugin}`);
	}

	const integrationName =
		typeof obj.name === "string" ? (obj.name as IntegrationName) : ("unknown" as IntegrationName);

	return { integration: integrationName, valid: errors.length === 0, errors, warnings };
}

function checkStringProp(obj: Record<string, unknown>, key: string, errors: string[]): void {
	const val = obj[key];
	if (typeof val !== "string") {
		errors.push(
			val === undefined
				? `Missing required '${key}' property`
				: `Invalid '${key}' property: expected string, got ${typeof val}`,
		);
	} else if (val.trim() === "") {
		errors.push(`'${key}' property cannot be empty`);
	}
}

function checkFunctionProp(obj: Record<string, unknown>, key: string, errors: string[]): void {
	if (typeof obj[key] !== "function") {
		errors.push(
			obj[key] === undefined
				? `Missing required '${key}' method`
				: `Invalid '${key}' method: expected function, got ${typeof obj[key]}`,
		);
	}
}

/**
 * Validate all active integrations in the registry
 *
 * Iterates through all integrations that have been activated and validates
 * each one against the required interface.
 *
 * @param activeIntegrations - Set of integration names that have been activated
 * @param showWarnings - Whether to include warnings in the results
 * @returns ValidationSummary with results for all integrations
 *
 * @example
 * ```ts
 * const activeIntegrations = new Set<IntegrationName>(['react', 'vue']);
 * const summary = validateActiveIntegrations(activeIntegrations, true);
 * if (!summary.allValid) {
 *   console.error(`${summary.totalErrors} validation errors found`);
 * }
 * ```
 */
export function validateActiveIntegrations(
	activeIntegrations: Set<IntegrationName>,
	showWarnings: boolean = true,
): ValidationSummary {
	const results: ValidationResult[] = [];
	let totalErrors = 0;
	let totalWarnings = 0;

	for (const name of activeIntegrations) {
		const integration = registry.get(name);

		if (!integration) {
			// Integration was marked as active but not found in registry
			results.push({
				integration: name,
				valid: false,
				errors: [`Integration '${name}' is marked as active but not found in registry`],
				warnings: [],
			});
			totalErrors++;
			continue;
		}

		const result = validateIntegration(integration);
		results.push(result);
		totalErrors += result.errors.length;
		if (showWarnings) {
			totalWarnings += result.warnings.length;
		}
	}

	return {
		allValid: totalErrors === 0,
		results,
		totalErrors,
		totalWarnings: showWarnings ? totalWarnings : 0,
	};
}

/**
 * Format validation results for console output
 *
 * @param summary - The validation summary to format
 * @returns Formatted string for console output
 */
export function formatValidationResults(summary: ValidationSummary): string {
	if (summary.allValid && summary.totalWarnings === 0) {
		return `✅ All ${summary.results.length} integration(s) passed validation`;
	}

	const lines: string[] = [];

	if (!summary.allValid) {
		lines.push(`❌ Integration validation failed with ${summary.totalErrors} error(s)`);
	}

	if (summary.totalWarnings > 0) {
		lines.push(`⚠️  ${summary.totalWarnings} warning(s) found`);
	}

	lines.push("");

	for (const result of summary.results) {
		if (result.errors.length > 0 || result.warnings.length > 0) {
			lines.push(`Integration: ${result.integration}`);

			for (const error of result.errors) {
				lines.push(`  ❌ ${error}`);
			}

			for (const warning of result.warnings) {
				lines.push(`  ⚠️  ${warning}`);
			}

			lines.push("");
		}
	}

	return lines.join("\n");
}

/**
 * Validate a single integration by name from the registry
 *
 * @param name - The integration name to validate
 * @returns ValidationResult or null if integration not found
 */
export function validateIntegrationByName(name: IntegrationName): ValidationResult | null {
	const integration = registry.get(name);

	if (!integration) {
		return null;
	}

	return validateIntegration(integration);
}
