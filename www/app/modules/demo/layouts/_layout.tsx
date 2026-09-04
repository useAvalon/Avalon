/** @jsxImportSource preact */

import type { LayoutProps } from "@useavalon/avalon";
import styles from "./_layout.module.css";

const DEMO_LINKS = [
	{ href: "/demo", label: "Islands" },
	{ href: "/demo/data-fetching", label: "Data fetching" },
	{ href: "/demo/server-islands", label: "Server islands" },
	{ href: "/demo/server-island-pure", label: "Pure server island" },
	{ href: "/demo/server-island-hydrated", label: "Server + hydrate" },
	{ href: "/demo/server-actions", label: "Server actions" },
] as const;

export default function DemoLayout({ children, frontmatter }: Readonly<LayoutProps>) {
	const path = String(frontmatter?.currentPath ?? "");

	return (
		<div class={styles.shell}>
			<nav class={styles.nav} aria-label="Demo pages">
				{DEMO_LINKS.map((link) => {
					const active = path === link.href || path === `${link.href}/`;
					return (
						<a
							key={link.href}
							href={link.href}
							class={`${styles.link} ${active ? styles.linkActive : ""}`}
							aria-current={active ? "page" : undefined}
						>
							{link.label}
						</a>
					);
				})}
			</nav>
			{children}
		</div>
	);
}
