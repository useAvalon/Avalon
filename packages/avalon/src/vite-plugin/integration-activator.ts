/**
 * Integration Activator for Avalon Vite Plugin
 *
 * This module handles the activation of framework integrations based on
 * the plugin configuration. It validates integration names and loads
 * the appropriate integration packages.
 */

import type { IntegrationName, ResolvedAvalonConfig } from "./types.ts";
import { loadIntegration } from "../islands/integration-loader.ts";
import { IntegrationError } from "./errors.ts";

/**
 * Valid integration names that can be activated
 * This array is used for validation and error messages
 */
export const VALID_INTEGRATION_NAMES: readonly IntegrationName[] = [
  "react",
  "preact",
  "vue",
  "svelte",
  "solid",
  "lit",
  "qwik",
] as const;

/**
 * Check if a string is a valid integration name
 *
 * @param name - The name to validate
 * @returns True if the name is a valid IntegrationName
 */
export function isValidIntegrationName(name: string): name is IntegrationName {
  return VALID_INTEGRATION_NAMES.includes(name as IntegrationName);
}

/**
 * Activates the specified integrations
 *
 * Uses the existing integration loader and registry to load and activate
 * framework integrations based on the configuration.
 *
 * @param config - The resolved Avalon configuration
 * @param activeIntegrations - Set to track which integrations have been activated
 * @throws IntegrationError if an invalid integration name is provided or loading fails
 *
 * @example
 * ```ts
 * const activeIntegrations = new Set<IntegrationName>();
 * await activateIntegrations(resolvedConfig, activeIntegrations);
 * // activeIntegrations now contains all successfully loaded integrations
 * ```
 */
export async function activateIntegrations(
  config: ResolvedAvalonConfig,
  activeIntegrations: Set<IntegrationName>
): Promise<void> {
  const { integrations } = config;

  // Load explicitly specified integrations
  for (const name of integrations) {
    // Validate integration name
    if (!isValidIntegrationName(name)) {
      throw new IntegrationError(
        `Invalid integration name '${name}'. Valid integration names are: ${VALID_INTEGRATION_NAMES.join(", ")}`,
        name
      );
    }

    // Skip if already activated
    if (activeIntegrations.has(name)) {
      continue;
    }

    try {
      await loadIntegration(name);
      activeIntegrations.add(name);
    } catch (error) {
      throw new IntegrationError(
        `Failed to activate integration. Is @avalon/${name} installed?`,
        name,
        error as Error
      );
    }
  }
}

/**
 * Activate a single integration by name
 *
 * @param name - The integration name to activate
 * @param activeIntegrations - Set to track which integrations have been activated
 * @param verbose - Whether to log activation messages
 * @returns True if the integration was activated, false if already active
 * @throws IntegrationError if the name is invalid or loading fails
 */
export async function activateSingleIntegration(
  name: string,
  activeIntegrations: Set<IntegrationName>,
  _verbose: boolean = false
): Promise<boolean> {
  // Validate integration name
  if (!isValidIntegrationName(name)) {
    throw new IntegrationError(
      `Invalid integration name '${name}'. Valid integration names are: ${VALID_INTEGRATION_NAMES.join(", ")}`,
      name
    );
  }

  // Skip if already activated
  if (activeIntegrations.has(name)) {
    return false;
  }

  try {
    await loadIntegration(name);
    activeIntegrations.add(name);
    return true;
  } catch (error) {
    throw new IntegrationError(
      `Failed to activate integration. Is @avalon/${name} installed?`,
      name,
      error as Error
    );
  }
}
