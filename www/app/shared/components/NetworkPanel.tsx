/** @jsxImportSource preact */
import styles from './NetworkPanel.module.css';
import type { ResourceInfo } from '../utils/resource-timing';

export interface NetworkPanelProps {
  isHydrated: boolean;
  resourceInfo: ResourceInfo | null;
  fileName: string;
}

export function NetworkPanel({ isHydrated, resourceInfo, fileName }: NetworkPanelProps) {
  return (
    <div className={styles.networkPanel}>
      <div className={styles.networkHeader}>
        <span className={styles.networkTitle}>Network</span>
        <span className={styles.networkFilter}>JS</span>
      </div>
      <div className={styles.networkBody}>
        {!isHydrated ? (
          <div className={styles.networkRow}>
            <span className={styles.networkPending}>pending</span>
            <span className={styles.networkFilePending}>{fileName}</span>
            <span className={styles.networkType}>script</span>
            <span className={styles.networkSizePending}>—</span>
            <span className={styles.networkTimePending}>—</span>
          </div>
        ) : (
          <div className={styles.networkRow}>
            <span className={styles.networkStatus}>200</span>
            <span className={styles.networkFile}>{fileName}</span>
            <span className={styles.networkType}>script</span>
            <span className={styles.networkSize}>{resourceInfo?.size ?? '...'}</span>
            <span className={styles.networkTime}>{resourceInfo?.loadTime ?? '...'}ms</span>
          </div>
        )}
      </div>
    </div>
  );
}
