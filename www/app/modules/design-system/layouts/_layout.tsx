import type { LayoutProps } from "@useavalon/avalon";
import "@shared/styles/main.css";

export const layoutConfig = {
	skipLayouts: ["_layout"],
};

export default async function DesignSystemLayout({ children }: Readonly<LayoutProps>) {
	return (
		<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>Design System</title>
				<meta
					name="description"
					content="Avalon design system — palette, gradients, patterns, tokens, and light/dark themes."
				/>
				<script
					dangerouslySetInnerHTML={{
						__html: `(function(){try{var t=localStorage.getItem('avalon-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`,
					}}
				/>
			</head>
			<body style={{ margin: 0 }}>{children}</body>
		</html>
	);
}
