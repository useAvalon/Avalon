import preactRenderToString from "preact-render-to-string";
import type { IslandDirective } from "../types/island-prop.d.ts";
import { encrypt } from "./encryption.ts";
import type { ServerIslandProp } from "./types.ts";

/**
 * Unencrypted `dev.` payloads are only for Vite *serve* (HMR SSR), where the
 * page renderer and `/_server-islands` handler are separate module graphs
 * without a shared AES key.
 *
 * Production / prerender must AES-encrypt. Avoid reading NODE_ENV through an
 * empty-object fallback on `process.env` — Rolldown can replace that access
 * with `{}`, which made every payload use the unencrypted `dev.` form and the
 * production endpoint then rejected it (`Bad Request: decryption failed`).
 */
function shouldUseDevPayload(): boolean {
	try {
		// Vite replaces import.meta.env.DEV at compile time (true in `vite dev`).
		if (import.meta.env?.DEV === true) return true;
		if (import.meta.env?.PROD === true) return false;
	} catch {
		/* non-Vite runtime */
	}
	return false;
}

function encodeProps(serializedProps: string): string {
	if (shouldUseDevPayload()) {
		const encoded = Buffer.from(serializedProps, "utf8").toString("base64url");
		return `dev.${encoded}`;
	}
	return encrypt(serializedProps);
}

/**
 * Default fetch timeout in milliseconds for server island requests.
 */
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * URL length threshold — payloads exceeding this use POST instead of GET.
 */
const MAX_GET_URL_LENGTH = 2048;

/**
 * Instance counter for generating unique element IDs when the same
 * component is used multiple times on a page.
 */
let instanceCounter = 0;

/**
 * Serialize a server island props payload to JSON, throwing a descriptive,
 * contextual error if the props contain non-serializable values (circular
 * references, BigInt, etc.) so the failure is easy to diagnose.
 */
function safeStringifyPayload(
	payload: Record<string, unknown>,
	ctx: { componentSrc?: string; elementId: string; hasIsland: boolean },
): string {
	try {
		return JSON.stringify(payload);
	} catch (err) {
		const detail = err instanceof Error ? err.message : String(err);
		throw new Error(
			`Failed to serialize server island props (elementId=${ctx.elementId}, ` +
				`componentSrc=${ctx.componentSrc ?? "unknown"}, combinedIsland=${ctx.hasIsland}). ` +
				`Props must be JSON-serializable (no functions, circular refs, or BigInt): ${detail}`,
		);
	}
}

/**
 * Renders a server island placeholder with fallback content and an inline
 * fetch script that will request the real component HTML after page load.
 *
 * @param componentId - The hashed component ID (from manifest)
 * @param props - The component's props (excluding `server` and `island`)
 * @param serverProp - The server island configuration
 * @param islandProp - Optional island directive for combined server+client islands
 * @param componentSrc - Optional component source path (used for combined island hydration)
 * @returns Complete HTML string with wrapper element and fetch script
 */
export function renderServerIsland(
	componentId: string,
	props: Record<string, unknown>,
	serverProp: ServerIslandProp,
	islandProp?: IslandDirective,
	componentSrc?: string,
	/** The original source path of the component (used for dev-mode loading) */
	srcPath?: string,
	/** Framework identifier (preact, solid, vue, etc.) */
	framework?: string,
): string {
	// 1. Build the element ID first (needed in the payload for combined islands)
	const elementId = `si-${componentId}-${instanceCounter++}`;

	// 2. Serialize and encrypt props (include island metadata if combined island)
	const payload: Record<string, unknown> = { ...props };
	// Include the source path so the endpoint can load the component directly
	// (in dev mode, the manifest may not be populated in the endpoint's module instance)
	if (srcPath) {
		payload.__src = srcPath;
	}
	if (islandProp) {
		payload.__island = {
			condition: islandProp.condition ?? "on:client",
			conditionArg: islandProp.conditionArg,
			framework: framework ?? "preact",
			componentSrc,
			elementId,
		};
	}
	const serializedProps = safeStringifyPayload(payload, {
		componentSrc,
		elementId,
		hasIsland: !!islandProp,
	});
	const encryptedProps = encodeProps(serializedProps);

	// 3. Render fallback content to HTML string
	const fallbackHtml = serverProp.fallback ? preactRenderToString(serverProp.fallback) : "";

	// 4. Build the timeout value
	const timeout = serverProp.timeout ?? DEFAULT_TIMEOUT_MS;

	// 5. Build the endpoint path
	const endpointPath = `/_server-islands/${componentId}`;

	// 6. Generate the inline fetch script
	const fetchScript = generateFetchScript({
		elementId,
		endpointPath,
		timeout,
		islandProp,
	});

	// 7. Assemble the complete HTML
	const wrapperOpen = `<avalon-server-island id="${elementId}" data-endpoint="${escapeAttr(endpointPath)}" data-timeout="${timeout}" data-p="${escapeAttr(encryptedProps)}">`;
	const wrapperClose = `</avalon-server-island>`;

	return `${wrapperOpen}${fallbackHtml}${wrapperClose}\n${fetchScript}`;
}

/**
 * Generates the inline `<script type="module">` that fetches the server island
 * HTML after page load.
 *
 * Behavior:
 * - Uses GET when the full URL (with encrypted props) is under 2048 chars
 * - Falls back to POST for larger payloads
 * - Applies a configurable timeout (default 10s)
 * - On error or timeout, leaves the fallback content in place
 * - For combined islands, executes any hydration scripts in the response
 */
function generateFetchScript(opts: {
	elementId: string;
	endpointPath: string;
	timeout: number;
	islandProp?: IslandDirective;
}): string {
	const { elementId, endpointPath, timeout, islandProp } = opts;

	// If this is a combined island, we need to execute scripts after injection
	const hydrateSnippet = islandProp
		? `el.querySelectorAll('script[type="module"]').forEach(s=>{const n=document.createElement("script");n.type="module";n.textContent=s.textContent;s.replaceWith(n);});`
		: "";

	return `<script type="module">
(async()=>{
const el=document.getElementById("${elementId}");
if(!el||el.dataset.siStarted)return;
el.dataset.siStarted="1";
const p=el.dataset.p;
const url=(el.dataset.endpoint||"${endpointPath}")+"?p="+encodeURIComponent(p);
const ctrl=new AbortController();
const t=setTimeout(()=>ctrl.abort(),Number(el.dataset.timeout)||${timeout});
try{
const r=await fetch(...(url.length>${MAX_GET_URL_LENGTH}?[el.dataset.endpoint||"${endpointPath}",{method:"POST",body:p,headers:{"content-type":"text/plain"},signal:ctrl.signal}]:[url,{signal:ctrl.signal}]));
clearTimeout(t);
if(!r.ok)return;
const html=await r.text();
el.innerHTML=html;${hydrateSnippet ? `\n${hydrateSnippet}` : ""}
}catch(e){clearTimeout(t);}
})()
</script>`;
}

/**
 * Escapes a string for safe use inside an HTML attribute value (double-quoted).
 */
function escapeAttr(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}
