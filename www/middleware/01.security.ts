/**
 * Security Middleware (Global)
 *
 * Applies security headers to every response (SSR, static, and API).
 */

import { appendResponseHeaders } from "h3";
import { defineHandler } from "nitro/h3";
import { securityHeaders } from "../security-headers.ts";

export default defineHandler((event) => {
	const userAgent = event.req.headers.get("user-agent") || "Unknown";
	console.log(`🌐 ${event.req.method} ${event.url.pathname} - ${userAgent.split(" ")[0]}`);

	appendResponseHeaders(event, securityHeaders);
	event.context.requestStartTime = Date.now();
});
