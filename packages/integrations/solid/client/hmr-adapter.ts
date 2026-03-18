/**
 * Solid HMR Adapter
 *
 * Provides Hot Module Replacement support for Solid components using Solid Refresh.
 * Integrates with vite-plugin-solid to preserve signal subscriptions and reactive computations.
 */

/// <reference lib="dom" />

import { BaseFrameworkAdapter, type StateSnapshot } from '@useavalon/avalon/client/hmr';

type SolidComponent<P = Record<string, unknown>> = (props: P) => unknown;

interface SolidWebModule {
	hydrate(fn: () => unknown, node: HTMLElement, options?: { renderId?: string }): () => void;
	render(fn: () => unknown, node: HTMLElement): () => void;
	createComponent<P>(component: SolidComponent<P>, props: P): unknown;
}

interface SolidHMRRuntime {
	createRecord(id: string, component: SolidComponent): void;
	reload(id: string, component: SolidComponent): void;
	update(id: string, component: SolidComponent): void;
}

declare global {
	var __SOLID_HMR__: SolidHMRRuntime | undefined;
}

interface SolidStateSnapshot extends StateSnapshot {
	framework: 'solid';
	data: {
		signalValues?: Record<string, unknown>;
		componentName?: string;
		capturedProps?: Record<string, unknown>;
		renderId?: string;
	};
}

export class SolidHMRAdapter extends BaseFrameworkAdapter {
	readonly name = 'solid';
	private disposers: WeakMap<HTMLElement, () => void> = new WeakMap();
	private componentIds: WeakMap<HTMLElement, string> = new WeakMap();

	private isQualifiedFunction(component: unknown): boolean {
		const comp = component as unknown as Record<string, unknown>;
		if (comp.__solid) return true;
		try {
			const funcStr = component!.toString();
			return (
				funcStr.includes('createSignal') ||
				funcStr.includes('createEffect') ||
				funcStr.includes('createMemo') ||
				funcStr.includes('createResource') ||
				funcStr.includes('createStore')
			);
		} catch {
			return false;
		}
	}

	canHandle(component: unknown): boolean {
		if (!component) return false;
		if (typeof component === 'function') {
			if (this.isQualifiedFunction(component)) return true;
			return true;
		}
		if (typeof component !== 'object') return false;
		const obj = component as Record<string, unknown>;
		if (obj.default && typeof obj.default === 'function') return this.canHandle(obj.default);
		if (obj.__solid) return true;
		return false;
	}

	override preserveState(island: HTMLElement): SolidStateSnapshot | null {
		try {
			const baseSnapshot = super.preserveState(island);
			if (!baseSnapshot) return null;
			const capturedProps = island.dataset.props ? JSON.parse(island.dataset.props) : {};
			const componentName = this.extractComponentName(island.dataset.src || '');
			const renderId = island.dataset.solidRenderId || island.dataset.renderId;
			return { ...baseSnapshot, framework: 'solid', data: { componentName, capturedProps, renderId } };
		} catch (error) {
			console.warn('Failed to preserve Solid state:', error);
			return null;
		}
	}

	private resolveComponent(newComponent: unknown): SolidComponent {
		if (typeof newComponent === 'object' && newComponent !== null) {
			const obj = newComponent as Record<string, unknown>;
			if (obj.default && typeof obj.default === 'function') return obj.default as SolidComponent;
			throw new TypeError('Solid component object must have a default export');
		}
		if (typeof newComponent === 'function') return newComponent as SolidComponent;
		throw new TypeError('Invalid Solid component type');
	}

	private tryHMRReload(island: HTMLElement, Component: SolidComponent): boolean {
		const componentId = this.componentIds.get(island);
		const hmrRuntime = globalThis.__SOLID_HMR__;
		if (!hmrRuntime || !componentId) return false;
		try {
			hmrRuntime.reload(componentId, Component);
			return this.disposers.has(island);
		} catch (error) {
			console.warn('Solid HMR runtime reload failed, falling back to full remount:', error);
			return false;
		}
	}

	private disposeExisting(island: HTMLElement): void {
		const existingDisposer = this.disposers.get(island);
		if (!existingDisposer) return;
		try {
			existingDisposer();
			this.disposers.delete(island);
		} catch (error) {
			console.warn('Failed to dispose existing Solid component:', error);
		}
	}

	async update(island: HTMLElement, newComponent: unknown, props: Record<string, unknown>): Promise<void> {
		if (!this.canHandle(newComponent)) throw new Error('Component is not a valid Solid component');
		const Component = this.resolveComponent(newComponent);
		try {
			if (this.tryHMRReload(island, Component)) return;
			this.disposeExisting(island);

			const solidWebModule = (await import('solid-js/web')) as SolidWebModule;
			const { hydrate, createComponent } = solidWebModule;
			const renderId = island.dataset.solidRenderId || island.dataset.renderId;
			const dispose = hydrate(() => createComponent(Component, props), island, { renderId });
			this.disposers.set(island, dispose);
			const src = island.dataset.src || '';
			const newComponentId = this.generateComponentId(src);
			this.componentIds.set(island, newComponentId);
			const hmrRuntime = globalThis.__SOLID_HMR__;
			if (hmrRuntime) {
				try {
					hmrRuntime.createRecord(newComponentId, Component);
				} catch (error) {
					console.warn('Failed to register with Solid HMR runtime:', error);
				}
			}
			island.dataset.hydrated = 'true';
			island.dataset.hydrationStatus = 'success';
		} catch (error) {
			console.error('Solid HMR update failed:', error);
			island.dataset.hydrationStatus = 'error';
			throw error;
		}
	}

	override restoreState(island: HTMLElement, state: StateSnapshot): void {
		try {
			super.restoreState(island, state);
		} catch (error) {
			console.warn('Failed to restore Solid state:', error);
		}
	}

	override handleError(island: HTMLElement, error: Error): void {
		console.error('Solid HMR error:', error);
		super.handleError(island, error);
		const errorIndicator = island.querySelector('.hmr-error-indicator');
		if (errorIndicator) {
			const msg = error.message;
			let hint = '';
			if (msg.includes('signal') || msg.includes('Signal'))
				hint = ' (Hint: Check signal usage - signals must be called as functions)';
			else if (msg.includes('effect') || msg.includes('Effect'))
				hint = ' (Hint: Check effect usage - effects run after render)';
			else if (msg.includes('hydration') || msg.includes('hydrate'))
				hint = ' (Hint: Server and client render must match)';
			errorIndicator.textContent = `Solid HMR Error: ${msg}${hint}`;
		}
	}

	private extractComponentName(src: string): string {
		const parts = src.split('/');
		const filename = parts.at(-1) ?? '';
		return filename.replace(/\.solid\.(tsx?|jsx?)$/, '').replace(/\.(tsx?|jsx?)$/, '');
	}

	private generateComponentId(src: string): string {
		return src.replaceAll(/[^a-zA-Z0-9]/g, '_');
	}

	unmount(island: HTMLElement): void {
		const disposer = this.disposers.get(island);
		if (disposer) {
			try {
				disposer();
				this.disposers.delete(island);
				this.componentIds.delete(island);
			} catch (error) {
				console.warn('Failed to unmount Solid component:', error);
			}
		}
	}
}

export const solidAdapter = new SolidHMRAdapter();
