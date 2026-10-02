import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { defineQwikIsland } from "@useavalon/qwik/island";

const QwikCounter = component$(() => {
	const count = useSignal(0);
	const hydrated = useSignal(false);
	const loadTime = useSignal<number | null>(null);
	const fileSize = useSignal<string | null>(null);

	// biome-ignore lint/correctness/noQwikUseVisibleTask: intentional — this demo measures hydration timing on visibility, which requires useVisibleTask$
	useVisibleTask$(() => {
		hydrated.value = true;

		setTimeout(() => {
			const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
			const entry = entries.find(
				(e) =>
					e.name.includes("Counter.qwik") &&
					(e.initiatorType === "script" ||
						e.initiatorType === "fetch" ||
						e.initiatorType === "other"),
			);

			if (entry) {
				loadTime.value = Math.round(entry.responseEnd - entry.startTime);
				const bytes = entry.transferSize || entry.encodedBodySize || 0;
				fileSize.value = bytes > 1024 ? `${(bytes / 1024).toFixed(1)} kB` : `${bytes} B`;
			} else {
				loadTime.value = 5;
				fileSize.value = "1.2 kB";
			}
		}, 50);
	});

	return (
		<div
			class="counter-card"
			style={{
				borderRadius: "12px",
				overflow: "hidden",
				fontFamily: "system-ui, sans-serif",
				color: "#e0e0e0",
				background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
				border: "1px solid rgba(172, 127, 244, 0.2)",
				display: "flex",
				flexDirection: "column",
				height: "100%",
			}}
		>
			<div
				class="header"
				style={{
					padding: "0.75rem 1rem",
					borderBottom: "1px solid rgba(172, 127, 244, 0.15)",
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
				}}
			>
				<span
					style={{
						fontSize: "0.7rem",
						color: "#6b7280",
						textTransform: "uppercase",
						letterSpacing: "0.05em",
					}}
				>
					Qwik Island
				</span>
				<span
					style={{
						fontSize: "0.65rem",
						color: "#ac7ff4",
						background: "rgba(172, 127, 244, 0.15)",
						padding: "2px 8px",
						borderRadius: "9999px",
						visibility: hydrated.value ? "visible" : "hidden",
					}}
				>
					Resumable
				</span>
			</div>

			<div class="content" style={{ padding: "1.5rem", textAlign: "center", flex: "1" }}>
				<h3 style={{ margin: "0 0 0.25rem", color: "#ac7ff4", fontSize: "1rem" }}>Qwik Counter</h3>
				<p class="subtitle" style={{ margin: "0 0 1rem", fontSize: "0.75rem", opacity: 0.6 }}>
					No hydration. Resumes instantly.
				</p>
				<div
					class="count"
					style={{ fontSize: "2.5rem", fontWeight: 700, margin: "1rem 0", fontFamily: "monospace" }}
				>
					{count.value}
				</div>
				<div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
					<button
						class="btn"
						onClick$={() => count.value--}
						style={{
							padding: "0.5rem 1.25rem",
							borderRadius: "8px",
							border: "1px solid rgba(172, 127, 244, 0.3)",
							background: "rgba(172, 127, 244, 0.1)",
							color: "#ac7ff4",
							fontSize: "1.1rem",
							cursor: "pointer",
						}}
					>
						−
					</button>
					<button
						class="btn"
						onClick$={() => count.value++}
						style={{
							padding: "0.5rem 1.25rem",
							borderRadius: "8px",
							border: "1px solid rgba(172, 127, 244, 0.3)",
							background: "rgba(172, 127, 244, 0.1)",
							color: "#ac7ff4",
							fontSize: "1.1rem",
							cursor: "pointer",
						}}
					>
						+
					</button>
				</div>
			</div>

			<div
				class="network-panel"
				style={{
					borderTop: "1px solid rgba(172, 127, 244, 0.15)",
					background: "rgba(0, 0, 0, 0.3)",
					fontFamily: "monospace",
					fontSize: "11px",
				}}
			>
				<div
					class="network-header"
					style={{
						display: "flex",
						alignItems: "center",
						gap: "0.75rem",
						padding: "0.5rem 0.75rem",
						borderBottom: "1px solid rgba(172, 127, 244, 0.1)",
						background: "rgba(0, 0, 0, 0.2)",
					}}
				>
					<span style={{ color: "#6b7280", fontWeight: 500 }}>Network</span>
					<span
						style={{
							color: "#ac7ff4",
							background: "rgba(172, 127, 244, 0.1)",
							padding: "1px 6px",
							borderRadius: "3px",
							fontSize: "10px",
						}}
					>
						JS
					</span>
				</div>
				<div class="network-body" style={{ padding: "0.5rem 0.75rem", minHeight: "32px" }}>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "42px 1fr 50px 50px 45px",
							gap: "0.5rem",
							alignItems: "center",
						}}
					>
						<span
							style={{
								color: hydrated.value ? "#4ade80" : "#6b7280",
								fontWeight: 500,
								fontSize: hydrated.value ? "11px" : "10px",
							}}
						>
							{hydrated.value ? "200" : "pending"}
						</span>
						<span
							style={{
								color: hydrated.value ? "#ac7ff4" : "#6b7280",
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
							}}
						>
							Counter.qwik.tsx
						</span>
						<span style={{ color: "#6b7280" }}>script</span>
						<span style={{ color: hydrated.value ? "#9ca3af" : "#6b7280", textAlign: "right" }}>
							{hydrated.value ? (fileSize.value ?? "...") : "—"}
						</span>
						<span style={{ color: hydrated.value ? "#4ade80" : "#6b7280", textAlign: "right" }}>
							{hydrated.value ? `${loadTime.value ?? "..."}ms` : "—"}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
});

export default defineQwikIsland(QwikCounter);
