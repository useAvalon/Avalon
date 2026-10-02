import type { ResourceInfo } from "../utils/resource-timing";
import styles from "./NetworkPanel.module.css";

export interface NetworkPanelProps {
	isHydrated: boolean;
	resourceInfo: ResourceInfo | null;
	fileName: string;
}

export function NetworkPanel({ isHydrated, resourceInfo, fileName }: NetworkPanelProps) {
	return (
		<div class={styles.networkPanel}>
			<div class={styles.networkHeader}>
				<span class={styles.networkTitle}>Network</span>
				<span class={styles.networkFilter}>JS</span>
			</div>
			<div class={styles.networkBody}>
				{!isHydrated ? (
					<div class={styles.networkRow}>
						<span class={styles.networkPending}>pending</span>
						<span class={styles.networkFilePending}>{fileName}</span>
						<span class={styles.networkType}>script</span>
						<span class={styles.networkSizePending}>—</span>
						<span class={styles.networkTimePending}>—</span>
					</div>
				) : (
					<div class={styles.networkRow}>
						<span class={styles.networkStatus}>200</span>
						<span class={styles.networkFile}>{fileName}</span>
						<span class={styles.networkType}>script</span>
						<span class={styles.networkSize}>{resourceInfo?.size ?? "..."}</span>
						<span class={styles.networkTime}>{resourceInfo?.loadTime ?? "..."}ms</span>
					</div>
				)}
			</div>
		</div>
	);
}
