/** CSP fragments shared with `public/_headers` (keep in sync). */
export const contentSecurityPolicy =
	"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; " +
	"script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; worker-src 'self'; " +
	"style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; " +
	"connect-src 'self'; upgrade-insecure-requests";

/** Shared security headers for Nitro routeRules and static `_headers`. */
export const securityHeaders: Record<string, string> = {
	"Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
	"X-Frame-Options": "DENY",
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"Permissions-Policy": "camera=(), microphone=(), geolocation=()",
	Vary: "Accept-Encoding",
	"Content-Security-Policy": contentSecurityPolicy,
};
