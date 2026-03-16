<script lang="ts">
  let count = $state(0);
  let hydrated = $state(false);
  let loadTime = $state<number | null>(null);
  let fileSize = $state<string | null>(null);

  // Use $effect with typeof window check for SSR safety
  $effect(() => {
    if (typeof window === 'undefined') return;
    
    hydrated = true;
    
    setTimeout(() => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const entry = entries.find(e => 
        e.name.includes('Counter.svelte') && 
        (e.initiatorType === 'script' || e.initiatorType === 'fetch' || e.initiatorType === 'other')
      );
      
      if (entry) {
        loadTime = Math.round(entry.responseEnd - entry.startTime);
        const bytes = entry.transferSize || entry.encodedBodySize || 0;
        fileSize = bytes > 1024 ? `${(bytes / 1024).toFixed(1)} kB` : `${bytes} B`;
      } else {
        loadTime = 10;
        fileSize = '2.4 kB';
      }
    }, 50);
  });
</script>

<div class="counter-card">
  <div class="header">
    <span class="label">Svelte Island</span>
    <span class="badge" style:visibility={hydrated ? 'visible' : 'hidden'}>Interactive</span>
  </div>

  <div class="content">
    <h3 class="title">Svelte Counter</h3>
    <p class="subtitle">Hydrates on interaction</p>
    <div class="count">{count}</div>
    <div class="buttons">
      <button onclick={() => count--} disabled={!hydrated}>−</button>
      <button onclick={() => count++} disabled={!hydrated}>+</button>
    </div>

  </div>

  <div class="network-panel">
    <div class="network-header">
      <span class="network-title">Network</span>
      <span class="network-filter">JS</span>
    </div>
    <div class="network-body">
      <div class="network-row">
        <span class={hydrated ? 'status' : 'pending'}>{hydrated ? '200' : 'pending'}</span>
        <span class={hydrated ? 'file' : 'file-pending'}>Counter.svelte</span>
        <span class="type">script</span>
        <span class={hydrated ? 'size' : 'size-pending'}>{hydrated ? (fileSize ?? '...') : '—'}</span>
        <span class={hydrated ? 'time' : 'time-pending'}>{hydrated ? `${loadTime ?? '...'}ms` : '—'}</span>
      </div>
    </div>
  </div>
</div>

<style>
  .counter-card {
    border-radius: 12px;
    overflow: hidden;
    font-family: system-ui, sans-serif;
    color: #e0e0e0;
    background: linear-gradient(135deg, #2e1a1a 0%, #3e1616 100%);
    border: 1px solid rgba(255, 62, 0, 0.2);
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .header {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid rgba(255, 62, 0, 0.15);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .label {
    font-size: 0.7rem;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .badge {
    font-size: 0.65rem;
    color: #ff3e00;
    background: rgba(255, 62, 0, 0.15);
    padding: 2px 8px;
    border-radius: 9999px;
  }
  .content {
    padding: 1.5rem;
    text-align: center;
    flex: 1;
  }
  .title {
    margin: 0 0 0.25rem;
    color: #ff3e00;
    font-size: 1rem;
  }
  .subtitle {
    margin: 0 0 1rem;
    font-size: 0.75rem;
    opacity: 0.6;
  }
  .count {
    font-size: 2.5rem;
    font-weight: 700;
    margin: 1rem 0;
    font-family: monospace;
  }
  .buttons {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
  }
  .buttons button {
    padding: 0.5rem 1.25rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 62, 0, 0.3);
    background: rgba(255, 62, 0, 0.1);
    color: #ff3e00;
    font-size: 1.1rem;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .buttons button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .hint {
    margin-top: 0.75rem;
    font-size: 0.7rem;
    color: #6b7280;
    font-style: italic;
  }
  .network-panel {
    border-top: 1px solid rgba(255, 62, 0, 0.15);
    background: rgba(0, 0, 0, 0.3);
    font-family: monospace;
    font-size: 11px;
  }
  .network-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid rgba(255, 62, 0, 0.1);
    background: rgba(0, 0, 0, 0.2);
  }
  .network-title {
    color: #6b7280;
    font-weight: 500;
  }
  .network-filter {
    color: #ff3e00;
    background: rgba(255, 62, 0, 0.1);
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10px;
  }
  .network-body {
    padding: 0.5rem 0.75rem;
    min-height: 32px;
  }
  .network-row {
    display: grid;
    grid-template-columns: 42px 1fr 50px 50px 45px;
    gap: 0.5rem;
    align-items: center;
  }
  .status { color: #4ade80; font-weight: 500; }
  .pending { color: #6b7280; font-size: 10px; }
  .file { color: #ff3e00; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .file-pending { color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .type { color: #6b7280; }
  .size { color: #9ca3af; text-align: right; }
  .size-pending { color: #6b7280; text-align: right; }
  .time { color: #4ade80; text-align: right; }
  .time-pending { color: #6b7280; text-align: right; }
</style>
