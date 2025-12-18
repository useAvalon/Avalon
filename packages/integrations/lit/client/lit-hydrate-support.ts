/**
 * Lit Hydration Support
 *
 * Imports the official @lit-labs/ssr-client hydration support which patches
 * LitElement to properly hydrate server-rendered content.
 *
 * This MUST be imported before any Lit components are loaded.
 */

/// <reference lib="dom" />

// Import the official Lit hydration support module
// This patches LitElement to use hydrate() instead of render() for SSR content
import "@lit-labs/ssr-client/lit-element-hydrate-support.js";

export {};
