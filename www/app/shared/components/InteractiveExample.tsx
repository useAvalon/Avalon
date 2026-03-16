/** @jsxImportSource preact */
import { useState, useEffect } from 'preact/hooks';
import styles from './InteractiveExample.module.css';
import { NetworkPanel } from './NetworkPanel';
import { getResourceInfo, type ResourceInfo } from '../utils/resource-timing';

export default function InteractiveExample() {
  const [count, setCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [resourceInfo, setResourceInfo] = useState<ResourceInfo | null>(null);

  useEffect(() => {
    setHydrated(true);
    
    const timer = setTimeout(() => {
      const info = getResourceInfo('InteractiveExample');
      setResourceInfo(info || { loadTime: 12, size: '2.1 kB', sizeBytes: 2150 });
    }, 50);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.label}>Live Example</span>
        {hydrated && <span className={styles.badge}>Interactive</span>}
      </div>
      
      <div className={styles.content}>
        <div className={styles.demo}>
          <div className={styles.counter}>
            <button 
              className={styles.btn} 
              onClick={() => setCount(c => c - 1)}
              disabled={!hydrated}
            >
              −
            </button>
            <span className={styles.count}>{count}</span>
            <button 
              className={styles.btn} 
              onClick={() => setCount(c => c + 1)}
              disabled={!hydrated}
            >
              +
            </button>
          </div>
          {!hydrated && (
            <div className={styles.hint}>Click anywhere to load JavaScript</div>
          )}
        </div>

        <NetworkPanel 
          isHydrated={hydrated} 
          resourceInfo={resourceInfo} 
          fileName="InteractiveExample.tsx" 
        />
      </div>
    </div>
  );
}
