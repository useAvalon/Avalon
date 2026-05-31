/**
 * Tests for CSS HMR Handler
 */

import { describe, expect, it } from "vitest";
import { CSSHMRHandler, getCSSHMRHandler } from "../css-hmr-handler.ts";
import type { Update } from "../hmr-coordinator.ts";

// Mock DOM environment for testing
class MockDocument {
	private listeners: Map<string, Array<(event: Event) => void>> = new Map();
	private elements: MockHTMLElement[] = [];
	head: { appendChild: (el: any) => void; querySelector: (selector: string) => any } = {
		appendChild: () => {},
		querySelector: () => null,
	};

	addEventListener(event: string, callback: (event: Event) => void): void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, []);
		}
		this.listeners.get(event)!.push(callback);
	}

	dispatchEvent(event: Event): void {
		const callbacks = this.listeners.get(event.type) || [];
		for (const callback of callbacks) {
			callback(event);
		}
	}

	querySelector<T extends Element>(selector: string): T | null {
		return null;
	}

	querySelectorAll<T extends Element>(selector: string): T[] {
		const filtered = this.elements.filter((el) => {
			if (selector === "[data-src]") {
				return el.hasAttribute("data-src");
			}
			return false;
		});
		return filtered as unknown as T[];
	}

	addElement(element: MockHTMLElement): void {
		this.elements.push(element);
	}

	clearElements(): void {
		this.elements = [];
	}

	clearListeners(): void {
		this.listeners.clear();
	}
}

class MockHTMLElement {
	private attributes: Map<string, string> = new Map();
	private listeners: Map<string, Array<(event: Event) => void>> = new Map();

	getAttribute(name: string): string | null {
		return this.attributes.get(name) || null;
	}

	setAttribute(name: string, value: string): void {
		this.attributes.set(name, value);
	}

	removeAttribute(name: string): void {
		this.attributes.delete(name);
	}

	hasAttribute(name: string): boolean {
		return this.attributes.has(name);
	}

	addEventListener(event: string, callback: (event: Event) => void): void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, []);
		}
		this.listeners.get(event)!.push(callback);
	}

	dispatchEvent(event: Event): void {
		const callbacks = this.listeners.get(event.type) || [];
		for (const callback of callbacks) {
			callback(event);
		}
	}
}

class MockCustomEvent extends Event {
	detail: any;

	constructor(type: string, options?: { detail?: any; bubbles?: boolean }) {
		super(type, options);
		this.detail = options?.detail;
	}
}

// Setup mock global document
const mockDocument = new MockDocument();
(globalThis as any).document = mockDocument;
(globalThis as any).CustomEvent = MockCustomEvent;

describe("CSSHMRHandler - Global CSS Updates", () => {
	it("should handle global CSS update", async () => {
		mockDocument.clearListeners();

		const handler = new CSSHMRHandler();
		const update: Update = {
			type: "css-update",
			path: "/src/styles/global.css",
			acceptedPath: "/src/styles/global.css",
			timestamp: Date.now(),
		};

		let eventFired = false;
		let eventDetail: any = null;
		mockDocument.addEventListener("css-hmr-update", (e: Event) => {
			const customEvent = e as MockCustomEvent;
			eventFired = true;
			eventDetail = customEvent.detail;
		});

		await handler.handleCSSUpdate(update);

		expect(eventFired).toBe(true);
		expect(eventDetail.type).toBe("global");
		expect(eventDetail.success).toBe(true);
		handler.clearCache();
	});
});

describe("CSSHMRHandler - CSS Module Updates", () => {
	it("should identify CSS module updates", async () => {
		mockDocument.clearListeners();
		mockDocument.clearElements();

		// Add an island so the event fires
		const mockIsland = new MockHTMLElement();
		mockIsland.setAttribute("data-src", "/src/islands/TestComponent.tsx");
		mockDocument.addElement(mockIsland);

		const handler = new CSSHMRHandler();
		const update: Update = {
			type: "css-update",
			path: "/src/islands/TestComponent.module.css",
			acceptedPath: "/src/islands/TestComponent.module.css",
			timestamp: Date.now(),
		};

		let eventFired = false;
		let eventDetail: any = null;
		mockDocument.addEventListener("css-hmr-update", (e: Event) => {
			const customEvent = e as MockCustomEvent;
			eventFired = true;
			eventDetail = customEvent.detail;
		});

		await handler.handleCSSUpdate(update);

		expect(eventFired).toBe(true);
		expect(eventDetail.type).toBe("module");
		handler.clearCache();
		mockDocument.clearElements();
	});

	it("should find islands using CSS module in same directory", async () => {
		mockDocument.clearElements();
		mockDocument.clearListeners();

		const mockIsland = new MockHTMLElement();
		mockIsland.setAttribute("data-src", "/src/islands/TestComponent.tsx");
		mockIsland.setAttribute("data-framework", "react");
		mockIsland.setAttribute("data-hydrated", "true");
		mockDocument.addElement(mockIsland);

		const handler = new CSSHMRHandler();
		const update: Update = {
			type: "css-update",
			path: "/src/islands/TestComponent.module.css",
			acceptedPath: "/src/islands/TestComponent.module.css",
			timestamp: Date.now(),
		};

		let rerenderEventFired = false;
		mockIsland.addEventListener("hmr-update-required", (e: Event) => {
			const customEvent = e as MockCustomEvent;
			rerenderEventFired = true;
			expect(customEvent.detail.reason).toBe("css-module-update");
		});

		await handler.handleCSSUpdate(update);

		expect(rerenderEventFired).toBe(true);
		handler.clearCache();
		mockDocument.clearElements();
	});

	it("should handle CSS module with no affected islands", async () => {
		mockDocument.clearElements();

		const handler = new CSSHMRHandler();
		const update: Update = {
			type: "css-update",
			path: "/src/other/Unrelated.module.css",
			acceptedPath: "/src/other/Unrelated.module.css",
			timestamp: Date.now(),
		};

		// Should not throw error
		await handler.handleCSSUpdate(update);
		handler.clearCache();
	});
});

