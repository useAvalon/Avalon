<script lang="ts">
  interface Props {
    initialCount?: number;
  }
  let props: Props = $props();
  let count = $state(props.initialCount ?? 0);

  function dispatch(next: number) {
    count = next;
    document.dispatchEvent(new CustomEvent('counter:update', { detail: { count: next } }));
  }

  $effect(() => {
    function handler(e: Event) {
      count = (e as CustomEvent).detail.count;
    }
    document.addEventListener('counter:update', handler);
    return () => document.removeEventListener('counter:update', handler);
  });
</script>

<div class="svelte-counter">
  <h4>🔥 Svelte</h4>
  <div class="count-display">{count}</div>
  <div class="button-group">
    <button onclick={() => dispatch(count - 1)}>−</button>
    <button onclick={() => dispatch(count + 1)}>+</button>
  </div>
  <p class="framework-label">via CustomEvent</p>
</div>

<style>
  .svelte-counter {
    text-align: center; padding: 20px;
    background: linear-gradient(135deg, #ff3e00, #ff6b35);
    color: white; border-radius: 10px;
  }
  .svelte-counter h4 { margin-bottom: 15px; }
  .count-display {
    font-size: 2rem; font-weight: bold; margin-bottom: 15px;
    background: rgba(255,255,255,0.2); padding: 10px; border-radius: 8px;
  }
  .button-group { display: flex; gap: 10px; justify-content: center; }
  .button-group button {
    padding: 8px 16px; background: rgba(255,255,255,0.2); border: none;
    border-radius: 6px; color: white; cursor: pointer; font-size: 1.2rem;
  }
  .button-group button:hover { background: rgba(255,255,255,0.3); }
  .framework-label { margin-top: 10px; font-size: 0.8rem; opacity: 0.7; }
</style>
