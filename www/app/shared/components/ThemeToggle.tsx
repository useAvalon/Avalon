import { useEffect, useState } from "preact/hooks";
import styles from "./ThemeToggle.module.css";

function getInitialTheme(): "dark" | "light" {
	if (typeof window === "undefined") return "dark";
	try {
		const stored = localStorage.getItem("avalon-theme");
		if (stored === "light" || stored === "dark") return stored;
	} catch {
		// localStorage may be unavailable in restricted contexts
	}
	return "dark";
}

function applyTheme(theme: "dark" | "light") {
	const el = document.documentElement;
	el.setAttribute("data-theme", theme);
	el.style.colorScheme = theme;
	localStorage.setItem("avalon-theme", theme);
}

export default function ThemeToggle() {
	const [theme, setTheme] = useState<"dark" | "light">(getInitialTheme);

	useEffect(() => {
		applyTheme(theme);
	}, [theme]);

	// Sync if another tab changes the theme
	useEffect(() => {
		const onStorage = (e: StorageEvent) => {
			if (e.key === "avalon-theme" && (e.newValue === "dark" || e.newValue === "light")) {
				setTheme(e.newValue);
			}
		};
		window.addEventListener("storage", onStorage);
		return () => window.removeEventListener("storage", onStorage);
	}, []);

	const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

	return (
		<button
			type="button"
			class={styles.toggle}
			onClick={toggle}
			aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
			title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
		>
			{theme === "dark" ? (
				<svg class={styles.icon} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
					<path
						fillRule="evenodd"
						d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
						clipRule="evenodd"
					/>
				</svg>
			) : (
				<svg class={styles.icon} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
					<path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
				</svg>
			)}
		</button>
	);
}
