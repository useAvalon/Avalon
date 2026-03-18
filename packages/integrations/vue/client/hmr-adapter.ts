/**
 * Vue HMR Adapter
 *
 * Provides Hot Module Replacement support for Vue 3 components.
 * Integrates with @vitejs/plugin-vue to preserve reactive state during updates.
 * Uses Vue's __VUE_HMR_RUNTIME__ API for hot updates.
 */

/// <reference lib="dom" />

import { BaseFrameworkAdapter, type StateSnapshot } from '@useavalon/avalon/client/hmr';

type VueComponent<P = Record<string, unknown>> = VueComponentOptions<P> | ((props: P) => unknown);

interface VueComponentOptions<P = Record<string, unknown>> {
	name?: string;
	props?: string[] | Record<string, unknown>;
	data?: () => Record<string, unknown>;
	setup?: (props: P, context: unknown) => unknown;
	render?: () => unknown;
	template?: string;
	components?: Record<string, VueComponent>;
	computed?: Record<string, () => unknown>;
	methods?: Record<string, (...args: unknown[]) => unknown>;
	watch?: Record<string, unknown>;
	emits?: string[] | Record<string, unknown>;
	expose?: string[];
	beforeCreate?: () => void;
	created?: () => void;
	beforeMount?: () => void;
	mounted?: () => void;
	beforeUpdate?: () => void;
	updated?: () => void;
	beforeUnmount?: () => void;
	unmounted?: () => void;
}

interface VueApp {
	mount(rootContainer: HTMLElement | string, isHydrate?: boolean): unknown;
	unmount(): void;
	use(plugin: unknown, ...options: unknown[]): this;
	component(name: string, component: VueComponent): this;
	directive(name: string, directive: unknown): this;
	provide(key: string | symbol, value: unknown): this;
	config: {
		errorHandler?: (err: Error, instance: unknown, info: string) => void;
		warnHandler?: (msg: string, instance: unknown, trace: string) => void;
	};
}

interface VueModule {
	createApp(rootComponent: VueComponent, rootProps?: Record<string, unknown>): VueApp;
	version: string;
}

interface VueHMRRuntime {
	createRecord(id: string, component: VueComponent): boolean;
	reload(id: string, component: VueComponent): void;
	rerender(id: string, render: () => unknown): void;
}

declare global {
	var __VUE_HMR_RUNTIME__: VueHMRRuntime | undefined;
}

interface VueStateSnapshot extends StateSnapshot {
	framework: 'vue';
	data: {
		reactiveData?: Record<string, unknown>;
		componentName?: string;
		capturedProps?: Record<string, unknown>;
		computedValues?: Record<string, unknown>;
	};
}

export class VueHMRAdapter extends BaseFrameworkAdapter {
	readonly name = 'vue';
	private apps: WeakMap<HTMLElement, VueApp> = new WeakMap();
	private componentIds: WeakMap<HTMLElement, string> = new WeakMap();

	canHandle(component: unknown): boolean {
		if (!component) return false;
		if (typeof component === 'function') return true;
		if (typeof component !== 'object') return false;
		const obj = component as Record<string, unknown>;
		if (
			'setup' in obj ||
			'data' in obj ||
			'render' in obj ||
			'template' in obj ||
			'props' in obj ||
			'computed' in obj ||
			'methods' in obj ||
			'components' in obj ||
			'emits' in obj ||
			'mounted' in obj ||
			'created' in obj ||
			'beforeMount' in obj ||
			'beforeCreate' in obj
		)
			return true;
		if ('__vccOpts' in obj) return true;
		return false;
	}

	override preserveState(island: HTMLElement): VueStateSnapshot | null {
		try {
			const baseSnapshot = super.preserveState(island);
			if (!baseSnapshot) return null;
			const capturedProps = island.dataset.props ? JSON.parse(island.dataset.props) : {};
			const componentName = this.extractComponentName(island.dataset.src || '');
			const reactiveData = this.captureReactiveData(island);
			return { ...baseSnapshot, framework: 'vue', data: { componentName, capturedProps, reactiveData } };
		} catch (error) {
			console.warn('Failed to preserve Vue state:', error);
			return null;
		}
	}

