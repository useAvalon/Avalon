/**
 * Per-Island Script Generation
 *
 * Generates self-contained `<script type="module">` tags for each island,
 * eliminating the need for a shared hydration runtime. This is how Astro
 * handles island hydration — each island is fully self-contained.
 *
 * Each generated script:
 * 1. Imports the specific component module
 * 2. Imports the framework adapter (integration)
 * 3. Handles the hydration strategy (on:client, on:visible, etc.)
 * 4. Hydrates just that one island
 *
 * @module islands/per-island-script
 */

import type { HydrationCondition } from "./island.tsx";

/**
 * Escapes an already-serialized JSON string for safe embedding inside an inline
 * `<script>`. `JSON.stringify` does NOT escape `<`, `>`, `&`, or the JS line
 * terminators U+2028/U+2029, so a prop string value such as
 * `"</script><img src=x onerror=alert(1)>"` would break out of the script
 * element and inject markup. Encoding these as `\uXXXX` keeps the value a valid
 * JS expression while making tag/comment breakout impossible.
 *
 * Island props are the framework's primary channel for dynamic (often
 * request-derived) data, so this must be applied everywhere props are embedded
 * into inline script text.
 */
export function escapeJsonForScript(json: string): string {
	return json
		.replaceAll("<", String.raw`\u003c`)
		.replaceAll(">", String.raw`\u003e`)
		.replaceAll("&", String.raw`\u0026`)
		.replaceAll("\u2028", String.raw`\u2028`)
		.replaceAll("\u2029", String.raw`\u2029`);
}

export interface PerIslandScriptOptions {
	/** The island element's DOM id */
	islandId: string;
	/** Bundle path to the component module */
	componentSrc: string;
	/** Framework identifier (solid, preact, vue, etc.) */
	framework: string;
	/** Hydration condition */
	condition: HydrationCondition;
	/** Optional condition argument (e.g., delay ms for custom directives) */
	conditionArg?: string;
	/** Serialized props JSON */
	propsJson: string;
	/** Whether this is a custom directive */
	isCustomDirective?: boolean;
	/** Serialized custom directive script (if applicable) */
	directiveScript?: string;
}

/**
 * Generate an inline hydration script for a single island.
 *
 * The script is a self-contained ES module that imports the component
 * and framework adapter, then hydrates the island based on its condition.
 */
export function generatePerIslandScript(opts: PerIslandScriptOptions): string {
	const {
		islandId,
		componentSrc,
		framework,
		condition,
		conditionArg,
		propsJson,
		isCustomDirective: isCustom,
		directiveScript,
	} = opts;

	// Build the hydration call — shared across all strategies
	const hydrateCall = generateHydrateCall(islandId, componentSrc, framework, propsJson);

	// Build the strategy wrapper
	const strategyCode = generateStrategyCode(
		islandId,
		condition,
		hydrateCall,
		conditionArg,
		isCustom,
		directiveScript,
	);

	return `<script type="module">${strategyCode}</script>`;
}

/**
 * Generate the core hydration function call for an island.
 * This is the code that actually imports the component + adapter and hydrates.
 *
 * In per-island mode with code splitting, the island chunk already bundles
 * the integration loader (loadIntegrationModule), so we import it from the
 * component chunk itself rather than from a separate virtual module. This
 * eliminates the separate runtime chunk.
 */
