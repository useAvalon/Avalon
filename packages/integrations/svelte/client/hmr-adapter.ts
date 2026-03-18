/**
 * Svelte HMR Adapter
 *
 * Provides Hot Module Replacement support for Svelte 5 components.
 * Integrates with @sveltejs/vite-plugin-svelte for HMR updates.
 *
 * IMPORTANT: Svelte 5 HMR Behavior
 * - HMR is controlled via compilerOptions.hmr in the Vite plugin config
 * - Local state is NOT preserved during HMR (by design in Svelte 5)
 * - CSS-only changes DO preserve state (100% preserved)
 * - Store subscriptions are maintained across updates
 * - The component is remounted with fresh state on JS changes
 */

/// <reference lib="dom" />

import { BaseFrameworkAdapter, type StateSnapshot } from '@useavalon/avalon/client/hmr';

interface SvelteComponent {
	new (options: SvelteComponentOptions): SvelteComponentInstance;
	$render?: unknown;
}

interface SvelteComponentOptions {
	target: HTMLElement;
	props?: Record<string, unknown>;
	hydrate?: boolean;
	intro?: boolean;
	anchor?: Element | null;
	context?: Map<unknown, unknown>;
}

interface SvelteComponentInstance {
	$set(props: Record<string, unknown>): void;
	$destroy(): void;
	$on?(event: string, handler: (...args: unknown[]) => void): () => void;
	$?: {
		ctx?: unknown[];
		props?: Record<string, unknown>;
		bound?: Record<string, unknown>;
	};
}

interface SvelteStateSnapshot extends StateSnapshot {
	framework: 'svelte';
	data: {
		localState?: Record<string, unknown>;
		storeValues?: Record<string, unknown>;
		componentName?: string;
		capturedProps?: Record<string, unknown>;
		reactiveDependencies?: string[];
	};
}

export class SvelteHMRAdapter extends BaseFrameworkAdapter {
	readonly name = 'svelte';
	private readonly instances: WeakMap<HTMLElement, SvelteComponentInstance> = new WeakMap();
	private readonly componentIds: WeakMap<HTMLElement, string> = new WeakMap();
	private readonly storeSubscriptions: WeakMap<HTMLElement, Array<() => void>> = new WeakMap();

	private isSvelteFunction(component: Function): boolean {
		const comp = component as unknown as Record<string, unknown>;
		if (comp.$render) return true;
		const proto = (component as { prototype?: Record<string, unknown> }).prototype;
		if (proto && ((proto.$set && proto.$destroy) || proto.$)) return true;
		try {
			const funcStr = component.toString();
			if (funcStr.includes('$set') || funcStr.includes('$destroy') || funcStr.includes('$')) return true;
		} catch {
			/* ignore */
		}
		return false;
	}

	canHandle(component: unknown): boolean {
		if (!component) return false;
		if (typeof component === 'function') return this.isSvelteFunction(component);
		if (typeof component !== 'object') return false;
		const obj = component as Record<string, unknown>;
		if (obj.default && typeof obj.default === 'function') return this.canHandle(obj.default);
		return obj.$render !== undefined;
	}

	override preserveState(island: HTMLElement): SvelteStateSnapshot | null {
		try {
			const baseSnapshot = super.preserveState(island);
			if (!baseSnapshot) return null;
			const propsAttr = island.dataset.props;
			const capturedProps = propsAttr ? JSON.parse(propsAttr) : {};
			const src = island.dataset.src || '';
			const componentName = this.extractComponentName(src);
			const localState = this.captureLocalState(island);
			return { ...baseSnapshot, framework: 'svelte', data: { componentName, capturedProps, localState } };
		} catch (error) {
			console.warn('Failed to preserve Svelte state:', error);
			return null;
		}
	}

	private extractComponent(newComponent: unknown): SvelteComponent {
		if (typeof newComponent === 'object' && newComponent !== null) {
			const obj = newComponent as Record<string, unknown>;
			if (obj.default && typeof obj.default === 'function') return obj.default as SvelteComponent;
			throw new Error('Svelte component object must have a default export');
		}
		if (typeof newComponent === 'function') return newComponent as SvelteComponent;
		throw new TypeError('Invalid Svelte component type');
	}

