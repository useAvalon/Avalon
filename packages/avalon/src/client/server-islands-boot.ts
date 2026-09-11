/**
 * Boot deferred server islands after first load or a client-navigation swap.
 *
 * Inline fetch scripts in the SSR HTML do not run when the document is swapped
 * via DOMParser. The shared runtime discovers `<avalon-server-island data-p>`
 * nodes and performs the same fetch the inline script would.
 */

const MAX_GET_URL_LENGTH = 2048;
const DEFAULT_TIMEOUT_MS = 10_000;

function endpointFor(el: HTMLElement): string | null {
	if (el.dataset.endpoint) return el.dataset.endpoint;
	const match = /^si-(.+)-(\d+)$/.exec(el.id);
	return match ? `/_server-islands/${match[1]}` : null;
}

function activateModuleScripts(root: ParentNode): void {
	const scripts = [...root.querySelectorAll('script[type="module"]')];
	for (const script of scripts) {
		if (script.getAttribute("src")) continue;
		const next = document.createElement("script");
		next.type = "module";
		next.textContent = script.textContent;
		script.replaceWith(next);
	}
}

async function fetchIslandHtml(
	el: HTMLElement,
	endpoint: string,
	signal: AbortSignal,
): Promise<string | null> {
	const payload = el.dataset.p;
	if (!payload) return null;

	const getUrl = `${endpoint}?p=${encodeURIComponent(payload)}`;
	const response =
		getUrl.length > MAX_GET_URL_LENGTH
			? await fetch(endpoint, {
					method: "POST",
					body: payload,
					headers: { "content-type": "text/plain" },
					signal,
				})
			: await fetch(getUrl, { signal });

	if (!response.ok) return null;
	return response.text();
}

/**
 * Fetch and inject every server island under `root` that has not started yet.
 * Combined islands re-execute module scripts in the injected HTML so they hydrate.
 */
export async function bootServerIslands(root: ParentNode = document): Promise<void> {
	const islands = [...root.querySelectorAll<HTMLElement>("avalon-server-island[data-p]")];
	await Promise.all(
		islands.map(async (el) => {
			if (el.dataset.siStarted) return;
			const endpoint = endpointFor(el);
			if (!endpoint) return;

			el.dataset.siStarted = "1";
			const timeout = Number(el.dataset.timeout) || DEFAULT_TIMEOUT_MS;
			const ctrl = new AbortController();
			const timer = setTimeout(() => ctrl.abort(), timeout);

			try {
				const html = await fetchIslandHtml(el, endpoint, ctrl.signal);
				clearTimeout(timer);
				if (html == null) return;
				el.innerHTML = html;
				activateModuleScripts(el);
			} catch {
				clearTimeout(timer);
			}
		}),
	);
}
