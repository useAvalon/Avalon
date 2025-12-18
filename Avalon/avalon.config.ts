/**
 * Avalon Framework Configuration
 * 
 * This file configures framework integrations and other Avalon settings.
 */

export default {
  /**
   * Framework integrations to register
   * Avalon will load these integrations on startup
   */
  integrations: [
    { name: "preact", enabled: true },
    { name: "vue", enabled: true },
    { name: "solid", enabled: true },
    { name: "svelte", enabled: true },
    {name: "react", enabled: true },
    {name: "lit", enabled: true }
  ],

  /**
   * Auto-discover integrations from component usage
   * When true, Avalon will automatically load integrations
   * based on the components you use, even if not listed above
   */
  autoDiscoverIntegrations: true,

  /**
   * Validate integrations on startup
   * When true, Avalon will check that all integrations
   * implement the required interface correctly
   */
  validateIntegrations: true,

  /**
   * Show warnings for integration issues
   * When true, Avalon will log warnings for non-critical
   * integration problems
   */
  showWarnings: true,
};
