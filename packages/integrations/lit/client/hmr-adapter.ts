/**
 * Lit HMR Adapter
 *
 * Provides Hot Module Replacement support for Lit components.
 * Handles custom element re-registration and updates all element instances.
 * Preserves element properties across updates.
 */

/// <reference lib="dom" />

import { BaseFrameworkAdapter, type StateSnapshot } from '@useavalon/avalon/client/hmr';

interface LitElementConstructor {
	new (): LitElementInstance;
	elementName?: string;
}

interface LitElementInstance extends HTMLElement {
	_$litElement$?: unknown;
	requestUpdate?(): void;
	updateComplete?: Promise<boolean>;
}

interface LitStateSnapshot extends StateSnapshot {
	framework: 'lit';
	data: {
		elementProperties?: Record<string, unknown>;
		elementAttributes?: Record<string, string>;
		componentName?: string;
		tagName?: string;
		capturedProps?: Record<string, unknown>;
	};
}

export class LitHMRAdapter extends BaseFrameworkAdapter {
	readonly name = 'lit';
	private readonly elementConstructors: WeakMap<HTMLElement, LitElementConstructor> = new WeakMap();
	private readonly tagNames: WeakMap<HTMLElement, string> = new WeakMap();

	canHandle(component: unknown): boolean {
		if (!component) return false;
		if (typeof component === 'function') {
			const comp = component as unknown as Record<string, unknown>;
			if (comp.__litElement) return true;
			try {
				const proto = (component as { prototype?: Record<string, unknown> }).prototype;
				if (proto) {
					if ('render' in proto && 'requestUpdate' in proto && 'updateComplete' in proto) return true;
					let currentProto = proto;
					while (currentProto && currentProto !== Object.prototype) {
						const constructor = currentProto.constructor as { name?: string };
						if (constructor?.name === 'LitElement') return true;
						currentProto = Object.getPrototypeOf(currentProto);
					}
				}
			} catch {
				/* ignore */
			}
			if (comp.elementName || comp.tagName) return true;
			try {
				const funcStr = component.toString();
				if (
					funcStr.includes('LitElement') ||
					funcStr.includes('customElement') ||
					funcStr.includes('html`') ||
					funcStr.includes('css`') ||
					funcStr.includes('render()') ||
					funcStr.includes('requestUpdate')
				)
					return true;
			} catch {
				/* ignore */
			}
		}
		if (typeof component !== 'object' || component === null) return false;
		const obj = component as Record<string, unknown>;
		if (obj.default && typeof obj.default === 'function') return this.canHandle(obj.default);
		if (obj.__litElement) return true;
		return false;
	}

	override preserveState(island: HTMLElement): LitStateSnapshot | null {
		try {
			const baseSnapshot = super.preserveState(island);
			if (!baseSnapshot) return null;
			const propsAttr = island.dataset.props;
			const capturedProps = propsAttr ? JSON.parse(propsAttr) : {};
			const src = island.dataset.src || '';
			const componentName = this.extractComponentName(src);
			const tagName = island.dataset.tagName || this.tagNames.get(island);
			const litElement = tagName
				? (island.querySelector(tagName) as LitElementInstance)
				: (island.querySelector('[data-lit-element]') as LitElementInstance);
			const elementProperties: Record<string, unknown> = {};
			const elementAttributes: Record<string, string> = {};
			if (litElement) {
				for (const key in litElement) {
					if (litElement.hasOwnProperty(key) && !key.startsWith('_')) {
						try {
							const value = litElement[key as keyof LitElementInstance];
							if (value !== undefined && value !== null && typeof value !== 'function' && typeof value !== 'symbol')
								elementProperties[key] = value;
						} catch {
							/* skip */
						}
					}
				}
				for (const attr of litElement.attributes) elementAttributes[attr.name] = attr.value;
			}
			return {
				...baseSnapshot,
				framework: 'lit',
				data: { componentName, tagName: tagName || undefined, capturedProps, elementProperties, elementAttributes },
			};
		} catch (error) {
			console.warn('Failed to preserve Lit state:', error);
			return null;
		}
	}

