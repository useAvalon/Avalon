/**
 * View Transitions around the client-navigation DOM swap.
 *
 * On by default when the API exists. `false` skips the animation; a string
 * names it for CSS (`html[data-router-transition]` and, where supported,
 * `startViewTransition({ types })`). Reduced motion always skips the API.
 */

export type ViewTransitionMode = boolean | string;

export interface ResolvedViewTransition {
	enabled: boolean;
	type?: string;
}

export function prefersReducedMotion(): boolean {
	return Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

/** `data-router-transition` on a link, form, or submitter. Absent → default. */
export function viewTransitionFromDataset(raw: string | undefined): ViewTransitionMode | undefined {
	if (raw == null || raw === "") return undefined;
	if (raw === "false") return false;
	if (raw === "true") return true;
	return raw;
}

export function resolveViewTransition(mode?: ViewTransitionMode): ResolvedViewTransition {
	if (mode === false || mode === "false") return { enabled: false };
	if (typeof mode === "string" && mode !== "" && mode !== "true") {
		return { enabled: true, type: mode };
	}
	return { enabled: true };
}

type ViewTransitionLike = { finished: Promise<void> };

type StartViewTransition = (
	callbackOrOptions:
		| (() => void | Promise<void>)
		| { update?: () => void | Promise<void>; types?: string[] },
) => ViewTransitionLike;

function startDocumentViewTransition(
	update: () => Promise<void>,
	type?: string,
): ViewTransitionLike | undefined {
	const doc = document as Document & { startViewTransition?: StartViewTransition };
	const start = doc.startViewTransition?.bind(doc);
	if (!start) return undefined;
	if (type) {
		try {
			return start({ update, types: [type] });
		} catch {
			// Older browsers only accept the callback form.
		}
	}
	return start(update);
}

export async function withViewTransition(
	update: () => void | Promise<void>,
	mode?: ViewTransitionMode,
): Promise<void> {
	const { enabled, type } = resolveViewTransition(mode);
	if (!enabled || prefersReducedMotion()) {
		await update();
		return;
	}

	let ran = false;
	const runOnce = async () => {
		if (ran) return;
		ran = true;
		await update();
	};

	const root = document.documentElement;
	const previousType = type ? root.dataset.routerTransition : undefined;
	if (type) root.dataset.routerTransition = type;

	try {
		const transition = startDocumentViewTransition(runOnce, type);
		if (!transition) {
			await runOnce();
			return;
		}
		await transition.finished;
	} catch {
		await runOnce();
	} finally {
		if (type) {
			if (previousType === undefined) delete root.dataset.routerTransition;
			else root.dataset.routerTransition = previousType;
		}
	}
}
