<template>
	<div class="vue-counter">
		<h4>💚 Vue</h4>
		<div class="count-display">{{ count }}</div>
		<div class="button-group">
			<button @click="dispatch(count - 1)">−</button>
			<button @click="dispatch(count + 1)">+</button>
		</div>
		<p class="framework-label">via CustomEvent</p>
	</div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps<{ initialCount?: number }>();
const count = ref(props.initialCount ?? 0);

function dispatch(next: number) {
	count.value = next;
	document.dispatchEvent(new CustomEvent('counter:update', { detail: { count: next } }));
}

function handler(e: Event) {
	count.value = (e as CustomEvent).detail.count;
}

onMounted(() => document.addEventListener('counter:update', handler));
onUnmounted(() => document.removeEventListener('counter:update', handler));
</script>

<style scoped>
.vue-counter {
	text-align: center;
	padding: 20px;
	background: linear-gradient(135deg, #4fc08d, #42b883);
	color: white;
	border-radius: 10px;
}
.vue-counter h4 { margin-bottom: 15px; }
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
