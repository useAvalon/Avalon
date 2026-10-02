import { actions } from "avalon/actions";
import { useState } from "preact/hooks";

const cardStyle = {
	borderRadius: "12px",
	fontFamily: "system-ui, sans-serif",
	color: "#e0e0e0",
	background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
	border: "1px solid rgba(99, 102, 241, 0.2)",
	padding: "1.5rem",
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

export default function ActionsDemo() {
	const [name, setName] = useState("World");
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function onSubmit(e: Event) {
		e.preventDefault();
		setPending(true);
		setError(null);
		setMessage(null);

		const { data, error } = await actions.greet({ name });
		if (error) {
			setError(`${error.code}: ${error.message}`);
		} else {
			setMessage(data.message);
		}
		setPending(false);
	}

	return (
		<div style={cardStyle}>
			<h3 style={{ margin: "0 0 1rem", color: "#a5b4fc", fontSize: "1rem" }}>
				actions.greet() — type-safe client call
			</h3>
			<form onSubmit={onSubmit} style={{ display: "flex", gap: "0.5rem" }}>
				<input
					style={inputStyle}
					value={name}
					onInput={(e) => setName((e.target as HTMLInputElement).value)}
					placeholder="Your name"
					aria-label="Your name"
				/>
				<button type="submit" style={buttonStyle} disabled={pending}>
					{pending ? "..." : "Greet"}
				</button>
			</form>
			{message && (
				<p style={{ marginTop: "1rem", color: "#34d399", fontSize: "0.9rem" }}>{message}</p>
			)}
			{error && <p style={{ marginTop: "1rem", color: "#f87171", fontSize: "0.9rem" }}>{error}</p>}
		</div>
	);
}
