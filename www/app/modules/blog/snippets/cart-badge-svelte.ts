/** Shown in Introducing Avalon — kept out of MDX so &lt;script&gt; tags stay literal. */
export const cartBadgeSvelte = `<!-- app/modules/main/components/CartBadge.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { CART_UPDATED, type CartUpdatedDetail } from '../lib/cart-events.ts';

  let count = 0;

  onMount(() => {
    const onCart = (event: Event) => {
      count = (event as CustomEvent<CartUpdatedDetail>).detail.count;
    };
    document.addEventListener(CART_UPDATED, onCart);
    return () => document.removeEventListener(CART_UPDATED, onCart);
  });
</script>

<span aria-live="polite">Cart: {count}</span>`;
