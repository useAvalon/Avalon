/** @jsxImportSource preact */

import ServerTime from "../components/ServerTime.tsx";

export const metadata = {
	title: "Pure Server Island Demo",
	description: "Demo showing a server island with fallback — zero client JavaScript",
};

function LoadingSkeleton() {
	return (
		<div class="si-skeleton">
			<div class="si-skeleton__line si-skeleton__line--wide" />
			<div class="si-skeleton__line si-skeleton__line--narrow" />
			<style>{`
				.si-skeleton {
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: 0.75rem;
					padding: 1.5rem;
					border-radius: 12px;
					background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
					border: 1px solid rgba(99, 102, 241, 0.1);
				}
				.si-skeleton__line {
					height: 1.25rem;
					border-radius: 4px;
					background: rgba(99, 102, 241, 0.1);
					animation: si-pulse 1.5s ease-in-out infinite;
				}
				.si-skeleton__line--wide { width: 200px; }
				.si-skeleton__line--narrow { width: 140px; height: 0.75rem; }
				@keyframes si-pulse {
					0%, 100% { opacity: 1; }
					50% { opacity: 0.4; }
				}
			`}</style>
		</div>
	);
}

export default async function PureServerIslandDemo() {
	return (
		<div
			style={{
				minHeight: "80vh",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				padding: "3rem 2rem",
				gap: "2rem",
			}}
		>
			<div style={{ textAlign: "center", maxWidth: "700px" }}>
				<h1
					style={{
						fontSize: "2rem",
						color: "#e0e0e0",
						fontFamily: "system-ui, sans-serif",
						marginBottom: "0.5rem",
					}}
				>
					Pure Server Island
				</h1>
				<p style={{ color: "#888", fontFamily: "system-ui, sans-serif", lineHeight: 1.6 }}>
					This page tests a server island with no client hydration. The component renders the
					current server time on-demand — the page itself can be fully cached while this one
					component is fetched fresh from the server after load.
				</p>
			</div>

			<div
				style={{
					width: "100%",
					maxWidth: "500px",
					padding: "1.5rem",
					background: "rgba(255,255,255,0.03)",
					border: "1px solid rgba(255,255,255,0.06)",
					borderRadius: "12px",
				}}
			>
				<h2
					style={{
						fontSize: "1rem",
						color: "#a5b4fc",
						fontFamily: "system-ui, sans-serif",
						margin: "0 0 1rem",
					}}
				>
					ServerTime (server only)
				</h2>
				<ServerTime server={{ fallback: <LoadingSkeleton /> }} />
			</div>

			<div
				style={{
					width: "100%",
					maxWidth: "500px",
					padding: "1.5rem",
					background: "rgba(255,255,255,0.03)",
					border: "1px solid rgba(255,255,255,0.06)",
					borderRadius: "12px",
				}}
			>
				<h2
					style={{
						fontSize: "1rem",
						color: "#a5b4fc",
						fontFamily: "system-ui, sans-serif",
						margin: "0 0 1rem",
					}}
				>
					ServerTime with custom timeout (5s)
				</h2>
				<ServerTime server={{ fallback: <LoadingSkeleton />, timeout: 5000 }} />
			</div>

			<div
				style={{
					maxWidth: "600px",
					padding: "1rem 1.25rem",
					background: "rgba(99, 102, 241, 0.05)",
					border: "1px solid rgba(99, 102, 241, 0.15)",
					borderRadius: "8px",
				}}
			>
				<p
					style={{
						color: "#888",
						fontFamily: "system-ui, sans-serif",
						fontSize: "0.8rem",
						margin: 0,
						lineHeight: 1.6,
					}}
				>
					<strong style={{ color: "#a5b4fc" }}>What to verify:</strong> Open DevTools Network tab.
					You should see a request to{" "}
					<code style={{ color: "#a5b4fc", fontSize: "0.75rem" }}>/_server-islands/...</code> after
					page load. The skeleton should appear briefly, then be replaced by the server time. No
					JavaScript bundle is loaded for this component — it's pure HTML injection.
				</p>
			</div>
		</div>
	);
}
