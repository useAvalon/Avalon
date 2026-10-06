import { useMemo, useState } from "preact/hooks";
import {
	commandsForPreset,
	PACKAGE_MANAGERS,
	type PackageManager,
	type PackageManagerPreset,
} from "../lib/package-manager-commands.ts";
import styles from "./PackageManagerTabs.module.css";

interface PackageManagerTabsProps {
	preset: PackageManagerPreset;
	projectName?: string;
	packageName?: string;
}

export default function PackageManagerTabs({
	preset,
	projectName = "my-app",
	packageName = "",
}: Readonly<PackageManagerTabsProps>) {
	const commands = useMemo(
		() => commandsForPreset(preset, projectName, packageName),
		[preset, projectName, packageName],
	);
	const [active, setActive] = useState<PackageManager>("bun");
	const [copied, setCopied] = useState(false);

	const lines = commands[active];
	const plainText = lines.join("\n");

	async function onCopy() {
		try {
			await navigator.clipboard.writeText(plainText);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			setCopied(false);
		}
	}

	return (
		<div class={`${styles.root} package-manager-tabs`}>
			<div
				class={`${styles.tablist} package-manager-tablist`}
				role="tablist"
				aria-label="Package manager"
			>
				{PACKAGE_MANAGERS.map((pm) => (
					<button
						key={pm}
						type="button"
						role="tab"
						aria-selected={pm === active}
						class={`${styles.tab} ${pm === active ? styles.tabActive : ""}`}
						onClick={() => setActive(pm)}
					>
						{pm}
					</button>
				))}
			</div>
			<div class={styles.terminal} role="tabpanel">
				<div class={styles.terminalHeader}>
					<span class={styles.terminalTitle}>
						<span class={styles.prompt}>&gt;_</span> Terminal
					</span>
					<button type="button" class={styles.copy} onClick={onCopy}>
						{copied ? "Copied" : "Copy"}
					</button>
				</div>
				<div class={styles.codeBody}>
					{lines.map((line, index) => (
						<div key={`${active}-${index}`} class={styles.codeLine}>
							{line}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
