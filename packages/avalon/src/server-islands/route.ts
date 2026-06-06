/**
 * Server Islands Nitro Route Handler
 *
 * This file is registered as a Nitro handler by the Avalon build integration.
 * It handles requests to `/_server-islands/:componentId` by delegating to
 * the `defineServerIslandHandler` factory.
 *
 * Supports both GET and POST methods:
 * - GET: encrypted props in the `p` query parameter
 * - POST: encrypted props in the request body
 *
 * @module server-islands/route
 */

// Import the integrations virtual module to ensure framework SSR renderers are
// bundled into the Nitro server function. This triggers the side-effect of
// registering all integrations in the global registry before any request is handled.
import "virtual:server-island-integrations";
import { defineServerIslandHandler } from "./endpoint.ts";

const handler = defineServerIslandHandler();

export default handler;
