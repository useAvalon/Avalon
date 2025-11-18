<script>
  let count = $state(0);
  
  function increment() {
    count += 1;
  }
</script>

<div>
  <h4>Simple Svelte Test</h4>
  <p>Count: {count}</p>
  <button onclick={increment}>+</button>
</div>

<style>
  div {
    padding: 20px;
    border: 1px solid #ccc;
  }
</style>