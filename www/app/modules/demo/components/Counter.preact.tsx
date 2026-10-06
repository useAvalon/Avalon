import { getResourceInfo, type ResourceInfo } from "@shared/utils/resource-timing";
import { useEffect, useState } from "preact/hooks";
import "./Counter.preact.css";

export default function PreactCounter() {
	const [count, setCount] = useState(0);
	const [hydrated, setHydrated] = useState(false);
	const [resourceInfo, setResourceInfo] = useState<ResourceInfo | null>(null);

	useEffect(() => {
		setHydrated(true);

		const timer = setTimeout(() => {
			const info = getResourceInfo("Counter.preact");
			setResourceInfo(info || { loadTime: 8, size: "1.8 kB", sizeBytes: 1843 });
		}, 50);

		return () => clearTimeout(timer);
	}, []);

	return (
		<div class="counter-card preact">
			<div class="header">
				<span class="label">Preact Island</span>
				<span class="badge" style={{ visibility: hydrated ? "visible" : "hidden" }}>
					Interactive
				</span>
			</div>

			<div class="content">
				<h3 class="title">Preact Counter</h3>
				<p class="subtitle">Hydrates on interaction</p>
				<div class="count">{count}</div>
				<div class="buttons">
					<button
						type="button"
						class="btn"
						onClick={() => setCount((c) => c - 1)}
						disabled={!hydrated}
					>
						−
					</button>
					<button
						type="button"
						class="btn"
						onClick={() => setCount((c) => c + 1)}
						disabled={!hydrated}
					>
						+
					</button>
				</div>
			</div>

			<div class="network-panel">
				<div class="network-header">
					<span class="network-title">Network</span>
					<span class="network-filter">JS</span>
				</div>
				<div class="network-body">
					<div class="network-row">
						<span class={hydrated ? "status" : "pending"}>{hydrated ? "200" : "pending"}</span>
						<span class={hydrated ? "file" : "file-pending"}>Counter.preact.tsx</span>
						<span class="type">script</span>
						<span class={hydrated ? "size" : "size-pending"}>
							{hydrated ? (resourceInfo?.size ?? "...") : "—"}
						</span>
						<span class={hydrated ? "time" : "time-pending"}>
							{hydrated ? `${resourceInfo?.loadTime ?? "..."}ms` : "—"}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
