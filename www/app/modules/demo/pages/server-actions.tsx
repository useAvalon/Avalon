/** @jsxImportSource preact */

import ActionsDemo from "../components/ActionsDemo.tsx";

export const metadata = {
	title: "Server Actions Demo",
	description: "Type-safe server actions with Zod validation and progressive form enhancement",
};

const sectionStyle = {
	width: "100%",
	maxWidth: "560px",
	padding: "1.5rem",
	background: "rgba(255,255,255,0.03)",
	border: "1px solid rgba(255,255,255,0.06)",
	borderRadius: "12px",
} as const;

const headingStyle = {
	fontSize: "1rem",
	color: "#a5b4fc",
	fontFamily: "system-ui, sans-serif",
	margin: "0 0 1rem",
} as const;

const inputStyle = {
	padding: "0.5rem 0.75rem",
	borderRadius: "8px",
	border: "1px solid rgba(99, 102, 241, 0.3)",
	background: "rgba(255,255,255,0.04)",
	color: "#e0e0e0",
	fontSize: "0.9rem",
	flex: 1,
} as const;

const buttonStyle = {
	padding: "0.5rem 1.25rem",
	borderRadius: "8px",
	border: "1px solid rgba(99, 102, 241, 0.4)",
	background: "rgba(99, 102, 241, 0.15)",
	color: "#a5b4fc",
	fontSize: "0.9rem",
	cursor: "pointer",
} as const;

export default async function ServerActionsDemo() {
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
					Server Actions
				</h1>
				<p style={{ color: "#888", fontFamily: "system-ui, sans-serif", lineHeight: 1.6 }}>
					Type-safe server functions defined with <code>defineAction</code>, validated with Zod, and
					callable from the client via a typed <code>actions</code> proxy that returns{" "}
					<code>{"{ data, error }"}</code>.
				</p>
			</div>

			{/* Interactive island calling actions.greet() */}
			<div style={sectionStyle}>
				<ActionsDemo island={{ condition: "on:visible" }} />
			</div>

			{/* Progressive-enhancement form posting directly to the endpoint.
			    Works without client JS — the endpoint returns JSON. */}
			<div style={sectionStyle}>
				<h2 style={headingStyle}>subscribe — progressive form (no client JS)</h2>
				<form method="POST" action="/_actions/subscribe" style={{ display: "flex", gap: "0.5rem" }}>
					<input
						style={inputStyle}
						type="email"
						name="email"
						placeholder="you@example.com"
						aria-label="Email address"
						required
					/>
					<button type="submit" style={buttonStyle}>
						Subscribe
					</button>
				</form>
				<p style={{ marginTop: "0.75rem", color: "#666", fontSize: "0.8rem" }}>
					This form posts directly to <code>/_actions/subscribe</code>. With JavaScript disabled,
					the server still validates the email and responds.
				</p>
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
					<strong style={{ color: "#a5b4fc" }}>What to verify:</strong> Type a name and click Greet
					— DevTools Network shows a <code>POST /_actions/greet</code> returning{" "}
					<code>{'{ "data": { "message": ... } }'}</code>. Clear the name to see a{" "}
					<code>BAD_REQUEST</code> validation error.
				</p>
			</div>
		</div>
	);
}
