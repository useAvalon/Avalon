import styles from "./legal.module.css";

export const metadata = {
	title: "Privacy Policy",
	description: "How useavalon.dev handles analytics, logs, and visitor data.",
};

export default function PrivacyPage() {
	return (
		<article class={styles.article}>
			<h1>Privacy Policy</h1>
			<p>Last updated: October 13, 2026.</p>
			<p>
				useavalon.dev is a documentation and marketing site for the Avalon framework. We collect
				standard server logs (IP address, user agent, requested URL, and timestamp) to operate and
				secure the service.
			</p>
			<p>
				We do not sell personal data. Cloudflare may process requests on our behalf as a CDN and
				security provider. GitHub links leave our site and are governed by GitHub&apos;s policies.
			</p>
			<p>
				Questions: <a href="mailto:hello@useavalon.dev">hello@useavalon.dev</a>.
			</p>
		</article>
	);
}
