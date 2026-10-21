import { useEffect, useRef, useState } from "preact/hooks";
import styles from "./HeroInstallCommand.module.css";

const CREATE_COMMAND = "bun create avalon";
const COPY_RESET_MS = 2000;

type CopyStatus = "idle" | "copied" | "failed";

export default function HeroInstallCommand() {
	const [status, setStatus] = useState<CopyStatus>("idle");
	const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (resetTimer.current !== null) clearTimeout(resetTimer.current);
		};
	}, []);

	function scheduleReset() {
		if (resetTimer.current !== null) clearTimeout(resetTimer.current);
		resetTimer.current = setTimeout(() => {
			setStatus("idle");
			resetTimer.current = null;
		}, COPY_RESET_MS);
	}

	async function onCopy() {
		try {
			await navigator.clipboard.writeText(CREATE_COMMAND);
			setStatus("copied");
			scheduleReset();
		} catch {
			setStatus("failed");
			scheduleReset();
		}
	}

	const copied = status === "copied";
	const failed = status === "failed";
	const ariaLabel = copied
		? "Copied to clipboard"
		: failed
			? "Could not copy. Select the command."
			: "Copy install command";

	return (
		<div class={styles.root}>
			<code class={styles.command}>{CREATE_COMMAND}</code>
			<button
				type="button"
				class={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ""}`}
				onClick={onCopy}
				aria-label={ariaLabel}
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
			<p class={styles.copyStatus} aria-live="polite">
				{copied ? "Copied to clipboard" : failed ? "Could not copy. Select the command." : ""}
			</p>
		</div>
	);
}
