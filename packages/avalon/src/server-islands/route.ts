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
 * Framework SSR integrations are registered via the import in `endpoint.ts`
 * (`virtual:server-island-integrations`).
 *
 * @module server-islands/route
 */

import { defineServerIslandHandler } from "./endpoint.ts";

const handler = defineServerIslandHandler();

export default handler;
