/**
 * Security Middleware (Global)
 *
 * Applies non-CSP security headers on every Worker response (CSP is routeRules or `_headers`).
 */

import { appendResponseHeaders, getResponseHeader } from "h3";
import { defineHandler } from "nitro/h3";
import { securityHeadersWithoutCsp } from "../security-headers.ts";

export default defineHandler((event) => {
	const userAgent = event.req.headers.get("user-agent") || "Unknown";
	console.log(`🌐 ${event.req.method} ${event.url.pathname} - ${userAgent.split(" ")[0]}`);

	// CSP is set via Nitro routeRules (SSR) or Cloudflare `_headers` (static). Avoid duplicate policies.
	const headers: Record<string, string> = { ...securityHeadersWithoutCsp };
	const buildTime = process.env.AVALON_BUILD_TIME;
	if (buildTime && !getResponseHeader(event, "last-modified")) {
		headers["Last-Modified"] = new Date(buildTime).toUTCString();
	}

	appendResponseHeaders(event, headers);
	event.context.requestStartTime = Date.now();
});
