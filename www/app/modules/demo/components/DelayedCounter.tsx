import { useState } from "preact/hooks";

export default function DelayedCounter() {
	const [count, setCount] = useState(0);

	return (
		<div
			style={{
				borderRadius: "12px",
				overflow: "hidden",
				fontFamily: "system-ui, sans-serif",
				color: "#e0e0e0",
				background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
				border: "1px solid rgba(59, 130, 246, 0.2)",
				display: "flex",
				flexDirection: "column",
				height: "100%",
			}}
		>
			<div
				style={{
					padding: "0.75rem 1rem",
					borderBottom: "1px solid rgba(59, 130, 246, 0.15)",
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
					Custom Directive
				</span>
				<span
					style={{
						fontSize: "0.65rem",
						color: "#3b82f6",
						background: "rgba(59, 130, 246, 0.15)",
						padding: "2px 8px",
						borderRadius: "9999px",
					}}
				>
					on:countdown
				</span>
			</div>
			<div style={{ padding: "1.5rem", textAlign: "center", flex: 1 }}>
				<h3 style={{ margin: "0 0 0.25rem", color: "#3b82f6", fontSize: "1rem" }}>
					Delayed Counter
				</h3>
				{/* The countdown badge is updated by the on:countdown directive script before hydration */}
				<p data-countdown style={{ margin: "0 0 1rem", fontSize: "0.75rem", color: "#f59e0b" }}>
					Hydrates in 5s...
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
							border: "1px solid rgba(59, 130, 246, 0.3)",
							background: "rgba(59, 130, 246, 0.1)",
							color: "#3b82f6",
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
							border: "1px solid rgba(59, 130, 246, 0.3)",
							background: "rgba(59, 130, 246, 0.1)",
							color: "#3b82f6",
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
