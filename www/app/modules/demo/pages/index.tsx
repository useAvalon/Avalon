/** @jsxImportSource preact */

import LitCounter from "../components/Counter.lit.ts";
import PreactCounter from "../components/Counter.preact.tsx";
import QwikCounter from "../components/Counter.qwik.tsx";
import ReactCounter from "../components/Counter.react.tsx";
import SolidCounter from "../components/Counter.solid.tsx";
import SvelteCounter from "../components/Counter.svelte";
import VueCounter from "../components/Counter.vue";

export const metadata = {
	title: "Islands Demo — Avalon",
	description: "Demo page showing multi-framework islands with lazy loading",
};

export default async function DemoPage() {
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
					Multi-Framework Islands
				</h1>
				<p style={{ color: "#888", fontFamily: "system-ui, sans-serif", lineHeight: 1.6 }}>
					Each island loads its JavaScript only when you interact with it. Watch the network panel
					to see the lazy loading in action. All counters are SSR'd — the HTML is visible
					immediately.
				</p>
			</div>

			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
					gap: "1.5rem",
					width: "100%",
					maxWidth: "1200px",
					alignItems: "stretch",
				}}
			>
				{/* React Counter */}
				<div style={{ display: "flex", flexDirection: "column" }}>
					<ReactCounter island={{ condition: "on:interaction" }} />
				</div>

				{/* Preact Counter */}
				<div style={{ display: "flex", flexDirection: "column" }}>
					<PreactCounter island={{ condition: "on:interaction" }} />
				</div>

				{/* Vue Counter */}
				<div style={{ display: "flex", flexDirection: "column" }}>
					<VueCounter island={{ condition: "on:interaction" }} />
				</div>

				{/* Svelte Counter */}
				<div style={{ display: "flex", flexDirection: "column" }}>
					<SvelteCounter island={{ condition: "on:interaction" }} />
				</div>

				{/* Solid Counter */}
				<div style={{ display: "flex", flexDirection: "column" }}>
					<SolidCounter island={{ condition: "on:interaction" }} />
				</div>

				{/* Lit Counter */}
				<div style={{ display: "flex", flexDirection: "column" }}>
					<LitCounter island={{ condition: "on:interaction" }} />
				</div>

				{/* Qwik Counter — resumable, no island prop needed */}
				<div style={{ display: "flex", flexDirection: "column" }}>
					<QwikCounter />
				</div>
			</div>

			<p
				style={{
					color: "#666",
					fontFamily: "system-ui, sans-serif",
					fontSize: "0.85rem",
					textAlign: "center",
					maxWidth: "600px",
				}}
			>
				<strong style={{ color: "#888" }}>Tip:</strong> Click on any counter to load its JavaScript.
				The network panel shows the actual load time and file size. See also the{" "}
				<a href="/demo/data-fetching" style={{ color: "#7c8aff" }}>
					data fetching demo
				</a>
				.
			</p>
		</div>
	);
}