	private async cleanupInstance(island: HTMLElement, instance: SvelteComponentInstance): Promise<void> {
		try {
			const subscriptions = this.storeSubscriptions.get(island);
			if (subscriptions) {
				subscriptions.forEach(unsubscribe => unsubscribe());
				this.storeSubscriptions.delete(island);
			}
			const svelteModule = (await import('svelte')) as Record<string, unknown>;
			const svelteUnmount = svelteModule.unmount as ((component: unknown) => void) | undefined;
			if (svelteUnmount) svelteUnmount(instance);
			else if (instance.$destroy) instance.$destroy();
		} catch {
			if (instance.$destroy) instance.$destroy();
		}
	}

	private async mountComponent(
		Component: SvelteComponent,
		island: HTMLElement,
		props: Record<string, unknown>,
	): Promise<SvelteComponentInstance> {
		try {
			const svelteModule = (await import('svelte')) as Record<string, unknown>;
			const svelteMount = svelteModule.mount as
				| ((component: unknown, options: { target: HTMLElement; props: Record<string, unknown> }) => unknown)
				| undefined;
			if (svelteMount) return svelteMount(Component as any, { target: island, props }) as SvelteComponentInstance;
			return new Component({ target: island, props, hydrate: false, intro: false });
		} catch {
			return new Component({ target: island, props, hydrate: false, intro: false });
		}
	}

	async update(island: HTMLElement, newComponent: unknown, props: Record<string, unknown>): Promise<void> {
		if (!this.canHandle(newComponent)) throw new Error('Component is not a valid Svelte component');
		const Component = this.extractComponent(newComponent);
		try {
			const existingInstance = this.instances.get(island);
			if (existingInstance) {
				await this.cleanupInstance(island, existingInstance).catch(error =>
					console.warn('Failed to destroy existing Svelte instance:', error),
				);
			}
			island.innerHTML = '';
			const instance = await this.mountComponent(Component, island, props);
			this.instances.set(island, instance);
			const src = island.dataset.src || '';
			this.componentIds.set(island, this.generateComponentId(src));
			island.dataset.hydrated = 'true';
			island.dataset.hydrationStatus = 'success';
		} catch (error) {
			console.error('Svelte HMR update failed:', error);
			island.dataset.hydrationStatus = 'error';
			throw error;
		}
	}

	override restoreState(island: HTMLElement, state: StateSnapshot): void {
		try {
			super.restoreState(island, state);
		} catch (error) {
			console.warn('Failed to restore Svelte state:', error);
		}
	}

	override handleError(island: HTMLElement, error: Error): void {
		console.error('Svelte HMR error:', error);
		super.handleError(island, error);
		const errorIndicator = island.querySelector('.hmr-error-indicator');
		if (errorIndicator) {
			const msg = error.message;
			let hint = '';
			if (msg.includes('$:') || msg.includes('reactive'))
				hint = ' (Hint: Check reactive statements ($:) - they must be at component top level)';
			else if (msg.includes('store'))
				hint = ' (Hint: Check store usage - stores must be imported and subscribed correctly)';
			else if (msg.includes('hydration') || msg.includes('hydrate'))
				hint = ' (Hint: Server and client render must match)';
			else if (msg.includes('target')) hint = ' (Hint: Check component target - it must be a valid DOM element)';
			errorIndicator.textContent = `Svelte HMR Error: ${msg}${hint}`;
		}
	}

	private extractComponentName(src: string): string {
		const parts = src.split('/');
		const filename = parts.at(-1) ?? '';
		return filename.replace(/\.svelte$/, '');
	}

	private generateComponentId(src: string): string {
		return src.replaceAll(/[^a-zA-Z0-9]/g, '_');
	}

	private captureLocalState(island: HTMLElement): Record<string, unknown> | undefined {
		try {
			const instance = this.instances.get(island);
			if (!instance) return undefined;
			const internalState = instance.$;
			if (internalState?.ctx) return { ctx: internalState.ctx, props: internalState.props, bound: internalState.bound };
			return undefined;
		} catch {
			return undefined;
		}
	}

	async unmount(island: HTMLElement): Promise<void> {
		const instance = this.instances.get(island);
		if (instance) {
			try {
				await this.cleanupInstance(island, instance);
				this.instances.delete(island);
				this.componentIds.delete(island);
			} catch (error) {
				console.warn('Failed to unmount Svelte component:', error);
			}
		}
	}
}

export const svelteAdapter = new SvelteHMRAdapter();
