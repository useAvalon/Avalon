export const metadata = {
	title: "404 - Page Not Found",
	description: "The page you are looking for does not exist.",
	robots: "noindex, nofollow",
};

import styles from "./404.module.css";

export default function NotFoundPage() {
	return (
		<div className={styles.page}>
			<h1 className={styles.status}>404</h1>
			<p className={styles.message}>Page not found</p>
			<a className={styles.homeLink} href="/">
				Go Home
			</a>
		</div>
	);
}
