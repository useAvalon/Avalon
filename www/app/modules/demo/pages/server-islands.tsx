/** @jsxImportSource preact */

import NotificationBell from "../components/NotificationBell.tsx";
import ServerTime from "../components/ServerTime.tsx";

export const metadata = {
	title: "Server Islands Demo — Avalon",
	description: "Demo showing server islands with fallback content",
};

function LoadingSkeleton() {
	return (
		<div class="skeleton">
			<div class="skeleton__line skeleton__line--wide" />
			<div class="skeleton__line skeleton__line--narrow" />
			<style>{`
				.skeleton {
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: 0.75rem;
					padding: 1.5rem;
					border-radius: 12px;
					background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
					border: 1px solid rgba(99, 102, 241, 0.1);
				}
				.skeleton__line {
					height: 1.25rem;
					border-radius: 4px;
					background: rgba(99, 102, 241, 0.1);
					animation: pulse 1.5s ease-in-out infinite;
				}
				.skeleton__line--wide { width: 200px; }
				.skeleton__line--narrow { width: 140px; height: 0.75rem; }
				@keyframes pulse {
					0%, 100% { opacity: 1; }
					50% { opacity: 0.4; }
				}
			`}</style>
		</div>
	);
}

function BellSkeleton() {
	return (
		<div class="bell-skeleton">
			<div class="bell-skeleton__icon" />
			<div class="bell-skeleton__line" />
			<style>{`
				.bell-skeleton {
					display: flex;
					align-items: center;
					gap: 0.75rem;
					padding: 1rem;
					border-radius: 12px;
					background: linear-gradient(135deg, #1a2e1a 0%, #162e21 100%);
					border: 1px solid rgba(74, 222, 128, 0.1);
				}
				.bell-skeleton__icon {
					width: 36px;
					height: 36px;
					border-radius: 8px;
					background: rgba(74, 222, 128, 0.1);
					animation: bell-pulse 1.5s ease-in-out infinite;
				}
				.bell-skeleton__line {
					width: 100px;
					height: 0.75rem;
					border-radius: 4px;
					background: rgba(74, 222, 128, 0.1);
					animation: bell-pulse 1.5s ease-in-out infinite;
					animation-delay: 0.2s;
				}
				@keyframes bell-pulse {
					0%, 100% { opacity: 1; }
					50% { opacity: 0.4; }
				}
			`}</style>
		</div>
	);
}

export default async function ServerIslandsDemo() {
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
					Server Islands
				</h1>
				<p
					style={{
						color: "#888",
						fontFamily: "system-ui, sans-serif",
						lineHeight: 1.6,
					}}
				>
					Server islands render on-demand after the initial page load. The page can be fully cached
					or prerendered while personalized content is fetched separately from the server. A
					fallback skeleton is shown until the server response arrives.
				</p>
			</div>

			<div
				style={{
					width: "100%",
					maxWidth: "500px",
					display: "flex",
					flexDirection: "column",
					gap: "1.5rem",
				}}
			>
				<div
					style={{
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
							margin: "0 0 0.5rem",
						}}
					>
						Pure Server Island
					</h2>
					<p
						style={{
							color: "#666",
							fontFamily: "system-ui, sans-serif",
							fontSize: "0.85rem",
							margin: "0 0 1rem",
							lineHeight: 1.5,
						}}
					>
						This component renders the current server time. It ships zero client JavaScript — the
						HTML is fetched from the server and injected into the page.
					</p>
					<ServerTime server={{ fallback: <LoadingSkeleton /> }} />
				</div>
			</div>

			<div
				style={{
					width: "100%",
					maxWidth: "500px",
					display: "flex",
					flexDirection: "column",
					gap: "1.5rem",
				}}
			>
				<div
					style={{
						padding: "1.5rem",
						background: "rgba(255,255,255,0.03)",
						border: "1px solid rgba(255,255,255,0.06)",
						borderRadius: "12px",
					}}
				>
					<h2
						style={{
							fontSize: "1rem",
							color: "#4ade80",
							fontFamily: "system-ui, sans-serif",
							margin: "0 0 0.5rem",
						}}
					>
						Combined Server + Client Island
					</h2>
					<p
						style={{
							color: "#666",
							fontFamily: "system-ui, sans-serif",
							fontSize: "0.85rem",
							margin: "0 0 1rem",
							lineHeight: 1.5,
						}}
					>
						This component is first fetched from the server (personalized notification count), then
						hydrated client-side for interactivity. Click the bell to toggle notifications and
						dismiss them individually.
					</p>
					<NotificationBell
						server={{ fallback: <BellSkeleton /> }}
						island={{ condition: "on:client" }}
						userId="demo-user-42"
					/>
				</div>
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
					<strong style={{ color: "#a5b4fc" }}>How it works:</strong> During the initial page
					render, the server island is replaced with the fallback skeleton. An inline script then
					fetches the component's HTML from{" "}
					<code style={{ color: "#a5b4fc", fontSize: "0.75rem" }}>
						/_server-islands/&#123;id&#125;
					</code>{" "}
					and swaps it in. Props are encrypted so the client cannot tamper with them. For combined
					islands, the response also includes a hydration script that makes the component
					interactive after injection.
				</p>
			</div>
		</div>
	);
}
