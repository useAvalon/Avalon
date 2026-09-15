/** @jsxImportSource preact */

export function redirectPage(href: string, label: string) {
	return function RedirectPage() {
		return (
			<html lang="en">
				<head>
					<meta httpEquiv="refresh" content={`0;url=${href}`} />
					<link rel="canonical" href={href} />
					<title>Redirecting…</title>
				</head>
				<body>
					<p>
						This demo now lives in the docs. <a href={href}>{label}</a>
					</p>
				</body>
			</html>
		);
	};
}
