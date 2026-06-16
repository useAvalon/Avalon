/**
 * Server Actions — Nitro route entry.
 *
 * Registered as the handler for `/_actions/**` by the Avalon Nitro integration.
 * It statically imports the actions manifest virtual module so the user's action
 * handlers are bundled into the Nitro server output (mirroring the server-islands
 * route — NO `@vite-ignore` dynamic imports).
 *
 * @module actions/route
 */

// Statically imported so Rolldown bundles the user's `server` export (and its
// handler closures) into the Nitro server function. The Avalon Nitro integration
// provides this module via Nitro's `virtual` option (the server bundle is a
// separate Rolldown pass that does not run Avalon's Vite plugins).
import { server } from "virtual:avalon-actions-manifest";
import { defineActionHandler } from "./endpoint.ts";
import { flattenActions } from "./registry.ts";

const registry = flattenActions(server as any);

const handler = defineActionHandler({ registry });

export default handler;
