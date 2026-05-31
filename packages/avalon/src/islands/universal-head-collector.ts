/**
 * Universal Head Content Collector for SSR
 *
 * Collects head content (scripts, meta tags, etc.) from framework integrations
 * during SSR and injects them into the HTML head.
 *
 * Similar to universal-css-collector.ts but for head content.
 */

interface HeadEntry {
	content: string;
	src: string;
	framework: string;
	type: "script" | "meta" | "link" | "other";
}

declare global {
	var __universalSSRHead: Map<string, HeadEntry>;
}

/**
 * Initialize the global head collector if it doesn't exist
 */
function initHeadCollector(): Map<string, HeadEntry> {
	if (!globalThis.__universalSSRHead) {
		globalThis.__universalSSRHead = new Map();
	}
	return globalThis.__universalSSRHead;
}

/**
 * Add head content to the universal collector
 *
 * @param content - The head content (script, meta tag, etc.)
 * @param src - Source component path
 * @param framework - Framework name
 * @param type - Type of head content
 */
export function addUniversalHead(
	content: string,
	src: string,
	framework: string,
	type: "script" | "meta" | "link" | "other" = "other",
): void {
	const collector = initHeadCollector();

	// Generate a unique key for this head entry
	const key = `${framework}-${src}-${type}`;

	collector.set(key, {
		content,
		src,
		framework,
		type,
	});
}

/**
 * Get all collected head content formatted for injection into HTML head
 *
 * @param clear - Whether to clear the collector after getting content
 * @returns Formatted head content string
 */
export function getUniversalHeadForInjection(clear = false): string {
	const collector = initHeadCollector();

	if (collector.size === 0) {
		return "";
	}

	const entries = Array.from(collector.values());

	// Group by type for better organization
	const scripts = entries.filter((e) => e.type === "script");
	const metas = entries.filter((e) => e.type === "meta");
	const links = entries.filter((e) => e.type === "link");
	const others = entries.filter((e) => e.type === "other");

	const parts: string[] = [];

	// Add meta tags first
	if (metas.length > 0) {
		parts.push("<!-- Framework Meta Tags -->");
		parts.push(...metas.map((e) => e.content));
	}

	// Add links
	if (links.length > 0) {
		parts.push("<!-- Framework Links -->");
		parts.push(...links.map((e) => e.content));
	}

	// Add scripts
	if (scripts.length > 0) {
		parts.push("<!-- Framework Hydration Scripts -->");
		// Wrap script content in <script> tags if not already wrapped
		parts.push(
			...scripts.map((e) => {
				const content = e.content.trim();
				// Check if already wrapped in script tags
				if (content.startsWith("<script")) {
					return content;
				}
				// Wrap in script tags
				return `<script>${content}</script>`;
			}),
		);
	}

	// Add other content
	if (others.length > 0) {
		parts.push("<!-- Framework Head Content -->");
		parts.push(...others.map((e) => e.content));
	}

	const result = parts.join("\n    ");

	if (clear) {
		collector.clear();
	}

	return result;
}

/**
 * Clear all collected head content
 */
export function clearUniversalHead(): void {
	const collector = initHeadCollector();
	collector.clear();
}

/**
 * Get the current size of the head collector
 */
export function getHeadCollectorSize(): number {
	const collector = initHeadCollector();
	return collector.size;
}

// Cache for the Solid hydration bootstrap script.
// Set by the Solid renderer via `setSolidHydrationScript`, injected
// into the page only when Solid islands are present.
declare global {
	var __solidHydrationScript: string | undefined;
}

/**
 * Store the Solid hydration bootstrap script for conditional injection.
 *
 * Called by the Solid renderer once per SSR lifecycle. The script is
 * cached globally and only injected into pages that contain Solid islands.
 *
 * @param script - The hydration script from `generateHydrationScript()`
 */
export function setSolidHydrationScript(script: string): void {
	globalThis.__solidHydrationScript = script;
}

/**
 * Conditionally inject the Solid hydration bootstrap script into HTML.
 *
 * The `window._$HY` script (~300 bytes) is only needed when Solid islands
 * are present on the page. Instead of having the Solid renderer add it to
 * the head collector on every render (which would inject it on every page),
 * this function checks the final HTML for Solid islands and injects the
 * script only when needed.
 *
 * @param html - The rendered HTML string to check and potentially modify
 * @returns The HTML with the Solid hydration script injected if needed
 */
export function injectSolidHydrationScriptIfNeeded(html: string): string {
	// Only inject if Solid islands are present on the page
	const hasSolidIslands = html.includes('data-framework="solid"');
	if (!hasSolidIslands) {
		return html;
	}

	// Don't inject if already present
	if (html.includes("window._$HY") || html.includes("_$HY=")) {
		return html;
	}

	const script = globalThis.__solidHydrationScript;
	if (!script) {
		return html;
	}

	// Wrap in <script> tags if not already wrapped
	const scriptTag = script.trim().startsWith("<script") ? script : `<script>${script}</script>`;

	if (html.includes("</head>")) {
		return html.replace("</head>", `${scriptTag}\n</head>`);
	}

	return html;
}
