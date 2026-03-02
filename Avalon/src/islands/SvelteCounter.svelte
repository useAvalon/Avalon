<script lang="ts">
	interface Props {
		initialCount?: number;
	}
	let { initialCount = 0 }: Props = $props();
	let count = $state(initialCount);
</script>

<div class="counter">
	<div class="label">🔥 Svelte</div>
	<div class="count">{count}</div>
	<div class="buttons">
		<button onclick={() => count--}>−</button>
		<button onclick={() => count++}>+</button>
	</div>
	<div class="sublabel">Svelte 5 Runes</div>
</div>

<style>
	.counter {
		padding: 24px;
		background: linear-gradient(135deg, rgba(255,62,0,0.1) 0%, rgba(255,62,0,0.02) 100%);
		border: 1px solid rgba(255,62,0,0.15);
		border-radius: 14px;
		text-align: center;
	}

	.label {
		font-size: 14px;
		font-weight: 600;
		color: #FF3E00;
		margin-bottom: 16px;
		letter-spacing: 0.03em;
		font-family: 'DM Sans', sans-serif;
	}

	.count {
		font-size: 42px;
		font-weight: 300;
		color: rgba(255,255,255,0.9);
		margin-bottom: 20px;
		font-family: 'DM Sans', sans-serif;
	}

	.buttons {
		display: flex;
		gap: 8px;
		justify-content: center;
	}

	.buttons button {
		padding: 10px 20px;
		font-size: 18px;
		background: rgba(255,62,0,0.12);
		color: #fff;
		border: 1px solid rgba(255,62,0,0.2);
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.buttons button:hover {
		background: rgba(255,62,0,0.2);
	}

	.sublabel {
		margin-top: 14px;
		font-size: 10px;
		color: rgba(255,255,255,0.3);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-family: 'DM Sans', sans-serif;
	}
</style>
