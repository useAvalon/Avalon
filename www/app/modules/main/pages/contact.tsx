import styles from "./legal.module.css";

export const metadata = {
	title: "Contact",
	description: "Get in touch with the Avalon team.",
};

export default function ContactPage() {
	return (
		<article class={styles.article}>
			<h1>Contact</h1>
			<p>
				Email us at <a href="mailto:hello@useavalon.dev">hello@useavalon.dev</a> for security
				reports, partnership questions, or documentation feedback.
			</p>
			<p>
				Community support lives on <a href="https://discord.gg/avalon">Discord</a> and{" "}
				<a href="https://github.com/useAvalon/Avalon">GitHub</a>.
			</p>
		</article>
	);
}
