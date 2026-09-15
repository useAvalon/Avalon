/**
 * View Transitions around the client-navigation DOM swap.
 *
 * On by default when the API exists. `false` skips the animation; a string
 * names it for CSS (`html[data-router-transition]` and, where supported,
 * `startViewTransition({ types })`). Reduced motion always skips the API.
 *
 * Only one transition may be active. A new navigation skips the in-flight
 * one so `startViewTransition` is not called in an invalid state.
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

type ViewTransitionLike = {
	finished: Promise<void>;
	skipTransition?: () => void;
};

type StartViewTransition = (
	callbackOrOptions:
		| (() => void | Promise<void>)
		| { update?: () => void | Promise<void>; types?: string[] },
) => ViewTransitionLike;

let inFlight: ViewTransitionLike | null = null;
let startLocked = false;
const startWaiters: Array<() => void> = [];

function acquireStart(): Promise<void> | undefined {
	if (!startLocked) {
		startLocked = true;
		return undefined;
	}
	return new Promise<void>((resolve) => {
		startWaiters.push(() => {
			startLocked = true;
			resolve();
		});
	});
}

function releaseStart(): void {
	const next = startWaiters.shift();
	if (next) {
		next();
		return;
	}
	startLocked = false;
}

function takeInFlight(): ViewTransitionLike | null {
	const current = inFlight;
	if (!current) return null;
	inFlight = null;
	try {
		current.skipTransition?.();
	} catch {
		// Already finished or not skippable.
	}
	return current;
}

/** Abort the active view transition so a newer navigation can swap. */
export function skipInFlightViewTransition(): void {
	const current = takeInFlight();
	if (!current) return;
	void current.finished.catch(() => {
		// InvalidStateError from skipTransition must not become unhandled.
	});
}

function settleInFlight(): Promise<void> | undefined {
	const current = takeInFlight();
	if (!current) return undefined;
	return current.finished.catch(() => {
		// Aborted transitions reject with InvalidStateError.
	});
}

function startDocumentViewTransition(
	update: () => Promise<void>,
	type?: string,
): ViewTransitionLike | undefined {
	const doc = document as Document & { startViewTransition?: StartViewTransition };
	const start = doc.startViewTransition?.bind(doc);
	if (!start) return undefined;
	try {
		if (type) {
			try {
				return start({ update, types: [type] });
			} catch {
				// Older browsers only accept the callback form.
			}
		}
		return start(update);
	} catch {
		// Another transition is still active; swap without the API.
		return undefined;
	}
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

	const acquired = acquireStart();
	if (acquired) await acquired;

	let transition: ViewTransitionLike | undefined;
	try {
		const settling = settleInFlight();
		if (settling) await settling;
		transition = startDocumentViewTransition(runOnce, type);
		if (transition) {
			inFlight = transition;
			void transition.finished.catch(() => {
				// skipTransition rejects finished; the await below handles it.
			});
		}
	} finally {
		releaseStart();
	}

	try {
		if (!transition) {
			await runOnce();
			return;
		}
		try {
			await transition.finished;
		} catch {
			await runOnce();
		} finally {
			if (inFlight === transition) inFlight = null;
		}
	} catch {
		await runOnce();
	} finally {
		if (type) {
			if (previousType === undefined) delete root.dataset.routerTransition;
			else root.dataset.routerTransition = previousType;
		}
	}
}
