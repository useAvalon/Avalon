export const metadata = {
	title: "About",
	description: "The about module maps to the /about route.",
};

import styles from "./index.module.css";

export default function AboutPage() {
	return (
		<div className={styles.shell}>
			<div className={styles.content}>
				<p className={styles.eyebrow}>Module route</p>
				<h1 className={styles.title}>About</h1>
				<p className={styles.body}>
					This page is <code className={styles.code}>app/modules/about/pages/index.tsx</code>. A
					module name is a URL prefix, so the about module is{" "}
					<code className={styles.code}>/about</code>. The main module is the site root.
				</p>
				<a className={styles.homeLink} href="/">
					Home
				</a>
			</div>
		</div>
	);
}