	async update(island: HTMLElement, newComponent: unknown, props: Record<string, unknown>): Promise<void> {
		if (!this.canHandle(newComponent)) throw new Error('Component is not a valid Lit component');
		let ElementClass: LitElementConstructor;
		if (typeof newComponent === 'object' && newComponent !== null) {
			const obj = newComponent as Record<string, unknown>;
			if (obj.default && typeof obj.default === 'function') ElementClass = obj.default as LitElementConstructor;
			else throw new Error('Lit component object must have a default export');
		} else if (typeof newComponent === 'function') {
			ElementClass = newComponent as LitElementConstructor;
		} else {
			throw new TypeError('Invalid Lit component type');
		}
		try {
			let tagName = island.dataset.tagName ?? null;
			if (!tagName) tagName = (ElementClass as unknown as Record<string, unknown>).elementName as string;
			if (!tagName) tagName = ElementClass.name.replaceAll(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
			if (!tagName?.includes('-')) throw new Error('Invalid custom element tag name: ' + tagName);
			this.tagNames.set(island, tagName);
			island.dataset.tagName = tagName;
			const elements = Array.from(island.querySelectorAll(tagName)) as LitElementInstance[];
			if (elements.length === 0) {
				const existingDefinition = customElements.get(tagName);
				if (!existingDefinition) customElements.define(tagName, ElementClass as CustomElementConstructor);
				const newElement = document.createElement(tagName) as LitElementInstance;
				for (const [key, value] of Object.entries(props)) {
					try {
						(newElement as unknown as Record<string, unknown>)[key] = value;
					} catch (error) {
						console.warn(`Failed to set property ${key} on Lit element:`, error);
					}
				}
				island.appendChild(newElement);
				this.elementConstructors.set(island, ElementClass);
				island.dataset.hydrated = 'true';
				island.dataset.hydrationStatus = 'success';
				return;
			}
			const existingDefinition = customElements.get(tagName);
			if (existingDefinition && existingDefinition !== ElementClass) {
				console.warn(`Custom element ${tagName} is already defined. Replacing all instances with new definition.`);
				for (const oldElement of elements) {
					const properties: Record<string, unknown> = {};
					const attributes: Record<string, string> = {};
					for (const key in oldElement) {
						if (oldElement.hasOwnProperty(key) && !key.startsWith('_')) {
							try {
								const value = oldElement[key as keyof LitElementInstance];
								if (value !== undefined && value !== null && typeof value !== 'function' && typeof value !== 'symbol')
									properties[key] = value;
							} catch {
								/* skip */
							}
						}
					}
					for (const attr of oldElement.attributes) attributes[attr.name] = attr.value;
					const newElement = document.createElement(tagName) as LitElementInstance;
					for (const [name, value] of Object.entries(attributes)) newElement.setAttribute(name, value);
					for (const [key, value] of Object.entries(properties)) {
						try {
							(newElement as unknown as Record<string, unknown>)[key] = value;
						} catch (error) {
							console.warn(`Failed to restore property ${key}:`, error);
						}
					}
					oldElement.parentNode?.replaceChild(newElement, oldElement);
				}
			} else if (!existingDefinition) {
				customElements.define(tagName, ElementClass as CustomElementConstructor);
				for (const element of elements) {
					if (element.requestUpdate) element.requestUpdate();
				}
			} else {
				for (const element of elements) {
					for (const [key, value] of Object.entries(props)) {
						try {
							(element as unknown as Record<string, unknown>)[key] = value;
						} catch (error) {
							console.warn(`Failed to update property ${key}:`, error);
						}
					}
					if (element.requestUpdate) element.requestUpdate();
				}
			}
			this.elementConstructors.set(island, ElementClass);
			island.dataset.hydrated = 'true';
			island.dataset.hydrationStatus = 'success';
		} catch (error) {
			console.error('Lit HMR update failed:', error);
			island.dataset.hydrationStatus = 'error';
			throw error;
		}
	}

	override restoreState(island: HTMLElement, state: StateSnapshot): void {
		try {
			super.restoreState(island, state);
			const litState = state as LitStateSnapshot;
			const tagName = litState.data.tagName;
			if (tagName) {
				const litElement = island.querySelector(tagName) as LitElementInstance;
				if (litElement) {
					if (litState.data.elementProperties) {
						for (const [key, value] of Object.entries(litState.data.elementProperties)) {
							try {
								(litElement as unknown as Record<string, unknown>)[key] = value;
							} catch (error) {
								console.warn(`Failed to restore property ${key}:`, error);
							}
						}
					}
					if (litState.data.elementAttributes) {
						for (const [name, value] of Object.entries(litState.data.elementAttributes)) {
							try {
								litElement.setAttribute(name, value);
							} catch (error) {
								console.warn(`Failed to restore attribute ${name}:`, error);
							}
						}
					}
					if (litElement.requestUpdate) litElement.requestUpdate();
				}
			}
		} catch (error) {
			console.warn('Failed to restore Lit state:', error);
		}
	}

	override handleError(island: HTMLElement, error: Error): void {
		console.error('Lit HMR error:', error);
		super.handleError(island, error);
		const errorIndicator = island.querySelector('.hmr-error-indicator');
		if (errorIndicator) {
			const msg = error.message;
			let hint = '';
			if (msg.includes('custom element') || msg.includes('define'))
				hint = ' (Hint: Check that your element has a valid tag name with a hyphen)';
			else if (msg.includes('tag name')) hint = ' (Hint: Custom element tag names must contain a hyphen)';
			else if (msg.includes('property') || msg.includes('attribute'))
				hint = ' (Hint: Check @property decorators and attribute names)';
			else if (msg.includes('render')) hint = ' (Hint: Check the render() method for errors)';
			errorIndicator.textContent = `Lit HMR Error: ${msg}${hint}`;
		}
	}

	private extractComponentName(src: string): string {
		const parts = src.split('/');
		const filename = parts.at(-1) ?? '';
		return filename.replace(/\.lit\.(ts|js)$/, '').replace(/\.(ts|js)$/, '');
	}

	unmount(island: HTMLElement): void {
		try {
			const tagName = this.tagNames.get(island);
			if (tagName) {
				island.querySelectorAll(tagName).forEach(element => element.remove());
				this.tagNames.delete(island);
			}
			this.elementConstructors.delete(island);
		} catch (error) {
			console.warn('Failed to unmount Lit element:', error);
		}
	}
}

export const litAdapter = new LitHMRAdapter();
