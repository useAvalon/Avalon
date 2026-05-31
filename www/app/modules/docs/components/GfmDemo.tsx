/** @jsxImportSource preact */
import { useState } from "preact/hooks";

interface GfmDemoProps {
	/** The raw markdown source to show in source view */
	source: string;
	/** Pre-rendered HTML to show in preview (avoids circular VNode serialization) */
	html: string;
}

export default function GfmDemo({ source, html }: Readonly<GfmDemoProps>) {
	const [showSource, setShowSource] = useState(false);

	const cellStyle = { gridArea: "1 / 1", padding: "1rem 1.25rem" };

	return (
		<div
			style={{
				border: "1px solid rgba(255,255,255,0.1)",
				borderRadius: "8px",
				overflow: "hidden",
				marginBottom: "1.5rem",
			}}
		>
			<div
				style={{
					display: "flex",
					justifyContent: "flex-end",
					padding: "0.5rem 0.75rem",
					background: "rgba(255,255,255,0.03)",
					borderBottom: "1px solid rgba(255,255,255,0.08)",
				}}
			>
				<button
					onClick={() => setShowSource((s) => !s)}
					style={{
						background: "none",
						border: "1px solid rgba(255,255,255,0.15)",
						borderRadius: "4px",
						color: "rgba(255,255,255,0.7)",
						padding: "0.25rem 0.75rem",
						fontSize: "0.8rem",
						cursor: "pointer",
					}}
				>
					{showSource ? "Preview" : "Source"}
				</button>
			</div>
			<div style={{ display: "grid" }}>
				<div style={{ ...cellStyle, visibility: showSource ? "hidden" : "visible" }}>
					<div dangerouslySetInnerHTML={{ __html: html }} />
				</div>
				<div style={{ ...cellStyle, visibility: showSource ? "visible" : "hidden" }}>
					<pre
						style={{
							margin: 0,
							whiteSpace: "pre-wrap",
							fontFamily: "monospace",
							fontSize: "0.9rem",
							color: "rgba(255,255,255,0.8)",
						}}
					>
						{source}
					</pre>
				</div>
			</div>
		</div>
	);
}
