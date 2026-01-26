/**
 * Avalon Demo - Nitro Renderer Configuration
 *
 * This file configures the Nitro SSR renderer for the Avalon demo application.
 * It integrates with Avalon's existing SSR pipeline while leveraging Nitro's
 * universal deployment capabilities.
 *
 * Requirements: 2.1 - SSR Rendering Pipeline Migration
 */

import {
  createNitroRenderer,
  type RenderHandlerOptions,
} from "@avalon/avalon/nitro/renderer";
import type { AvalonRuntimeConfig } from "@avalon/avalon/nitro/types";

/**
 * Runtime configuration for the Avalon demo
 * This is populated from the Nitro runtime config
 */
export const avalonConfig: AvalonRuntimeConfig = {
  streaming: true,
  pagesDir: "src/pages",
  apiDir: "src/api",
  islandsDir: "src/islands",
};

/**
 * Renderer options for the Avalon demo
 */
export const rendererOptions: RenderHandlerOptions = {
  avalonConfig,
  isDev: import.meta.env?.DEV ?? true,
  viteServerUrl: "http://localhost:8012",
};

/**
 * The main Nitro renderer handler
 * This is exported as the default handler for Nitro to use
 */
export default createNitroRenderer(rendererOptions);
