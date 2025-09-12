// Vue 3 island example - works seamlessly with Vite!
import { createApp, ref } from 'vue';

interface VueCounterProps {
	initialCount?: number;
	step?: number;
}

// Vue component definition
function VueCounter(props: VueCounterProps) {
	const count = ref(props.initialCount || 0);
	const step = props.step || 1;

	return {
		setup() {
			return {
				count,
				step,
				increment: () => (count.value += step),
				decrement: () => (count.value -= step),
				reset: () => (count.value = props.initialCount || 0),
			};
		},
		template: `
      <div style="padding: 1rem; border: 2px solid #4FC08D; border-radius: 4px;">
        <h3>Vue Counter Island</h3>
        <p>Count: <strong>{{ count }}</strong></p>
        <button @click="increment" style="margin-right: 0.5rem;">
          +{{ step }}
        </button>
        <button @click="decrement" style="margin-right: 0.5rem;">
          -{{ step }}
        </button>
        <button @click="reset">
          Reset
        </button>
        <div style="margin-top: 0.5rem; font-size: 0.9em; color: #666;">
          Powered by Vue 3 with Composition API
        </div>
      </div>
    `,
	};
}

export default VueCounter;

// Hydration function for the island system
export function hydrate(container: HTMLElement, props: VueCounterProps) {
	// Vue 3 hydration - Vite handles the bundling automatically
	const app = createApp(VueCounter(props));
	app.mount(container);
}

// HMR support for development
if (import.meta.hot) {
	import.meta.hot.accept();
}