	async update(island: HTMLElement, newComponent: unknown, props: Record<string, unknown>): Promise<void> {
		if (!this.canHandle(newComponent)) throw new Error('Component is not a valid Vue component');
		const Component = newComponent as VueComponent;
		try {
			const vueModule = (await import('vue')) as VueModule;
			const { createApp } = vueModule;
			const existingApp = this.apps.get(island);
			const componentId = this.componentIds.get(island);
			const hmrRuntime = globalThis.__VUE_HMR_RUNTIME__;
			if (hmrRuntime && componentId) {
				try {
					hmrRuntime.reload(componentId, Component);
					if (existingApp) return;
				} catch (error) {
					console.warn('Vue HMR runtime reload failed, falling back to full remount:', error);
				}
			}
			if (existingApp) {
				try {
					existingApp.unmount();
				} catch (error) {
					console.warn('Failed to unmount existing Vue app:', error);
				}
			}
			const app = createApp(Component, props);
			app.config.errorHandler = (err: Error, _instance: unknown, info: string) => {
				console.error('Vue component error during HMR:', err, info);
			};
			app.mount(island, true);
			this.apps.set(island, app);
			const src = island.dataset.src || '';
			const newComponentId = this.generateComponentId(src);
			this.componentIds.set(island, newComponentId);
			if (hmrRuntime) hmrRuntime.createRecord(newComponentId, Component);
			island.dataset.hydrated = 'true';
			island.dataset.hydrationStatus = 'success';
		} catch (error) {
			console.error('Vue HMR update failed:', error);
			island.dataset.hydrationStatus = 'error';
			throw error;
		}
	}

	override restoreState(island: HTMLElement, state: StateSnapshot): void {
		try {
			super.restoreState(island, state);
		} catch (error) {
			console.warn('Failed to restore Vue state:', error);
		}
	}

	override handleError(island: HTMLElement, error: Error): void {
		console.error('Vue HMR error:', error);
		super.handleError(island, error);
		const errorIndicator = island.querySelector('.hmr-error-indicator');
		if (errorIndicator) {
			const msg = error.message;
			let hint = '';
			if (msg.includes('reactive') || msg.includes('ref'))
				hint = ' (Hint: Check reactive state usage - refs must be accessed with .value)';
			else if (msg.includes('render')) hint = ' (Hint: Check component render function or template for errors)';
			else if (msg.includes('hydration') || msg.includes('mismatch'))
				hint = ' (Hint: Server and client render must match)';
			else if (msg.includes('setup'))
				hint = ' (Hint: Check setup function - it should return render function or object)';
			errorIndicator.textContent = `Vue HMR Error: ${msg}${hint}`;
		}
	}

	private extractComponentName(src: string): string {
		const parts = src.split('/');
		const filename = parts.at(-1) ?? '';
		return filename.replace(/\.(vue|tsx?|jsx?)$/, '');
	}

	private generateComponentId(src: string): string {
		return src.replaceAll(/[^a-zA-Z0-9]/g, '_');
	}

	private captureReactiveData(island: HTMLElement): Record<string, unknown> | undefined {
		try {
			const vueInstance = (island as unknown as { __vueParentComponent?: unknown }).__vueParentComponent;
			if (vueInstance && typeof vueInstance === 'object') {
				const data = (vueInstance as { data?: Record<string, unknown> }).data;
				if (data && typeof data === 'object') return { ...data };
			}
		} catch (error) {
			console.debug('Could not capture Vue reactive data:', error);
		}
		return undefined;
	}

	unmount(island: HTMLElement): void {
		const app = this.apps.get(island);
		if (app) {
			try {
				app.unmount();
				this.apps.delete(island);
				this.componentIds.delete(island);
			} catch (error) {
				console.warn('Failed to unmount Vue app:', error);
			}
		}
	}
}

export const vueAdapter = new VueHMRAdapter();
