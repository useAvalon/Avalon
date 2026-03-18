/**
 * Preact HMR Adapter
 *
 * Provides Hot Module Replacement support for Preact components.
 * Integrates with @preact/preset-vite to preserve hooks state and component tree during updates.
 */

/// <reference lib="dom" />

import { BaseFrameworkAdapter, type StateSnapshot } from '@useavalon/avalon/client/hmr';

type PreactComponent<P = Record<string, unknown>> =
	| ((props: P) => PreactVNode | null)
	| (new (props: P) => PreactClassComponent);

interface PreactClassComponent {
	render(): PreactVNode | null;
	isReactComponent?: boolean;
}

interface PreactVNode {
	type: string | PreactComponent;
	props: Record<string, unknown>;
	key: string | number | null;
}

interface PreactModule {
	h<P = Record<string, unknown>>(
		component: PreactComponent<P> | string,
		props: P | null,
		...children: unknown[]
	): PreactVNode;
	render(vnode: PreactVNode, container: HTMLElement): void;
	hydrate(vnode: PreactVNode, container: HTMLElement): void;
}

interface PreactStateSnapshot extends StateSnapshot {
	framework: 'preact';
	data: {
		componentData?: unknown;
		componentName?: string;
		capturedProps?: Record<string, unknown>;
	};
}

export class PreactHMRAdapter extends BaseFrameworkAdapter {
	readonly name = 'preact';
	private instances: WeakMap<HTMLElement, unknown> = new WeakMap();

	canHandle(component: unknown): boolean {
		if (!component) return false;
		if (typeof component === 'function') {
			const proto = (component as { prototype?: Record<string, unknown> }).prototype;
			if (proto && proto.isReactComponent) return true;
			if ((component as unknown as Record<string, unknown>).$typeof) return true;
			return true;
		}
		if (typeof component !== 'object') return false;
		const obj = component as Record<string, unknown>;
		if (obj.$typeof) return true;
		if (obj.type && typeof obj.type === 'function') return true;
		return false;
	}

	override preserveState(island: HTMLElement): PreactStateSnapshot | null {
		try {
			const baseSnapshot = super.preserveState(island);
			if (!baseSnapshot) return null;
			const capturedProps = island.dataset.props ? JSON.parse(island.dataset.props) : {};
			const componentName = this.extractComponentName(island.dataset.src || '');
			return { ...baseSnapshot, framework: 'preact', data: { componentName, capturedProps } };
		} catch (error) {
			console.warn('Failed to preserve Preact state:', error);
			return null;
		}
	}

	async update(island: HTMLElement, newComponent: unknown, props: Record<string, unknown>): Promise<void> {
		if (!this.canHandle(newComponent)) throw new Error('Component is not a valid Preact component');
		const Component = newComponent as PreactComponent;
		try {
			const preactModule = (await import('preact')) as PreactModule;
			const { h, hydrate } = preactModule;
			const vnode = h(Component, props);
			hydrate(vnode, island);
			this.instances.set(island, Component);
			island.dataset.hydrated = 'true';
			island.dataset.hydrationStatus = 'success';
		} catch (error) {
			console.error('Preact HMR update failed:', error);
			island.dataset.hydrationStatus = 'error';
			throw error;
		}
	}

	override restoreState(island: HTMLElement, state: StateSnapshot): void {
		try {
			super.restoreState(island, state);
		} catch (error) {
			console.warn('Failed to restore Preact state:', error);
		}
	}

	override handleError(island: HTMLElement, error: Error): void {
		console.error('Preact HMR error:', error);
		super.handleError(island, error);
		const errorIndicator = island.querySelector('.hmr-error-indicator');
		if (errorIndicator) {
			const msg = error.message;
			let hint = '';
			if (msg.includes('hooks')) hint = ' (Hint: Check hooks usage - hooks must be called in the same order)';
			else if (msg.includes('render')) hint = ' (Hint: Check component render method for errors)';
			else if (msg.includes('hydration') || msg.includes('hydrate'))
				hint = ' (Hint: Server and client render must match)';
			errorIndicator.textContent = `Preact HMR Error: ${msg}${hint}`;
		}
	}

	private extractComponentName(src: string): string {
		const parts = src.split('/');
		const filename = parts.at(-1) ?? '';
		return filename.replace(/\.(tsx?|jsx?)$/, '');
	}

	unmount(island: HTMLElement): void {
		const instance = this.instances.get(island);
		if (instance) {
			try {
				this.instances.delete(island);
				island.innerHTML = '';
			} catch (error) {
				console.warn('Failed to unmount Preact component:', error);
			}
		}
	}
}

export const preactAdapter = new PreactHMRAdapter();
