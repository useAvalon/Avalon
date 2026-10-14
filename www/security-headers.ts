/** CSP fragments shared with `public/_headers` (keep in sync). */
export const contentSecurityPolicy =
	"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; " +
	// Pagefind WASM: wasm-unsafe-eval + worker-src per https://pagefind.app/docs/hosting/
	"script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; worker-src 'self' blob:; " +
	"style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; " +
	"connect-src 'self'; upgrade-insecure-requests";

/** Headers applied on every response except CSP (see below). */
export const securityHeadersWithoutCsp: Record<string, string> = {
	"Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
	"X-Frame-Options": "DENY",
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"Permissions-Policy": "camera=(), microphone=(), geolocation=()",
	Vary: "Accept-Encoding",
};

/** Full set for SSR and API responses from the Worker (includes CSP). */
export const securityHeaders: Record<string, string> = {
	...securityHeadersWithoutCsp,
	"Content-Security-Policy": contentSecurityPolicy,
};
