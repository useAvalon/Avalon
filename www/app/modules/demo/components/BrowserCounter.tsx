import { useState } from "preact/hooks";

/**
 * Reads `window` during render. This would throw during SSR;
 * the page mounts it with `island={{ clientOnly: true }}`.
 */
export default function BrowserCounter() {
	const width = window.innerWidth;
	const [count, setCount] = useState(0);

	return (
		<div
			style={{
				borderRadius: "12px",
				overflow: "hidden",
				fontFamily: "system-ui, sans-serif",
				color: "#e0e0e0",
				background: "linear-gradient(135deg, #2a1f12 0%, #2e2116 100%)",
				border: "1px solid rgba(245, 158, 11, 0.25)",
				display: "flex",
				flexDirection: "column",
				height: "100%",
			}}
		>
			<div
				style={{
					padding: "0.75rem 1rem",
					borderBottom: "1px solid rgba(245, 158, 11, 0.15)",
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
					Client-only Island
				</span>
				<span
					style={{
						fontSize: "0.65rem",
						color: "#f59e0b",
						background: "rgba(245, 158, 11, 0.15)",
						padding: "2px 8px",
						borderRadius: "9999px",
					}}
				>
					mounted
				</span>
			</div>
			<div style={{ padding: "1.5rem", textAlign: "center", flex: 1 }}>
				<h3 style={{ margin: "0 0 0.25rem", color: "#f59e0b", fontSize: "1rem" }}>
					Browser Counter
				</h3>
				<p style={{ margin: "0 0 1rem", fontSize: "0.75rem", opacity: 0.6 }}>
					No SSR — viewport {width}px
				</p>
				<div
					style={{ fontSize: "2.5rem", fontWeight: 700, margin: "1rem 0", fontFamily: "monospace" }}
				>
					{count}
				</div>
				<div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
					<button
						type="button"
						onClick={() => setCount((c) => c - 1)}
						style={{
							padding: "0.5rem 1.25rem",
							borderRadius: "8px",
							border: "1px solid rgba(245, 158, 11, 0.3)",
							background: "rgba(245, 158, 11, 0.1)",
							color: "#f59e0b",
							fontSize: "1.1rem",
							cursor: "pointer",
						}}
					>
						−
					</button>
					<button
						type="button"
						onClick={() => setCount((c) => c + 1)}
						style={{
							padding: "0.5rem 1.25rem",
							borderRadius: "8px",
							border: "1px solid rgba(245, 158, 11, 0.3)",
							background: "rgba(245, 158, 11, 0.1)",
							color: "#f59e0b",
							fontSize: "1.1rem",
							cursor: "pointer",
						}}
					>
						+
					</button>
				</div>
			</div>
		</div>
	);
}
