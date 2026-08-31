/**
 * Dev CSS HMR is owned by Avalon, not Vite's link rewriter or Nitro's
 * document reload.
 *
 * Pipeline:
 * 1. SSR injects `<link rel="stylesheet" href="…?direct">`.
 * 2. `hotUpdate` returns [] so Vite does not css-update and Nitro does not
 *    treat SSR-only CSS as a document reload.
 * 3. Hard-invalidate the file (and `?direct`) in every environment, then
 *    transform with `?direct&v=` — Vite strips `t=<13 digits>`.
 * 4. Send `{ href, css }` on the client hot channel. The client writes `css`
 *    into a `<style data-avalon-css>` tag (does not refetch the link).
 */

import { relative } from "node:path";
import type { ModuleNode, Plugin, ViteDevServer } from "vite";
import { readDirectCss } from "../render/collect-css.ts";

const CSS_FILE_RE = /\.(css|scss|sass|less|styl|stylus)$/;

export function isCssHotFile(file: string): boolean {
	return CSS_FILE_RE.test(file.split("?")[0] ?? file);
}

export function fileToDevHref(root: string, file: string): string {
	const rel = relative(root, file).replaceAll("\\", "/");
	return rel.startsWith("/") ? rel : `/${rel}`;
}

export function isBrowserFullReloadPayload(payload: unknown): boolean {
	if (!payload || typeof payload !== "object") return false;
	return (payload as { type?: string }).type === "full-reload";
}

function reloadPathField(payload: object): string {
	const path = (payload as { path?: unknown }).path;
	return typeof path === "string" ? path : "";
}

function reloadTriggeredBy(payload: object): string {
	const triggeredBy = (payload as { triggeredBy?: unknown }).triggeredBy;
	return typeof triggeredBy === "string" ? triggeredBy : "";
}

/**
 * Drop only the document reload that is correlated with this CSS save.
 * Unrelated JS / HTML / config reloads in the same 250 ms window still pass.
 */
export function isCssCorrelatedReload(payload: unknown): boolean {
	if (!payload || typeof payload !== "object") return false;
	const triggeredBy = reloadTriggeredBy(payload);
	if (triggeredBy) return isCssHotFile(triggeredBy);
	const path = reloadPathField(payload);
	if (!path || path === "*") return true;
	return isCssHotFile(path);
}

/** Drop a document reload that Nitro emits for server-only CSS modules. */
export function shouldDropCssFullReload(cssSaveInFlight: boolean, payload: unknown): boolean {
	return cssSaveInFlight && isBrowserFullReloadPayload(payload) && isCssCorrelatedReload(payload);
}

/**
 * One in-flight CSS push per file. A save while that push is running is
 * marked pending; when the active push settles, one follow-up runs for
 * the latest CSS.
 */
export function scheduleCssPush(
	file: string,
	pushing: Set<string>,
	pending: Set<string>,
	run: (file: string) => Promise<void>,
): void {
	if (pushing.has(file)) {
		pending.add(file);
		return;
	}
	pushing.add(file);
	void run(file).finally(() => {
		pushing.delete(file);
		if (!pending.has(file)) return;
		pending.delete(file);
		scheduleCssPush(file, pushing, pending, run);
	});
}

/** Standalone client listener. Nitro HTML never runs `transformIndexHtml`. */
export function generateDevCssHmrModule(): string {
	return [
		`if (import.meta.hot) {`,
		`  import.meta.hot.on('avalon:css', function (data) {`,
		`    if (!data || typeof data.href !== 'string') return;`,
		`    var href = data.href.split('?')[0];`,
		`    var id = href.charAt(0) === '/' ? href : '/' + href;`,
		`    var css = typeof data.css === 'string' ? data.css : '';`,
		`    var links = document.querySelectorAll('link[data-avalon-css]');`,
		`    for (var i = 0; i < links.length; i++) {`,
		`      if (links[i].getAttribute('data-avalon-css') === id) {`,
		`        links[i].href = id + '?direct&v=' + Date.now();`,
		`      }`,
		`    }`,
		`    if (!css || css.indexOf('__vite__updateStyle') !== -1 || css.indexOf('import.meta.hot') !== -1) return;`,
		`    var style;`,
		`    var nodes = document.querySelectorAll('style[data-avalon-css]');`,
		`    for (var j = 0; j < nodes.length; j++) {`,
		`      if (nodes[j].getAttribute('data-avalon-css') === id) { style = nodes[j]; break; }`,
		`    }`,
		`    if (!style) {`,
		`      style = document.createElement('style');`,
		`      style.setAttribute('type', 'text/css');`,
		`      style.setAttribute('data-avalon-css', id);`,
		`      document.head.appendChild(style);`,
		`    }`,
		`    style.textContent = css;`,
		`  });`,
		`}`,
		``,
	].join("\n");
}

