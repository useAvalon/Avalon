import { useState } from "preact/hooks";
import styles from "./HeroInstallCommand.module.css";

const CREATE_COMMAND = "bun create avalon";

export default function HeroInstallCommand() {
	const [copied, setCopied] = useState(false);

	async function onCopy() {
		try {
			await navigator.clipboard.writeText(CREATE_COMMAND);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			setCopied(false);
		}
	}

	return (
		<div class={styles.root}>
			<code class={styles.command}>{CREATE_COMMAND}</code>
			<button
				type="button"
				class={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ""}`}
				onClick={onCopy}
				aria-label={copied ? "Copied to clipboard" : "Copy install command"}
			>
				{copied ? (
					<svg
						class={styles.copyIcon}
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						aria-hidden="true"
					>
						<path
							d="M3.5 8.5 6.5 11.5 12.5 4.5"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				) : (
					<svg
						class={styles.copyIcon}
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						aria-hidden="true"
					>
						<rect
							x="5.5"
							y="5.5"
							width="8"
							height="8"
							rx="1.5"
							stroke="currentColor"
							stroke-width="1.25"
						/>
						<path
							d="M10.5 5.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5a1.5 1.5 0 0 0 1.5 1.5h1.5"
							stroke="currentColor"
							stroke-width="1.25"
						/>
					</svg>
				)}
			</button>
		</div>
	);
}