describe("CSSHMRHandler - Scoped CSS Updates", () => {
	it("should identify scoped CSS updates for Svelte", async () => {
		mockDocument.clearListeners();
		mockDocument.clearElements();

		// Add an island so the event fires
		const mockIsland = new MockHTMLElement();
		mockIsland.setAttribute("data-src", "/src/islands/TestComponent.svelte");
		mockDocument.addElement(mockIsland);

		const handler = new CSSHMRHandler();
		const update: Update = {
			type: "css-update",
			path: "/src/islands/TestComponent.svelte",
			acceptedPath: "/src/islands/TestComponent.svelte",
			timestamp: Date.now(),
		};

		let eventFired = false;
		let eventDetail: any = null;
		mockDocument.addEventListener("css-hmr-update", (e: Event) => {
			const customEvent = e as MockCustomEvent;
			eventFired = true;
			eventDetail = customEvent.detail;
		});

		await handler.handleCSSUpdate(update);

		expect(eventFired).toBe(true);
		expect(eventDetail.type).toBe("scoped");
		handler.clearCache();
		mockDocument.clearElements();
	});

	it("should identify scoped CSS updates for Vue", async () => {
		mockDocument.clearListeners();
		mockDocument.clearElements();

		// Add an island so the event fires
		const mockIsland = new MockHTMLElement();
		mockIsland.setAttribute("data-src", "/src/islands/TestComponent.vue");
		mockDocument.addElement(mockIsland);

		const handler = new CSSHMRHandler();
		const update: Update = {
			type: "css-update",
			path: "/src/islands/TestComponent.vue",
			acceptedPath: "/src/islands/TestComponent.vue",
			timestamp: Date.now(),
		};

		let eventFired = false;
		let eventDetail: any = null;
		mockDocument.addEventListener("css-hmr-update", (e: Event) => {
			const customEvent = e as MockCustomEvent;
			eventFired = true;
			eventDetail = customEvent.detail;
		});

		await handler.handleCSSUpdate(update);

		expect(eventFired).toBe(true);
		expect(eventDetail.type).toBe("scoped");
		handler.clearCache();
		mockDocument.clearElements();
	});
});

describe("CSSHMRHandler - CSS Module Registration", () => {
	it("should register CSS module usage explicitly", async () => {
		mockDocument.clearElements();
		mockDocument.clearListeners();

		const mockIsland = new MockHTMLElement();
		mockIsland.setAttribute("data-src", "/src/islands/TestComponent.tsx");
		mockDocument.addElement(mockIsland);

		const handler = new CSSHMRHandler();
		handler.registerCSSModuleUsage("/src/islands/Test.module.css", mockIsland as any);

		const update: Update = {
			type: "css-update",
			path: "/src/islands/Test.module.css",
			acceptedPath: "/src/islands/Test.module.css",
			timestamp: Date.now(),
		};

		let eventFired = false;
		mockIsland.addEventListener("hmr-update-required", () => {
			eventFired = true;
		});

		await handler.handleCSSUpdate(update);

		expect(eventFired).toBe(true);
		handler.clearCache();
		mockDocument.clearElements();
	});
});

describe("CSSHMRHandler - Cache Management", () => {
	it("should clear cache", async () => {
		mockDocument.clearElements();

		const mockIsland = new MockHTMLElement();
		mockIsland.setAttribute("data-src", "/src/islands/TestComponent.tsx");
		mockDocument.addElement(mockIsland);

		const handler = new CSSHMRHandler();
		handler.registerCSSModuleUsage("/src/test.module.css", mockIsland as any);
		handler.clearCache();

		const update: Update = {
			type: "css-update",
			path: "/src/test.module.css",
			acceptedPath: "/src/test.module.css",
			timestamp: Date.now(),
		};

		let eventFired = false;
		mockIsland.addEventListener("hmr-update-required", () => {
			eventFired = true;
		});

		await handler.handleCSSUpdate(update);

		// Should not find the island after cache clear
		expect(eventFired).toBe(false);
		handler.clearCache();
		mockDocument.clearElements();
	});
});

describe("CSSHMRHandler - Singleton Instance", () => {
	it("should return same instance from getCSSHMRHandler", () => {
		const instance1 = getCSSHMRHandler();
		const instance2 = getCSSHMRHandler();

		expect(instance1).toBe(instance2);
	});
});