function generateHydrateCall(
	islandId: string,
	componentSrc: string,
	framework: string,
	propsJson: string,
): string {
	// The island chunk exports __hydrateIsland (the framework's hydrate function)
	// directly, so the component and hydrate share the same framework instance.
	// This is critical for esbuild re-bundling — no duplicate module copies.
	return [
		`async function h(){`,
		`var e=document.getElementById(${JSON.stringify(islandId)});`,
		`if(!e||e.dataset.hydrated)return;`,
		// Qwik resumability: the Qwikloader handles activation automatically.
		// If a q:container is already present the component is already live — skip.
		...(framework === "qwik"
			? [
					`if(e.matches("[q\\\\:container]")||e.querySelector("[q\\\\:container]")){e.dataset.hydrated="true";return;}`,
				]
			: []),
		`try{`,
		`var p=${escapeJsonForScript(propsJson)};`,
		`var m=await import(${JSON.stringify(componentSrc)});`,
		`var C=m.default||Object.values(m).find(function(v){return typeof v==="function"&&v.prototype})||m;`,
		`var i;if(!m.__hydrateIsland&&!m.__mountIsland&&m.loadIntegrationModule){i=await m.loadIntegrationModule(${JSON.stringify(framework)})}`,
		`var fn=e.dataset.renderStrategy==="client-only"?(m.__mountIsland||(i&&i.mount)):(m.__hydrateIsland||(i&&i.hydrate));`,
		`if(!fn)throw new Error("Integration does not export "+(e.dataset.renderStrategy==="client-only"?"mount":"hydrate"));`,
		`await fn(e,C,p)`,
		`e.dataset.hydrated="true";`,
		`}catch(err){console.error("Hydration error:",err)}`,
		`}`,
	].join("");
}

/**
 * Generate the strategy wrapper that determines WHEN hydration fires.
 */
function generateStrategyCode(
	islandId: string,
	condition: HydrationCondition,
	hydrateCall: string,
	conditionArg?: string,
	isCustom?: boolean,
	directiveScript?: string,
): string {
	if (condition === "on:client") {
		// Immediate hydration — on:client means hydrate as soon as the module loads
		return `${hydrateCall}h();`;
	}

	if (condition === "on:visible") {
		// Observe firstElementChild because <avalon-island> has display:contents
		// (no layout box), so IntersectionObserver would never fire on it directly.
		return [
			hydrateCall,
			`var e=document.getElementById(${JSON.stringify(islandId)});`,
			`if(e){try{var t=e.firstElementChild||e;var o=new IntersectionObserver(function(n){`,
			`if(n[0].isIntersecting){h();o.disconnect()}`,
			`},{rootMargin:"50px",threshold:0});o.observe(t)}catch(_){h()}}`,
		].join("");
	}

	if (condition === "on:idle") {
		return [
			hydrateCall,
			`if("requestIdleCallback" in globalThis){`,
			`globalThis.requestIdleCallback(function(){h()},{timeout:5000})`,
			`}else if(document.readyState==="complete"){`,
			`setTimeout(function(){h()},200)`,
			`}else{globalThis.addEventListener("load",function(){setTimeout(function(){h()},200)},{once:true})}`,
		].join("");
	}

	if (condition === "on:interaction") {
		// Listen on firstElementChild because <avalon-island> has display:contents
		// (no layout box), so mouseenter/focusin won't fire on it directly.
		return [
			hydrateCall,
			`var e=document.getElementById(${JSON.stringify(islandId)});`,
			`if(e){var t=e.firstElementChild||e;var d=false;var ev=["click","touchstart","mouseenter","focusin"];`,
			`var fn=function(){if(d)return;d=true;ev.forEach(function(n){t.removeEventListener(n,fn)});h()};`,
			`ev.forEach(function(n){t.addEventListener(n,fn,{once:true,passive:true})})}`,
		].join("");
	}

	if (condition.startsWith("media:")) {
		const query = condition.slice(6);
		return [
			hydrateCall,
			`try{var mq=globalThis.matchMedia(${JSON.stringify(query)});`,
			`if(mq.matches){h()}else{mq.addEventListener("change",function x(ev){`,
			`if(ev.matches){h();mq.removeEventListener("change",x)}},{once:true})}}catch(_){h()}`,
		].join("");
	}

	// Custom directive
	if (isCustom && directiveScript) {
		const argCode = conditionArg ? `,${JSON.stringify(conditionArg)}` : "";
		return [
			hydrateCall,
			`var e=document.getElementById(${JSON.stringify(islandId)});`,
			`if(e){var dir=(${directiveScript});`,
			`dir(e,function(){h()}${argCode})}`,
		].join("");
	}

	// Unknown condition — hydrate immediately as fallback
	return `${hydrateCall}h();`;
}
