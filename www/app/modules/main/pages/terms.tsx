import styles from "./legal.module.css";

export const metadata = {
	title: "Terms of Service",
	description: "Terms for using the useavalon.dev website and documentation.",
};

export default function TermsPage() {
	return (
		<article class={styles.article}>
			<h1>Terms of Service</h1>
			<p>Last updated: October 13, 2026.</p>
			<p>
				By using useavalon.dev you agree to use the site for lawful purposes. Documentation and
				examples are provided &quot;as is&quot; without warranty.
			</p>
			<p>
				The Avalon framework itself is released under the MIT License. Third-party trademarks belong
				to their respective owners.
			</p>
			<p>
				Contact: <a href="mailto:hello@useavalon.dev">hello@useavalon.dev</a>.
			</p>
		</article>
	);
}
