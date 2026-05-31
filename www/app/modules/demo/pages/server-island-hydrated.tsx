/** @jsxImportSource preact */

import NotificationBellReact from "../components/NotificationBell.react.tsx";
import NotificationBellSolid from "../components/NotificationBell.solid.tsx";
import NotificationBellSvelte from "../components/NotificationBell.svelte";
import NotificationBell from "../components/NotificationBell.tsx";
import NotificationBellVue from "../components/NotificationBell.vue";

export const metadata = {
	title: "Server Island + Hydration Demo",
	description: "Demo showing server islands with multiple frameworks and hydration strategies",
};

function BellSkeleton({ color = "74, 222, 128" }: { color?: string }) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: "0.75rem",
				padding: "1rem",
				borderRadius: "12px",
				background: "rgba(0,0,0,0.2)",
				border: `1px solid rgba(${color}, 0.1)`,
			}}
		>
			<div
				style={{
					width: "36px",
					height: "36px",
					borderRadius: "8px",
					background: `rgba(${color}, 0.1)`,
				}}
			/>
			<div
				style={{
					width: "100px",
					height: "0.75rem",
					borderRadius: "4px",
					background: `rgba(${color}, 0.1)`,
				}}
			/>
		</div>
	);
}

export default async function ServerIslandHydratedDemo() {
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
					Multi-Framework Server Islands
				</h1>
				<p style={{ color: "#888", fontFamily: "system-ui, sans-serif", lineHeight: 1.6 }}>
					Each NotificationBell is a different framework, server-rendered on demand, then hydrated
					on interaction (hover/click). The Preact one hydrates immediately for comparison.
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
						color: "#4ade80",
						fontFamily: "system-ui, sans-serif",
						margin: "0 0 0.5rem",
					}}
				>
					Preact (server + on:client)
				</h2>
				<p
					style={{
						color: "#666",
						fontFamily: "system-ui, sans-serif",
						fontSize: "0.85rem",
						margin: "0 0 1rem",
					}}
				>
					Hydrates immediately after server fetch.
				</p>
				<NotificationBell
					server={{ fallback: <BellSkeleton color="74, 222, 128" /> }}
					island={{ condition: "on:client" }}
					userId="preact-user"
				/>
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
						color: "#60a5fa",
						fontFamily: "system-ui, sans-serif",
						margin: "0 0 0.5rem",
					}}
				>
					Solid (server + on:interaction)
				</h2>
				<p
					style={{
						color: "#666",
						fontFamily: "system-ui, sans-serif",
						fontSize: "0.85rem",
						margin: "0 0 1rem",
					}}
				>
					Hydrates on first hover/click.
				</p>
				<NotificationBellSolid
					server={{ fallback: <BellSkeleton color="96, 165, 250" /> }}
					island={{ condition: "on:interaction" }}
					userId="solid-user"
				/>
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
						color: "#fb923c",
						fontFamily: "system-ui, sans-serif",
						margin: "0 0 0.5rem",
					}}
				>
					Svelte (server + on:interaction)
				</h2>
				<p
					style={{
						color: "#666",
						fontFamily: "system-ui, sans-serif",
						fontSize: "0.85rem",
						margin: "0 0 1rem",
					}}
				>
					Hydrates on first hover/click.
				</p>
				<NotificationBellSvelte
					server={{ fallback: <BellSkeleton color="251, 146, 60" /> }}
					island={{ condition: "on:interaction" }}
					userId="svelte-user"
				/>
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
						color: "#a78bfa",
						fontFamily: "system-ui, sans-serif",
						margin: "0 0 0.5rem",
					}}
				>
					Vue (server + on:interaction)
				</h2>
				<p
					style={{
						color: "#666",
						fontFamily: "system-ui, sans-serif",
						fontSize: "0.85rem",
						margin: "0 0 1rem",
					}}
				>
					Hydrates on first hover/click.
				</p>
				<NotificationBellVue
					server={{ fallback: <BellSkeleton color="167, 139, 250" /> }}
					island={{ condition: "on:interaction" }}
					userId="vue-user"
				/>
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
						color: "#22d3ee",
						fontFamily: "system-ui, sans-serif",
						margin: "0 0 0.5rem",
					}}
				>
					React (server + on:interaction)
				</h2>
				<p
					style={{
						color: "#666",
						fontFamily: "system-ui, sans-serif",
						fontSize: "0.85rem",
						margin: "0 0 1rem",
					}}
				>
					Hydrates on first hover/click.
				</p>
				<NotificationBellReact
					server={{ fallback: <BellSkeleton color="34, 211, 238" /> }}
					island={{ condition: "on:interaction" }}
					userId="react-user"
				/>
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
					<strong style={{ color: "#a5b4fc" }}>How to test:</strong> Each bell shows server-rendered
					HTML immediately. Hover or click a bell to trigger hydration — the component becomes
					interactive (toggle notifications, dismiss items). Check DevTools for{" "}
					<code style={{ color: "#a5b4fc", fontSize: "0.75rem" }}>data-hydrated="true"</code> after
					interaction.
				</p>
			</div>
		</div>
	);
}
