import type { JSX } from "preact";

/**
 * Configuration for a server island component.
 *
 * When a component receives the `server` prop, it is excluded from the initial
 * page render and instead fetched on-demand from a dedicated server endpoint
 * after the page loads. This enables prerendered/cached pages to contain
 * personalized or dynamic content without sacrificing cacheability.
 */
export interface ServerIslandProp {
	/** JSX to render as placeholder until the server response arrives */
	fallback?: JSX.Element;
	/** Cache-Control header for the island endpoint response */
	cache?: string;
	/** Fetch timeout in milliseconds (default: 10000) */
	timeout?: number;
}
