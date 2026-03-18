/**
 * Qwik HMR Adapter
 *
 * Provides Hot Module Replacement support for Qwik components.
 * Qwik uses resumability instead of hydration — components are serialized
 * on the server and resumed on the client without replaying application logic.
 */

/// <reference lib="dom" />

import { BaseFrameworkAdapter, type StateSnapshot } from '@useavalon/avalon/client/hmr';

type QwikComponent<P = Record<string, unknown>> = {
	(props: P): unknown;
	__brand?: 'QwikComponent';
};

interface QwikModule {
	renderToString?: (opts: Record<string, unknown>) => Promise<string>;
	render?: (parent: Element, jsxNode: unknown) => Promise<void>;
}

interface QwikStateSnapshot extends StateSnapshot {
	framework: 'qwik';
	data: {
		componentName: string;
		capturedProps: Record<string, unknown>;
		containerState: string | null;
		qContainerAttrs: Record<string, string>;
	};
}

export class QwikHMRAdapter extends BaseFrameworkAdapter {
	readonly name = 'qwik';
	private containers: WeakMap<HTMLElement, { cleanup?: () => void }> = new WeakMap();

	private isQwikFunction(component: unknown): boolean {
		const comp = component as unknown as Record<string, unknown>;
		if (comp.__brand === 'QwikComponent' || comp.__qrl) return true;
		if (comp.getSymbol || comp.getHash) return true;
		try {
			const funcStr = component!.toString();
			return (
				funcStr.includes('component$') ||
				funcStr.includes('qrl') ||
				funcStr.includes('useSignal') ||
				funcStr.includes('useStore') ||
				funcStr.includes('useTask$') ||
				funcStr.includes('useVisibleTask$') ||
				funcStr.includes('_qrl') ||
				funcStr.includes('qwik')
			);
		} catch {
			return false;
		}
	}

	canHandle(component: unknown): boolean {
		if (!component) return false;
		if (typeof component === 'function') return this.isQwikFunction(component);
		if (typeof component !== 'object' || component === null) return false;
		const obj = component as Record<string, unknown>;
		if (obj.default && typeof obj.default === 'function') return this.canHandle(obj.default);
		if (obj.__qrl || obj.__brand === 'QwikComponent') return true;
		return false;
	}

	override preserveState(island: HTMLElement): QwikStateSnapshot | null {
		try {
			const baseSnapshot = super.preserveState(island);
			if (!baseSnapshot) return null;
			const capturedProps = island.dataset.props ? JSON.parse(island.dataset.props) : {};
			const src = island.dataset.src || '';
			const componentName = this.extractComponentName(src);
			const containerEl = island.closest(String.raw`[q\:container]`) || island;
			const containerState = containerEl.querySelector('script[type="qwik/json"]')?.textContent || null;
			const qContainerAttrs: Record<string, string> = {};
			if (containerEl.attributes) {
				for (const attr of containerEl.attributes) {
					if (attr.name.startsWith('q:')) qContainerAttrs[attr.name] = attr.value;
				}
			}
			return {
				...baseSnapshot,
				framework: 'qwik',
				data: { componentName, capturedProps, containerState, qContainerAttrs },
			};
		} catch (error) {
			console.warn('Failed to preserve Qwik state:', error);
			return null;
		}
	}

	private resolveComponent(newComponent: unknown): QwikComponent {
		if (typeof newComponent === 'object' && newComponent !== null) {
			const obj = newComponent as Record<string, unknown>;
			if (obj.default && typeof obj.default === 'function') return obj.default as QwikComponent;
			throw new TypeError('Qwik component object must have a default export');
		}
		if (typeof newComponent === 'function') return newComponent as QwikComponent;
		throw new TypeError('Invalid Qwik component type');
	}

	private cleanupExisting(island: HTMLElement): void {
		const existing = this.containers.get(island);
		if (!existing?.cleanup) return;
		try {
			existing.cleanup();
		} catch (error) {
			console.warn('Failed to clean up existing Qwik container:', error);
		}
	}

	async update(island: HTMLElement, newComponent: unknown, props: Record<string, unknown>): Promise<void> {
		if (!this.canHandle(newComponent)) throw new Error('Component is not a valid Qwik component');
		const Component = this.resolveComponent(newComponent);
		try {
			this.cleanupExisting(island);
			const qwikId = '@builder.io/qwik';
			const qwikModule = (await import(/* @vite-ignore */ qwikId)) as QwikModule & Record<string, unknown>;
			if (qwikModule.render) {
				const jsxNode = typeof qwikModule.jsx === 'function' ? qwikModule.jsx(Component, props) : Component(props);
				await qwikModule.render(island, jsxNode);
			} else {
				console.warn('Qwik render API not available, using innerHTML fallback');
				const result = Component(props);
				if (typeof result === 'string') island.innerHTML = result;
			}
			this.containers.set(island, {});
			island.dataset.hydrated = 'true';
			island.dataset.hydrationStatus = 'success';
		} catch (error) {
			console.error('Qwik HMR update failed:', error);
			island.dataset.hydrationStatus = 'error';
			throw error;
		}
	}

	override restoreState(island: HTMLElement, state: StateSnapshot): void {
		try {
			super.restoreState(island, state);
		} catch (error) {
			console.warn('Failed to restore Qwik state:', error);
		}
	}

	override handleError(island: HTMLElement, error: Error): void {
		console.error('Qwik HMR error:', error);
		super.handleError(island, error);
		const errorIndicator = island.querySelector('.hmr-error-indicator');
		if (errorIndicator) {
			const msg = error.message;
			let hint = '';
			if (msg.includes('component$')) hint = ' (Hint: Ensure component is wrapped with component$())';
			else if (msg.includes('useSignal') || msg.includes('useStore'))
				hint = ' (Hint: Qwik hooks must be called inside component$() body)';
			else if (msg.includes('QRL') || msg.includes('qrl'))
				hint = ' (Hint: Check that lazy-loaded boundaries use $ correctly)';
			else if (msg.includes('serialize') || msg.includes('container'))
				hint = ' (Hint: Ensure all state is serializable)';
			errorIndicator.textContent = `Qwik HMR Error: ${msg}${hint}`;
		}
	}

	private extractComponentName(src: string): string {
		const parts = src.split('/');
		const filename = parts.at(-1) ?? '';
		return filename.replace(/\.qwik\.(tsx?|jsx?)$/, '').replace(/\.(tsx?|jsx?)$/, '');
	}

	unmount(island: HTMLElement): void {
		const container = this.containers.get(island);
		if (container) {
			try {
				if (container.cleanup) container.cleanup();
				this.containers.delete(island);
			} catch (error) {
				console.warn('Failed to unmount Qwik component:', error);
			}
		}
	}
}

export const qwikAdapter = new QwikHMRAdapter();
