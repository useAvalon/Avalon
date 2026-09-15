import styles from "./CodeBlock.module.css";

interface CodeBlockProps {
	filename?: string;
	/** Pre-highlighted HTML from a trusted source (server-side highlighter). Never user input. */
	children: string;
	lang?: string;
}

export default function CodeBlock({ filename, children, lang = "tsx" }: Readonly<CodeBlockProps>) {
	const safeLang = /^[a-z0-9-]+$/i.test(lang) ? lang : "text";

	return (
		<div class={styles.block}>
			<div class={styles.header}>
				<span class={styles.dots} aria-hidden="true">
					<span class={styles.dot} />
					<span class={styles.dot} />
					<span class={styles.dot} />
				</span>
				{(filename || safeLang !== "text") && (
					<span class={styles.meta}>{filename || safeLang}</span>
				)}
			</div>
			<pre class={styles.pre}>
				<code class={`hljs language-${safeLang}`} dangerouslySetInnerHTML={{ __html: children }} />
			</pre>
		</div>
	);
}
