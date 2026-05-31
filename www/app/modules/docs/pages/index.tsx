export const layoutConfig = {
	skipLayouts: ["_layout"],
};

export default function DocsIndex() {
	return (
		<html lang="en">
			<head>
				<meta httpEquiv="refresh" content="0;url=/docs/introduction" />
				<link rel="canonical" href="/docs/introduction" />
				<title>Redirecting…</title>
			</head>
			<body>
				<p>
					Redirecting to <a href="/docs/introduction">Introduction</a>…
				</p>
			</body>
		</html>
	);
}
