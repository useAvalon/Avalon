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
		`try{`,
		`var p=${propsJson};`,
		`var m=await import(${JSON.stringify(componentSrc)});`,
		`var C=m.default||Object.values(m).find(function(v){return typeof v==="function"&&v.prototype})||m;`,
		`if(m.__hydrateIsland){await m.__hydrateIsland(e,C,p)}`,
		`else if(m.loadIntegrationModule){var i=await m.loadIntegrationModule(${JSON.stringify(framework)});if(i.hydrate)await i.hydrate(e,C,p)}`,
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
		// Immediate hydration, deferred to next idle/frame to avoid blocking
		return `${hydrateCall}(window.requestIdleCallback||requestAnimationFrame)(function(){h()});`;
	}

	if (condition === "on:visible") {
		return [
			hydrateCall,
			`var e=document.getElementById(${JSON.stringify(islandId)});`,
			`if(e){try{var o=new IntersectionObserver(function(n){`,
			`if(n[0].isIntersecting){h();o.disconnect()}`,
			`},{rootMargin:"50px",threshold:0});o.observe(e)}catch(_){h()}}`,
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
		return [
			hydrateCall,
			`var e=document.getElementById(${JSON.stringify(islandId)});`,
			`if(e){var d=false;var ev=["click","touchstart","mouseenter","focusin"];`,
			`var fn=function(){if(d)return;d=true;ev.forEach(function(n){e.removeEventListener(n,fn)});h()};`,
			`ev.forEach(function(n){e.addEventListener(n,fn,{once:true,passive:true})})}`,
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
		return [
			hydrateCall,
			`var e=document.getElementById(${JSON.stringify(islandId)});`,
			`if(e){var dir=(${directiveScript});`,
			`dir(e,function(){h()}${conditionArg ? `,${JSON.stringify(conditionArg)}` : ""})}`,
		].join("");
	}

	// Unknown condition — hydrate immediately as fallback
	return `${hydrateCall}h();`;
}
