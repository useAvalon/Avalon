/**
 * React HMR Adapter
 *
 * Provides Hot Module Replacement support for React components using React Fast Refresh.
 * Integrates with @vitejs/plugin-react to preserve hooks state and component tree during updates.
 */

/// <reference lib="dom" />

import { BaseFrameworkAdapter, type StateSnapshot } from '@useavalon/avalon/client/hmr';

type ReactComponent<P = Record<string, unknown>> =
	| ((props: P) => ReactElement | null)
	| (new (props: P) => ReactClassComponent);

interface ReactClassComponent {
	render(): ReactElement | null;
	isReactComponent?: boolean;
}

interface ReactElement {
	type: string | ReactComponent;
	props: Record<string, unknown>;
	key: string | number | null;
}

interface ReactRoot {
	render(element: ReactElement | null): void;
	unmount(): void;
}

interface ReactModule {
	createElement<P = Record<string, unknown>>(
		component: ReactComponent<P>,
		props: P | null,
		...children: unknown[]
	): ReactElement;
}

interface ReactDOMClientModule {
	hydrateRoot(
		container: HTMLElement,
		element: ReactElement,
		options?: { onRecoverableError?: (error: Error) => void },
	): ReactRoot;
}

interface ReactStateSnapshot extends StateSnapshot {
	framework: 'react';
	data: {
		fiberData?: unknown;
		componentName?: string;
		capturedProps?: Record<string, unknown>;
	};
}

export class ReactHMRAdapter extends BaseFrameworkAdapter {
	readonly name = 'react';
	private readonly roots: WeakMap<HTMLElement, ReactRoot> = new WeakMap();

	canHandle(component: unknown): boolean {
		if (!component) return false;
		if (typeof component === 'function') {
			const proto = (component as { prototype?: Record<string, unknown> }).prototype;
			if (proto?.isReactComponent) return true;
			if ((component as unknown as Record<string, unknown>).$typeof) return true;
			return true;
		}
		if (typeof component !== 'object') return false;
		const obj = component as Record<string, unknown>;
		if (obj.$typeof) return true;
		if (obj.type && typeof obj.type === 'function') return true;
		return false;
	}

	override preserveState(island: HTMLElement): ReactStateSnapshot | null {
		try {
			const baseSnapshot = super.preserveState(island);
			if (!baseSnapshot) return null;
			const capturedProps = island.dataset.props ? JSON.parse(island.dataset.props) : {};
			const componentName = this.extractComponentName(island.dataset.src || '');
			return { ...baseSnapshot, framework: 'react', data: { componentName, capturedProps } };
		} catch (error) {
			console.warn('Failed to preserve React state:', error);
			return null;
		}
	}

	async update(island: HTMLElement, newComponent: unknown, props: Record<string, unknown>): Promise<void> {
		if (!this.canHandle(newComponent)) throw new Error('Component is not a valid React component');
		const Component = newComponent as ReactComponent;
		try {
			const [reactModule, reactDOMModule] = await Promise.all([
				import('react') as Promise<ReactModule>,
				import('react-dom/client') as Promise<ReactDOMClientModule>,
			]);
			const { createElement } = reactModule;
			const { hydrateRoot } = reactDOMModule;
			const existingRoot = this.roots.get(island);
			if (existingRoot) {
				existingRoot.render(createElement(Component, props));
			} else {
				const element = createElement(Component, props);
				const newRoot = hydrateRoot(island, element, {
					onRecoverableError: (error: Error) => console.warn('React hydration recoverable error during HMR:', error),
				});
				this.roots.set(island, newRoot);
			}
			island.dataset.hydrated = 'true';
			island.dataset.hydrationStatus = 'success';
		} catch (error) {
			console.error('React HMR update failed:', error);
			island.dataset.hydrationStatus = 'error';
			throw error;
		}
	}

	override restoreState(island: HTMLElement, state: StateSnapshot): void {
		try {
			super.restoreState(island, state);
		} catch (error) {
			console.warn('Failed to restore React state:', error);
		}
	}

	override handleError(island: HTMLElement, error: Error): void {
		console.error('React HMR error:', error);
		super.handleError(island, error);
		const errorIndicator = island.querySelector('.hmr-error-indicator');
		if (errorIndicator) {
			const msg = error.message;
			let hint = '';
			if (msg.includes('hooks')) hint = ' (Hint: Check hooks usage - hooks must be called in the same order)';
			else if (msg.includes('render')) hint = ' (Hint: Check component render method for errors)';
			else if (msg.includes('hydration')) hint = ' (Hint: Server and client render must match)';
			errorIndicator.textContent = `React HMR Error: ${msg}${hint}`;
		}
	}

	private extractComponentName(src: string): string {
		const parts = src.split('/');
		const filename = parts.at(-1) ?? '';
		return filename.replace(/\.(tsx?|jsx?)$/, '');
	}

	unmount(island: HTMLElement): void {
		const root = this.roots.get(island);
		if (root) {
			try {
				root.unmount();
				this.roots.delete(island);
			} catch (error) {
				console.warn('Failed to unmount React root:', error);
			}
		}
	}
}

export const reactAdapter = new ReactHMRAdapter();
