/**
 * Re-activate inline Qwik scripts (qwikloader, qwikevents bootstrap) after a
 * client-side navigation swap.
 *
 * On a hard load the browser executes these inline scripts as part of the
 * document. During client navigation the incoming HTML is parsed by DOMParser,
 * which never executes scripts, so the qwikloader inside a Qwik island stays
 * inert and the island never resumes.
 *
 * `activateQwikLoader` finds Qwik containers (`[q:container]`) in the swapped
 * subtree and:
 *
 * 1. Evals the `q:func` script (inlined functions resume looks up by index),
 *    the `qwikevents` push snippets, and the inline qwikloader
 *    (only when it is not already installed — the loader guards itself with
 *    `document.__q_context__`). Order matters: the loader's one-time init
 *    reads `window.qwikevents` to decide which events to capture.
 * 2. For containers the already-installed loader has never seen (it only walks
 *    the DOM once, at install time), re-arms `on:qvisible` by observing those
 *    elements and dispatching `qvisible` — the same event the loader's own
 *    observer fires, captured by its document-level listener.
 */

const BOOT_MARK = "data-avalon-qwik-boot";

export interface QwikBootOptions {
	/**
	 * Executes an inline script body. Defaults to a scoped indirect eval so the
	 * script behaves as if the browser had run it. Injectable for tests.
	 */
	evalScript?: (code: string) => void;
	/**
	 * Resumes one newly inserted `[q:container]`. Defaults to dispatching
	 * `qinit` on that container and re-arming `on:qvisible` for elements the
	 * loader's install-time observer never saw. Injectable for tests.
	 */
	resumeContainer?: (container: Element) => void;
}

function isInlineScript(el: Element): el is HTMLScriptElement {
	if (el.tagName !== "SCRIPT") return false;
	if (el.getAttribute("src")) return false;
	// Qwik serializes QRLs and container state into script tags. Evaluating
	// those is not a boot step and can throw on the raw payload.
	if (el.getAttribute("type") === "qwik/json") return false;
	// `<script q:func>` has no type and assigns `document["qFuncs_<instance>"]`,
	// the inlined functions resume reads by index. The browser runs it on a
	// hard load, so it must be evaluated here too.
	const type = (el.getAttribute("type") || "").toLowerCase();
	// Qwik emits the inline qwikloader as type="module" (for execute-asap
	// semantics), but its body has no import/export, so an indirect eval runs
	// it fine. Symbol chunks always carry src and are rejected above.
	return (
		type === "" ||
		type === "module" ||
		type === "text/javascript" ||
		type === "application/javascript"
	);
}

function isQwikLoaderScript(el: Element): boolean {
	return el.getAttribute("id") === "qwikloader";
}

/** The qwikloader sets this once, on first init, and never re-inits. */
function qwikLoaderInstalled(): boolean {
	return typeof document !== "undefined" && "__q_context__" in document;
}

// CSS-escape ":" as a single backslash.
const QWIK_CONTAINER_SELECTOR = String.raw`[q\:container]`;
const QVISIBLE_SELECTOR = String.raw`[on\:qvisible]`;

function containsQwikContainer(root: ParentNode): boolean {
	if (!root) return false;
	if ("matches" in root && (root as Element).matches?.(QWIK_CONTAINER_SELECTOR)) return true;
	return root.querySelector?.(QWIK_CONTAINER_SELECTOR) !== null;
}

/**
 * Re-arm `on:qvisible` for a container the loader's install-time observer
 * never walked. Dispatching `qvisible` reaches the loader's capture listener
 * on document, which resolves the QRL exactly like its own observer does.
 */
function defaultResumeQvisible(container: Element): void {
	if (typeof IntersectionObserver === "undefined") return;

	const targets = [...container.querySelectorAll(QVISIBLE_SELECTOR)];
	if (container.matches?.(QVISIBLE_SELECTOR)) targets.unshift(container);
	if (targets.length === 0) return;

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				observer.unobserve(entry.target);
				entry.target.dispatchEvent(new CustomEvent("qvisible", { detail: entry, bubbles: true }));
			}
		},
		{ threshold: 0 },
	);
	for (const el of targets) observer.observe(el);
}

function defaultResumeContainer(container: Element): void {
	// Components may listen for document-level qinit (useOnDocument('qinit')).
	container.dispatchEvent(new Event("qinit", { bubbles: true }));
	defaultResumeQvisible(container);
}

function containersIn(root: ParentNode): Element[] {
	const found = [...(root.querySelectorAll?.(QWIK_CONTAINER_SELECTOR) ?? [])];
	if (
		"matches" in root &&
		typeof (root as Element).setAttribute === "function" &&
		(root as Element).matches?.(QWIK_CONTAINER_SELECTOR)
	) {
		found.unshift(root as Element);
	}
	return found;
}

/**
 * Resume Qwik containers under `root` (typically the swapped body).
 * Safe to call after every swap — containers already resumed are skipped.
 */
export function activateQwikLoader(
	root: ParentNode = document.body,
	options: QwikBootOptions = {},
): void {
	if (!root || !containsQwikContainer(root)) return;

	const evalScript =
		options.evalScript ??
		((code: string) => {
			// Re-evaluate Qwik's own SSR-emitted script bodies only. Indirect
			// eval runs them in global scope, matching how the browser would
			// have executed them on a hard load. No user input reaches here.
			// biome-ignore lint/security/noGlobalEval: trusted Qwik SSR output
			// biome-ignore lint/complexity/noCommaOperator: indirect (global) eval
			(0, eval)(code);
		});

	const installed = qwikLoaderInstalled();

	// qwikevents push snippets must run before the loader so its one-time init
	// sees the full event list. The loader itself is skipped when the browser
	// (or an earlier swap) already installed it — its own guard would no-op.
	const scripts = [...root.querySelectorAll("script")].filter(isInlineScript);
	const pending: string[] = [];
	for (const script of scripts) {
		if (script.hasAttribute(BOOT_MARK)) continue;
		script.setAttribute(BOOT_MARK, "1");
		if (isQwikLoaderScript(script) && installed) continue;
		const code = script.textContent ?? "";
		if (code.trim().length === 0) continue;
		if (isQwikLoaderScript(script)) {
			pending.unshift(code);
		} else {
			pending.push(code);
		}
	}
	for (const code of pending) evalScript(code);

	const resumeContainer = options.resumeContainer ?? defaultResumeContainer;
	for (const container of containersIn(root)) {
		if (container.hasAttribute(BOOT_MARK)) continue;
		container.setAttribute(BOOT_MARK, "1");
		resumeContainer(container);
	}
}
