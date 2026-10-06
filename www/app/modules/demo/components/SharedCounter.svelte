<script lang="ts">
  import {
    dispatchSharedCounter,
    SHARED_COUNTER_EVENT,
    type SharedCounterDetail,
  } from '../lib/shared-counter-events.ts';

  let count = $state(0);

  $effect(() => {
    if (typeof window === 'undefined') return;

    const onSync = (event: Event) => {
      const detail = (event as CustomEvent<SharedCounterDetail>).detail;
      count = detail.count;
    };
    document.addEventListener(SHARED_COUNTER_EVENT, onSync);
    return () => document.removeEventListener(SHARED_COUNTER_EVENT, onSync);
  });

  function bump(delta: number) {
    const next = count + delta;
    count = next;
    dispatchSharedCounter(next);
  }
</script>

<div class="counter-card shared-counter">
  <div class="header">
    <span class="label">Svelte island</span>
    <span class="badge">CustomEvent</span>
  </div>

  <div class="content">
    <h3 class="title">Shared counter</h3>
    <p class="subtitle">Separate bundle, same count</p>
    <div class="count" aria-live="polite">{count}</div>
    <div class="buttons">
      <button type="button" onclick={() => bump(-1)} aria-label="Decrement">−</button>
      <button type="button" onclick={() => bump(1)} aria-label="Increment">+</button>
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
    font-weight: 600;
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
</style>
