import type { LayoutProps } from "@useavalon/avalon";

export default async function RootLayout({ children, frontmatter }: Readonly<LayoutProps>) {
	const title = typeof frontmatter?.title === "string" ? frontmatter.title : "starter";
	const description = typeof frontmatter?.description === "string" ? frontmatter.description : "";

	return (
		<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>{title}</title>
				{description ? <meta name="description" content={description} /> : null}
				<link rel="icon" href="/favicon.ico" />
				<link rel="stylesheet" href="/syntax-highlighting.css" />
			</head>
			<body>{children}</body>
		</html>
	);
}
