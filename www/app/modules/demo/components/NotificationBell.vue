<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
	userId?: string;
}>();

const notifications = ref([
	{ id: 1, text: "New deployment succeeded" },
	{ id: 2, text: "PR #42 merged" },
	{ id: 3, text: "Build cache invalidated" },
]);
const open = ref(false);

const count = computed(() => notifications.value.length);

function dismiss(id: number) {
	notifications.value = notifications.value.filter((n) => n.id !== id);
}
</script>

<template>
	<div class="notification-bell-vue">
		<div class="notification-bell-vue__header">
			<button
				class="notification-bell-vue__trigger"
				@click="open = !open"
				:aria-label="`Notifications: ${count} unread`"
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
				<span v-if="count > 0" class="notification-bell-vue__badge">{{ count }}</span>
			</button>
			<span class="notification-bell-vue__info">
				{{ props.userId ? `User: ${props.userId}` : "Personalized" }}
			</span>
		</div>

		<ul v-if="open" class="notification-bell-vue__list">
			<li v-if="notifications.length === 0" class="notification-bell-vue__empty">
				No notifications
			</li>
			<li
				v-for="n in notifications"
				:key="n.id"
				class="notification-bell-vue__item"
			>
				<span>{{ n.text }}</span>
				<button
					class="notification-bell-vue__dismiss"
					@click="dismiss(n.id)"
					:aria-label="`Dismiss: ${n.text}`"
				>
					×
				</button>
			</li>
		</ul>
	</div>
</template>

<style scoped>
.notification-bell-vue {
	font-family: system-ui, sans-serif;
	border-radius: 12px;
	background: linear-gradient(135deg, #1a1a2e 0%, #2e1a3e 100%);
	border: 1px solid rgba(167, 139, 250, 0.2);
	padding: 1rem;
}
.notification-bell-vue__header {
	display: flex;
	align-items: center;
	gap: 0.75rem;
}
.notification-bell-vue__trigger {
	position: relative;
	background: rgba(167, 139, 250, 0.1);
	border: 1px solid rgba(167, 139, 250, 0.3);
	border-radius: 8px;
	padding: 0.5rem;
	color: #a78bfa;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
}
.notification-bell-vue__trigger:hover {
	background: rgba(167, 139, 250, 0.2);
}
.notification-bell-vue__badge {
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
.notification-bell-vue__info {
	font-size: 0.75rem;
	color: #6b7280;
}
.notification-bell-vue__list {
	list-style: none;
	margin: 0.75rem 0 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}
.notification-bell-vue__item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.5rem 0.75rem;
	background: rgba(0, 0, 0, 0.3);
	border-radius: 6px;
	font-size: 0.8rem;
	color: #e0e0e0;
}
.notification-bell-vue__dismiss {
	background: none;
	border: none;
	color: #6b7280;
	font-size: 1.1rem;
	cursor: pointer;
	padding: 0 0.25rem;
	line-height: 1;
}
.notification-bell-vue__dismiss:hover {
	color: #ef4444;
}
.notification-bell-vue__empty {
	text-align: center;
	color: #6b7280;
	font-size: 0.8rem;
	padding: 0.5rem;
}
</style>
