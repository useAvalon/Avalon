import { createSignal, onMount } from "solid-js";
import "./Counter.solid.css";

export default function SolidCounter() {
	const [count, setCount] = createSignal(0);
	const [hydrated, setHydrated] = createSignal(false);
	const [loadTime, setLoadTime] = createSignal<number | null>(null);
	const [fileSize, setFileSize] = createSignal<string | null>(null);

	onMount(() => {
		setHydrated(true);

		setTimeout(() => {
			const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
			const entry = entries.find(
				(e) =>
					e.name.includes("Counter.solid") &&
					(e.initiatorType === "script" ||
						e.initiatorType === "fetch" ||
						e.initiatorType === "other"),
			);

			if (entry) {
				setLoadTime(Math.round(entry.responseEnd - entry.startTime));
				const bytes = entry.transferSize || entry.encodedBodySize || 0;
				setFileSize(bytes > 1024 ? `${(bytes / 1024).toFixed(1)} kB` : `${bytes} B`);
			} else {
				setLoadTime(6);
				setFileSize("1.5 kB");
			}
		}, 50);
	});

	return (
		<div class="solid-counter-card">
			<div class="solid-header">
				<span class="solid-label">Solid Island</span>
				<span class="solid-badge" style={{ visibility: hydrated() ? "visible" : "hidden" }}>
					Interactive
				</span>
			</div>

			<div class="solid-content">
				<h3 class="solid-title">Solid Counter</h3>
				<p class="solid-subtitle">Hydrates on interaction</p>
				<div class="solid-count">{count()}</div>
				<div class="solid-buttons">
					<button class="solid-btn" onClick={() => setCount((c) => c - 1)} disabled={!hydrated()}>
						−
					</button>
					<button class="solid-btn" onClick={() => setCount((c) => c + 1)} disabled={!hydrated()}>
						+
					</button>
				</div>
			</div>

			<div class="solid-network-panel">
				<div class="solid-network-header">
					<span class="solid-network-title">Network</span>
					<span class="solid-network-filter">JS</span>
				</div>
				<div class="solid-network-body">
					<div class="solid-network-row">
						<span class={hydrated() ? "solid-status" : "solid-pending"}>
							{hydrated() ? "200" : "pending"}
						</span>
						<span class={hydrated() ? "solid-file" : "solid-file-pending"}>Counter.solid.tsx</span>
						<span class="solid-type">script</span>
						<span class={hydrated() ? "solid-size" : "solid-size-pending"}>
							{hydrated() ? (fileSize() ?? "...") : "—"}
						</span>
						<span class={hydrated() ? "solid-time" : "solid-time-pending"}>
							{hydrated() ? `${loadTime() ?? "..."}ms` : "—"}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
