import type { ComponentChildren } from "preact";
import styles from "./DocsLive.module.css";

type FrameProps = {
	label: string;
	children: ComponentChildren;
	variant?: "grid" | "stack";
	compact?: boolean;
};

/**
 * Presentational chrome only. Island and server props must stay on the
 * importing page or MDX file so Avalon's transforms can rewrite them.
 */
export default function DocsLiveFrame({ label, children, variant, compact }: Readonly<FrameProps>) {
	const bodyClass = [styles.body, variant ? styles[variant] : "", compact ? styles.compact : ""]
		.filter(Boolean)
		.join(" ");
	return (
		<div class={styles.frame}>
			<p class={styles.label}>{label}</p>
			<div class={bodyClass}>{children}</div>
		</div>
	);
}

type RowProps = {
	caption: string;
	children: ComponentChildren;
};

export function DocsLiveRow({ caption, children }: Readonly<RowProps>) {
	return (
		<div class={styles.row}>
			<p class={styles.caption}>{caption}</p>
			{children}
		</div>
	);
}
