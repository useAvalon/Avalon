/**
 * Selective island persistence across client navigations.
 *
 * Mark a wrapper or `<avalon-island>` with `data-router-persist="key"`.
 * Matching keys are moved (not cloned) from the old document into the new
 * one so the live framework instance survives. Qwik is skipped — its loader
 * is document-oriented.
 */

const PERSIST_SELECTOR = "[data-router-persist]";
const SKIP_FRAMEWORKS = new Set(["qwik"]);

export function persistKeyOf(el: HTMLElement): string | null {
	const raw = el.dataset.routerPersist;
	if (raw == null) return null;
	const key = raw.trim();
	return key.length > 0 ? key : null;
}

function isInsideAnotherPersist(el: Element): boolean {
	return Boolean(el.parentElement?.closest(PERSIST_SELECTOR));
}

function containsSkippedFramework(el: HTMLElement): boolean {
	if (el.dataset.framework && SKIP_FRAMEWORKS.has(el.dataset.framework)) return true;
	return Boolean(el.querySelector("[data-framework='qwik']"));
}

function topLevelPersistNodes(root: ParentNode): HTMLElement[] {
	return [...root.querySelectorAll<HTMLElement>(PERSIST_SELECTOR)].filter(
		(el) => !isInsideAnotherPersist(el) && persistKeyOf(el),
	);
}

export function hasPersistedNodes(root: ParentNode): boolean {
	return topLevelPersistNodes(root).length > 0;
}

/**
 * Detach persist nodes from `root` so a body swap does not destroy them.
 * Duplicate keys keep the first node. Nested persist nodes are ignored
 * (the outer wrapper is the unit that moves).
 */
export function extractPersisted(root: ParentNode): Map<string, HTMLElement> {
	const saved = new Map<string, HTMLElement>();
	for (const el of topLevelPersistNodes(root)) {
		const key = persistKeyOf(el);
		if (!key || saved.has(key) || containsSkippedFramework(el)) continue;
		saved.set(key, el);
		el.remove();
	}
	return saved;
}

/**
 * Replace matching stubs in the swapped document with the live nodes.
 * Returns keys that were restored; leftover saved nodes should be disposed.
 */
export function restorePersisted(root: ParentNode, saved: Map<string, HTMLElement>): Set<string> {
	const restored = new Set<string>();
	if (saved.size === 0) return restored;

	for (const stub of topLevelPersistNodes(root)) {
		const key = persistKeyOf(stub);
		if (!key) continue;
		const live = saved.get(key);
		if (!live || live === stub) continue;
		stub.replaceWith(live);
		restored.add(key);
	}
	return restored;
}

export function leftoverPersisted(
	saved: Map<string, HTMLElement>,
	restored: Set<string>,
): HTMLElement[] {
	return [...saved].filter(([key]) => !restored.has(key)).map(([, el]) => el);
}

const VT_GEOMETRY_PROPS = [
	"width",
	"height",
	"transform",
	"translate",
	"scale",
	"top",
	"left",
	"right",
	"bottom",
	"inset",
	"opacity",
] as const;

/** View Transitions can leave captured geometry on persist chrome. */
export function clearViewTransitionGeometry(root: ParentNode): void {
	for (const el of topLevelPersistNodes(root)) {
		for (const prop of VT_GEOMETRY_PROPS) {
			if (el.style.getPropertyValue(prop)) el.style.removeProperty(prop);
		}
		if (el.getAttribute("style") === "") el.removeAttribute("style");
	}
}
