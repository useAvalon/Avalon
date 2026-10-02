import { useEffect, useState } from "preact/hooks";
import { getResourceInfo, type ResourceInfo } from "../utils/resource-timing";
import styles from "./InteractiveExample.module.css";
import { NetworkPanel } from "./NetworkPanel";

export default function InteractiveExample() {
	const [count, setCount] = useState(0);
	const [hydrated, setHydrated] = useState(false);
	const [resourceInfo, setResourceInfo] = useState<ResourceInfo | null>(null);

	useEffect(() => {
		setHydrated(true);

		const timer = setTimeout(() => {
			const info = getResourceInfo("InteractiveExample");
			setResourceInfo(info || { loadTime: 12, size: "2.1 kB", sizeBytes: 2150 });
		}, 50);

		return () => clearTimeout(timer);
	}, []);

	return (
		<div class={styles.wrapper}>
			<div class={styles.header}>
				<span class={styles.label}>Live Example</span>
				<span class={styles.badge} style={{ visibility: hydrated ? "visible" : "hidden" }}>
					Interactive
				</span>
			</div>

			<div class={styles.content}>
				<div class={styles.demo}>
					<div class={styles.counter}>
						<button
							type="button"
							class={styles.btn}
							onClick={() => setCount((c) => c - 1)}
							disabled={!hydrated}
						>
							−
						</button>
						<span class={styles.count}>{count}</span>
						<button
							type="button"
							class={styles.btn}
							onClick={() => setCount((c) => c + 1)}
							disabled={!hydrated}
						>
							+
						</button>
					</div>
					{!hydrated ? (
						<div class={styles.hint}>Click anywhere to load JavaScript</div>
					) : (
						<div class={styles.hint} aria-hidden="true">
							&nbsp;
						</div>
					)}
				</div>

				<NetworkPanel
					isHydrated={hydrated}
					resourceInfo={resourceInfo}
					fileName="InteractiveExample.tsx"
				/>
			</div>
		</div>
	);
}
