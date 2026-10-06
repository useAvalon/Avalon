import { useEffect, useState } from "preact/hooks";
import {
	dispatchSharedCounter,
	SHARED_COUNTER_EVENT,
	type SharedCounterDetail,
} from "../lib/shared-counter-events.ts";
import "./Counter.preact.css";

export default function SharedCounterPreact() {
	const [count, setCount] = useState(0);

	useEffect(() => {
		const onSync = (event: Event) => {
			const detail = (event as CustomEvent<SharedCounterDetail>).detail;
			setCount(detail.count);
		};
		document.addEventListener(SHARED_COUNTER_EVENT, onSync);
		return () => document.removeEventListener(SHARED_COUNTER_EVENT, onSync);
	}, []);

	function bump(delta: number) {
		setCount((current) => {
			const next = current + delta;
			dispatchSharedCounter(next);
			return next;
		});
	}

	return (
		<div class="counter-card preact">
			<div class="header">
				<span class="label">Preact Island</span>
				<span class="badge">CustomEvent</span>
			</div>
			<div class="content">
				<h3 class="title">Shared counter</h3>
				<p class="subtitle">Separate bundle, same count</p>
				<div class="count" aria-live="polite">
					{count}
				</div>
				<div class="buttons">
					<button type="button" class="btn" onClick={() => bump(-1)} aria-label="Decrement">
						−
					</button>
					<button type="button" class="btn" onClick={() => bump(1)} aria-label="Increment">
						+
					</button>
				</div>
			</div>
		</div>
	);
}
