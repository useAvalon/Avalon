/** @jsxImportSource preact */
import { useState, useEffect } from 'preact/hooks';
import styles from './InteractiveExample.module.css';

export default function InteractiveExample() {
  const [count, setCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); }, []);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.label}>Live Example</span>
        {hydrated && <span className={styles.badge}>Interactive</span>}
      </div>
      <div className={styles.demo}>
        {!hydrated ? (
          <div className={styles.preHydration}>
            <span className={styles.hint}>Click to interact →</span>
          </div>
        ) : (
          <div className={styles.counter}>
            <button className={styles.btn} onClick={() => setCount(c => c - 1)}>−</button>
            <span className={styles.count}>{count}</span>
            <button className={styles.btn} onClick={() => setCount(c => c + 1)}>+</button>
          </div>
        )}
      </div>
    </div>
  );
}
