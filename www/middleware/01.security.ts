/**
 * Security Middleware (Global)
 *
 * Applies security headers to every response (SSR, static, and API).
 */

import { appendResponseHeaders, getResponseHeader } from "h3";
import { defineHandler } from "nitro/h3";
import { securityHeaders } from "../security-headers.ts";

export default defineHandler((event) => {
	const userAgent = event.req.headers.get("user-agent") || "Unknown";
	console.log(`🌐 ${event.req.method} ${event.url.pathname} - ${userAgent.split(" ")[0]}`);

	const headers: Record<string, string> = { ...securityHeaders };
	const buildTime = process.env.AVALON_BUILD_TIME;
	if (buildTime && !getResponseHeader(event, "last-modified")) {
		headers["Last-Modified"] = new Date(buildTime).toUTCString();
	}

	appendResponseHeaders(event, headers);
	event.context.requestStartTime = Date.now();
});
