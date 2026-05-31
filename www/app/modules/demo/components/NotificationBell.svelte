<script lang="ts">
	interface Props {
		userId?: string;
	}

	let { userId }: Props = $props();

	let notifications = $state([
		{ id: 1, text: "New deployment succeeded" },
		{ id: 2, text: "PR #42 merged" },
		{ id: 3, text: "Build cache invalidated" },
	]);
	let open = $state(false);

	function dismiss(id: number) {
		notifications = notifications.filter((n) => n.id !== id);
	}
</script>

<div class="notification-bell-svelte">
	<div class="notification-bell-svelte__header">
		<button
			class="notification-bell-svelte__trigger"
			onclick={() => open = !open}
			aria-label={`Notifications: ${notifications.length} unread`}
		>
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
				<path d="M13.73 21a2 2 0 0 1-3.46 0" />
			</svg>
			{#if notifications.length > 0}
				<span class="notification-bell-svelte__badge">{notifications.length}</span>
			{/if}
		</button>
		<span class="notification-bell-svelte__info">
			{userId ? `User: ${userId}` : "Personalized"}
		</span>
	</div>

	{#if open}
		<ul class="notification-bell-svelte__list">
			{#if notifications.length === 0}
				<li class="notification-bell-svelte__empty">No notifications</li>
			{/if}
			{#each notifications as n (n.id)}
				<li class="notification-bell-svelte__item">
					<span>{n.text}</span>
					<button
						class="notification-bell-svelte__dismiss"
						onclick={() => dismiss(n.id)}
						aria-label={`Dismiss: ${n.text}`}
					>
						×
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.notification-bell-svelte {
		font-family: system-ui, sans-serif;
		border-radius: 12px;
		background: linear-gradient(135deg, #2e2a1a 0%, #3e2e16 100%);
		border: 1px solid rgba(251, 146, 60, 0.2);
		padding: 1rem;
	}
	.notification-bell-svelte__header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.notification-bell-svelte__trigger {
		position: relative;
		background: rgba(251, 146, 60, 0.1);
		border: 1px solid rgba(251, 146, 60, 0.3);
		border-radius: 8px;
		padding: 0.5rem;
		color: #fb923c;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.notification-bell-svelte__trigger:hover {
		background: rgba(251, 146, 60, 0.2);
	}
	.notification-bell-svelte__badge {
		position: absolute;
		top: -4px;
		right: -4px;
		background: #ef4444;
		color: white;
		font-size: 0.6rem;
		font-weight: 700;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.notification-bell-svelte__info {
		font-size: 0.75rem;
		color: #6b7280;
	}
	.notification-bell-svelte__list {
		list-style: none;
		margin: 0.75rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.notification-bell-svelte__item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 6px;
		font-size: 0.8rem;
		color: #e0e0e0;
	}
	.notification-bell-svelte__dismiss {
		background: none;
		border: none;
		color: #6b7280;
		font-size: 1.1rem;
		cursor: pointer;
		padding: 0 0.25rem;
		line-height: 1;
	}
	.notification-bell-svelte__dismiss:hover {
		color: #ef4444;
	}
	.notification-bell-svelte__empty {
		text-align: center;
		color: #6b7280;
		font-size: 0.8rem;
		padding: 0.5rem;
	}
</style>
