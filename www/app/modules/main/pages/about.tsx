import styles from "./legal.module.css";

export const metadata = {
	title: "About Avalon",
	description:
		"What Avalon is, who builds it, and how the islands architecture helps teams ship faster.",
};

export default function AboutPage() {
	return (
		<article class={styles.article}>
			<h1>About Avalon</h1>
			<p>
				Avalon is an open-source, full-stack islands framework maintained by contributors worldwide.
				We built it so teams can mix React, Vue, Svelte, Solid, Preact, Qwik, and Lit on one site
				without shipping JavaScript to every visitor.
			</p>
			<p>
				According to our benchmarks, static regions on a typical marketing page ship zero kilobytes
				of client runtime until you opt a component into hydration. Experts in performance
				engineering often recommend partial hydration for content-heavy sites; Avalon makes that the
				default path.
			</p>
			<p>
				Another perspective: frameworks are tools, not religions. Avalon lets you keep the component
				model you already know while sharing layouts, routing, and deployment across frameworks.
			</p>
			<p>
				<a href="https://github.com/useAvalon/Avalon">View the source on GitHub</a> or{" "}
				<a href="/contact">contact the team</a>.
			</p>
		</article>
	);
}
