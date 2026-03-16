/** @jsxImportSource react */
import { useState, useEffect } from 'react';
import { getResourceInfo, type ResourceInfo } from '@shared/utils/resource-timing';

export default function ReactCounter() {
  const [count, setCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [resourceInfo, setResourceInfo] = useState<ResourceInfo | null>(null);

  useEffect(() => {
    setHydrated(true);

    const timer = setTimeout(() => {
      const info = getResourceInfo('Counter.react');
      setResourceInfo(info || { loadTime: 10, size: '2.5 kB', sizeBytes: 2560 });
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="counter-card react">
      <div className="header">
        <span className="label">React Island</span>
        <span className="badge react" style={{ visibility: hydrated ? 'visible' : 'hidden' }}>Interactive</span>
      </div>

      <div className="content">
        <h3 className="title react">React Counter</h3>
        <p className="subtitle">Hydrates on interaction</p>
        <div className="count">{count}</div>
        <div className="buttons">
          <button className="btn react" onClick={() => setCount(c => c - 1)} disabled={!hydrated}>−</button>
          <button className="btn react" onClick={() => setCount(c => c + 1)} disabled={!hydrated}>+</button>
        </div>
      </div>

      <div className="network-panel react">
        <div className="network-header">
          <span className="network-title">Network</span>
          <span className="network-filter react">JS</span>
        </div>
        <div className="network-body">
          <div className="network-row">
            <span className={hydrated ? "status" : "pending"}>{hydrated ? "200" : "pending"}</span>
            <span className={hydrated ? "file react" : "file-pending"}>Counter.react.tsx</span>
            <span className="type">script</span>
            <span className={hydrated ? "size" : "size-pending"}>{hydrated ? (resourceInfo?.size ?? '...') : '—'}</span>
            <span className={hydrated ? "time" : "time-pending"}>{hydrated ? `${resourceInfo?.loadTime ?? '...'}ms` : '—'}</span>
          </div>
        </div>
      </div>

      <style>{`
        .counter-card { border-radius: 12px; overflow: hidden; font-family: system-ui, sans-serif; color: #e0e0e0; display: flex; flex-direction: column; height: 100%; }
        .counter-card.react { background: linear-gradient(135deg, #1a2a2e 0%, #162e3e 100%); border: 1px solid rgba(97, 218, 251, 0.2); }
        .header { padding: 0.75rem 1rem; border-bottom: 1px solid rgba(97, 218, 251, 0.15); display: flex; justify-content: space-between; align-items: center; }
        .label { font-size: 0.7rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
        .badge { font-size: 0.65rem; padding: 2px 8px; border-radius: 9999px; }
        .badge.react { color: #61dafb; background: rgba(97, 218, 251, 0.15); }
        .content { padding: 1.5rem; text-align: center; flex: 1; }
        .title { margin: 0 0 0.25rem; font-size: 1rem; }
        .title.react { color: #61dafb; }
        .subtitle { margin: 0 0 1rem; font-size: 0.75rem; opacity: 0.6; }
        .count { font-size: 2.5rem; font-weight: 700; margin: 1rem 0; font-family: monospace; }
        .buttons { display: flex; gap: 0.75rem; justify-content: center; }
        .btn { padding: 0.5rem 1.25rem; border-radius: 8px; font-size: 1.1rem; cursor: pointer; transition: opacity 0.15s; }
        .btn.react { border: 1px solid rgba(97, 218, 251, 0.3); background: rgba(97, 218, 251, 0.1); color: #61dafb; }
        .btn:disabled { opacity: 0.5; cursor: default; }
        .network-panel { border-top: 1px solid rgba(97, 218, 251, 0.15); background: rgba(0, 0, 0, 0.3); font-family: monospace; font-size: 11px; }
        .network-panel.react { border-color: rgba(97, 218, 251, 0.15); }
        .network-header { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; border-bottom: 1px solid rgba(97, 218, 251, 0.1); background: rgba(0, 0, 0, 0.2); }
        .network-title { color: #6b7280; font-weight: 500; }
        .network-filter { padding: 1px 6px; border-radius: 3px; font-size: 10px; }
        .network-filter.react { color: #61dafb; background: rgba(97, 218, 251, 0.1); }
        .network-body { padding: 0.5rem 0.75rem; min-height: 32px; }
        .network-row { display: grid; grid-template-columns: 42px 1fr 50px 50px 45px; gap: 0.5rem; align-items: center; }
        .status { color: #4ade80; font-weight: 500; }
        .pending { color: #6b7280; font-size: 10px; }
        .file { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .file.react { color: #61dafb; }
        .file-pending { color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .type { color: #6b7280; }
        .size { color: #9ca3af; text-align: right; }
        .size-pending { color: #6b7280; text-align: right; }
        .time { color: #4ade80; text-align: right; }
        .time-pending { color: #6b7280; text-align: right; }
      `}</style>
    </div>
  );
}
