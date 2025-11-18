<script module lang="ts">
  // Export hydrate function for client-side hydration
  // This will be called by main.js when the component needs to hydrate
  export async function hydrate(element: HTMLElement, props: Record<string, unknown> = {}) {
    // Import the hydration utility and the component
    const { hydrateSvelteComponent } = await import('../../../src/client/svelte-hydration.js');
    const SvelteCounterModule = await import('./SvelteCounter.svelte');
    const SvelteCounterComponent = SvelteCounterModule.default;
    
    return await hydrateSvelteComponent(element, SvelteCounterComponent, props);
  }
</script>

<script lang="ts">
  let count = $state(0);
  
  function increment() {
    count += 1;
  }
  
  function decrement() {
    count -= 1;
  }
</script>

<div class="svelte-counter">
  <h4>🔥 Svelte Counter</h4>
  <div class="count-display">{count}</div>
  <div class="button-group">
    <button on:click={decrement}>−</button>
    <button on:click={increment}>+</button>
  </div>
  <p class="framework-label">Powered by Svelte reactivity</p>
</div>

<style>
  .svelte-counter {
    text-align: center;
    padding: 20px;
    background: linear-gradient(135deg, #ff3e00, #ff6b35);
    color: white;
    border-radius: 10px;
  }

  .svelte-counter h4 {
    margin-bottom: 15px;
  }

  .count-display {
    font-size: 2rem;
    font-weight: bold;
    margin-bottom: 15px;
    background: rgba(255,255,255,0.2);
    padding: 10px;
    border-radius: 8px;
  }

  .button-group {
    display: flex;
    gap: 10px;
    justify-content: center;
  }

  .button-group button {
    padding: 8px 16px;
    background: rgba(255,255,255,0.2);
    border: none;
    border-radius: 6px;
    color: white;
    cursor: pointer;
    font-size: 1.2rem;
    transition: background 0.2s;
  }

  .button-group button:hover {
    background: rgba(255,255,255,0.3);
  }

  .framework-label {
    margin-top: 10px;
    font-size: 0.9rem;
    opacity: 0.8;
  }
</style>



