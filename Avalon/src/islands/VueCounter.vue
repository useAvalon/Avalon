<template>
	<div class="counter">
		<div class="label">💚 Vue</div>
		<div class="count">{{ count }}</div>
		<div class="buttons">
			<button @click="count--">−</button>
			<button @click="count++">+</button>
		</div>
		<div class="sublabel">Composition API</div>
	</div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';

const props = defineProps<{ initialCount?: number }>();
const count = ref(props.initialCount ?? 0);
</script>

<style scoped>
.counter {
	padding: 24px;
	background: linear-gradient(135deg, rgba(66,184,131,0.1) 0%, rgba(66,184,131,0.02) 100%);
	border: 1px solid rgba(66,184,131,0.15);
	border-radius: 14px;
	text-align: center;
}

.label {
	font-size: 14px;
	font-weight: 600;
	color: #42B883;
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
	background: rgba(66,184,131,0.12);
	color: #fff;
	border: 1px solid rgba(66,184,131,0.2);
	border-radius: 8px;
	cursor: pointer;
	transition: all 0.2s ease;
}

.buttons button:hover {
	background: rgba(66,184,131,0.2);
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