export function createDevCssHmrPlugin(): Plugin {
	let cssSaveInFlight = false;
	let clearTimer: ReturnType<typeof setTimeout> | undefined;
	const pushing = new Set<string>();
	const pending = new Set<string>();

	const markCssSave = (): void => {
		cssSaveInFlight = true;
		if (clearTimer !== undefined) clearTimeout(clearTimer);
		clearTimer = setTimeout(() => {
			cssSaveInFlight = false;
			clearTimer = undefined;
		}, 250);
	};

	return {
		name: "avalon:dev-css-hmr",
		apply: "serve",
		enforce: "pre",
		applyToEnvironment: () => true,
		configureServer(server) {
			return () => {
				const send: typeof server.ws.send = server.ws.send.bind(server.ws);
				server.ws.send = ((...args: Parameters<typeof send>) => {
					if (shouldDropCssFullReload(cssSaveInFlight, args[0])) return;
					return send(...args);
				}) as typeof send;
			};
		},
		hotUpdate({ file, server }) {
			if (!isCssHotFile(file)) return;
			markCssSave();
			scheduleCssPush(file, pushing, pending, (saved) => pushCssToClient(server, saved));
			return [];
		},
	};
}

type GraphWithUrlMap = {
	getModulesByFile?: (file: string) => Set<ModuleNode> | undefined;
	getModuleById?: (id: string) => ModuleNode | undefined;
	invalidateModule: (mod: ModuleNode) => void;
	urlToModuleMap?: Map<string, ModuleNode>;
};

function collectCssGraphModules(
	graph: GraphWithUrlMap,
	file: string,
	extraUrls: string[],
): Set<ModuleNode> {
	const mods = new Set<ModuleNode>(graph.getModulesByFile?.(file) ?? []);
	for (const url of extraUrls) {
		const byId = graph.getModuleById?.(url);
		if (byId) mods.add(byId);
		const byUrl = graph.urlToModuleMap?.get(url);
		if (byUrl) mods.add(byUrl);
	}
	return mods;
}

function clearPendingCssRequests(
	env: { _pendingRequests?: Map<string, unknown> },
	extraUrls: string[],
): void {
	const pending = env._pendingRequests;
	if (!pending) return;
	for (const url of extraUrls) pending.delete(url);
}

export function invalidateCssFile(server: ViteDevServer, file: string): void {
	const href = server.config?.root ? fileToDevHref(server.config.root, file) : "";
	const extraUrls = href ? [href, `${href}?direct`] : [];

	for (const env of Object.values(server.environments ?? {})) {
		const graph = env.moduleGraph as unknown as GraphWithUrlMap;
		for (const mod of collectCssGraphModules(graph, file, extraUrls)) {
			graph.invalidateModule(mod);
		}
		clearPendingCssRequests(
			env as unknown as { _pendingRequests?: Map<string, unknown> },
			extraUrls,
		);
	}
}

type HotSender = { send: (payload: { type: "custom"; event: string; data: unknown }) => void };

export function cssHotPayload(
	href: string,
	css: string,
): { type: "custom"; event: "avalon:css"; data: { href: string; css: string } } {
	return { type: "custom", event: "avalon:css", data: { href, css } };
}

function sendCssHot(server: ViteDevServer, href: string, css: string): void {
	const payload = cssHotPayload(href, css);
	const sent = new Set<HotSender>();
	const send = (channel: HotSender | undefined): void => {
		if (!channel || sent.has(channel)) return;
		sent.add(channel);
		channel.send(payload);
	};
	send(server.ws);
	send(server.environments?.client?.hot);
}

async function pushCssToClient(server: ViteDevServer, file: string): Promise<void> {
	invalidateCssFile(server, file);
	const href = fileToDevHref(server.config.root, file);
	const css = await readDirectCss(server, href);
	sendCssHot(server, href, css);
	server.config.logger.info(`css hmr ${href} (${css.length}b)`, { timestamp: true });
}
