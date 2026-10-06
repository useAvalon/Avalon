export const SHARED_COUNTER_EVENT = "avalon-docs:shared-counter";

export type SharedCounterDetail = { count: number };

export function dispatchSharedCounter(count: number) {
	document.dispatchEvent(
		new CustomEvent(SHARED_COUNTER_EVENT, { detail: { count }, bubbles: true }),
	);
}
