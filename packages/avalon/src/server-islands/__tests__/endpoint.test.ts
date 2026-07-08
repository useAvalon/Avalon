import { h } from "preact";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { encrypt, generateKey } from "../encryption.ts";
import { defineServerIslandHandler } from "../endpoint.ts";
import { addToManifest, clearManifest } from "../manifest.ts";

// Mock the virtual:server-island-manifest module.
// In tests, the loaders map is empty so the endpoint falls back to raw import().
vi.mock("virtual:server-island-manifest", () => ({
	serverIslandManifest: {},
	serverIslandLoaders: {},
}));

// Use a stable key for tests
const testKey = generateKey();
const originalKey = process.env.AVALON_KEY;

beforeAll(() => {
	process.env.AVALON_KEY = testKey;
});

afterAll(() => {
	if (originalKey === undefined) {
		delete process.env.AVALON_KEY;
	} else {
		process.env.AVALON_KEY = originalKey;
	}
	clearManifest();
});

/**
 * Creates a minimal H3Event-like object for testing.
 */
function createMockEvent(opts: {
	pathname: string;
	method?: string;
	searchParams?: URLSearchParams;
	body?: string;
	params?: Record<string, string>;
}): any {
	const { pathname, method = "GET", searchParams, body, params } = opts;
	const url = new URL(
		`http://localhost${pathname}${searchParams ? `?${searchParams.toString()}` : ""}`,
	);

	return {
		url,
		req: { method },
		context: { params },
		web: body ? { request: { text: () => Promise.resolve(body) } } : undefined,
	};
}

// A simple test component
function TestComponent(props: Record<string, unknown>) {
	return h("div", { class: "test" }, `Hello ${props.name}`);
}

// A component that throws during rendering
function ThrowingComponent(): never {
	throw new Error("Render explosion");
}

describe("defineServerIslandHandler - core behavior", () => {
	const handler = defineServerIslandHandler({ isDev: true });

	it("returns 200 with rendered HTML and correct headers on successful render", async () => {
		const componentId = "core-success";
		const modulePath = `${import.meta.url}#core-success`;
		addToManifest(componentId, modulePath);

		vi.doMock(modulePath, () => ({ default: TestComponent }));

		const props = { name: "Success" };
		const encryptedProps = encrypt(JSON.stringify(props));

		const event = createMockEvent({
			pathname: `/_server-islands/${componentId}`,
			params: { componentId },
			searchParams: new URLSearchParams({ p: encryptedProps }),
		});

		const response = await handler(event);
		const html = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("text/html");
		expect(response.headers.get("Cache-Control")).toBe("private, no-store");
		expect(html).toContain("Hello Success");
		expect(html).toContain('<div class="test">');
	});

	it("returns 400 when decryption fails (tampered payload)", async () => {
		const componentId = "core-bad-decrypt";
		addToManifest(componentId, "/some/path.ts");

		const event = createMockEvent({
			pathname: `/_server-islands/${componentId}`,
			params: { componentId },
			searchParams: new URLSearchParams({ p: "tampered-invalid-payload" }),
		});

		const response = await handler(event);
		const body = await response.text();

		expect(response.status).toBe(400);
		expect(body).toContain("decryption failed");
	});

	it("returns 404 when component is not found in manifest", async () => {
		const componentId = "nonexistent-component";
		// Do NOT add to manifest — simulate unknown component

		const props = { name: "Ghost" };
		const encryptedProps = encrypt(JSON.stringify(props));

		const event = createMockEvent({
			pathname: `/_server-islands/${componentId}`,
			params: { componentId },
			searchParams: new URLSearchParams({ p: encryptedProps }),
		});

		const response = await handler(event);
		const body = await response.text();

		expect(response.status).toBe(404);
		expect(body).toContain("Component not found");
	});

	it("returns 500 when the component throws during rendering", async () => {
		const componentId = "core-throw";
		const modulePath = `${import.meta.url}#core-throw`;
		addToManifest(componentId, modulePath);

		vi.doMock(modulePath, () => ({ default: ThrowingComponent }));

		const props = { name: "Boom" };
		const encryptedProps = encrypt(JSON.stringify(props));

		const event = createMockEvent({
			pathname: `/_server-islands/${componentId}`,
			params: { componentId },
			searchParams: new URLSearchParams({ p: encryptedProps }),
		});

		const response = await handler(event);
		const body = await response.text();

		expect(response.status).toBe(500);
		expect(body).toContain("Render explosion");
	});
});

describe("defineServerIslandHandler - combined islands", () => {
	const handler = defineServerIslandHandler({ isDev: true });

	it("renders component without hydration script when no __island metadata", async () => {
		// Register a test component
		const componentId = "test-pure";
		const modulePath = import.meta.url;
		addToManifest(componentId, modulePath);

		// Mock the dynamic import
		vi.doMock(modulePath, () => ({ default: TestComponent }));

		const props = { name: "World" };
		const encryptedProps = encrypt(JSON.stringify(props));

		const event = createMockEvent({
			pathname: `/_server-islands/${componentId}`,
			params: { componentId },
			searchParams: new URLSearchParams({ p: encryptedProps }),
		});

		const response = await handler(event);
		const html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain("Hello World");
		expect(html).not.toContain('<script type="module">');
	});

	it("appends hydration script when __island metadata is present", async () => {
		const componentId = "test-combined";
		const modulePath = import.meta.url;
		addToManifest(componentId, modulePath);

		vi.doMock(modulePath, () => ({ default: TestComponent }));

		const props = {
			name: "Combined",
			__island: {
				condition: "on:visible",
				framework: "preact",
				componentSrc: "/islands/TestComponent.js",
			},
		};
		const encryptedProps = encrypt(JSON.stringify(props));

		const event = createMockEvent({
			pathname: `/_server-islands/${componentId}`,
			params: { componentId },
			searchParams: new URLSearchParams({ p: encryptedProps }),
		});

		const response = await handler(event);
		const html = await response.text();

		expect(response.status).toBe(200);
		// Should contain the rendered component
		expect(html).toContain("Hello Combined");
		// Should contain the hydration script
		expect(html).toContain('<script type="module">');
		// Should reference the component source
		expect(html).toContain("/islands/TestComponent.js");
		// Should use the island ID pattern
		expect(html).toContain(`si-${componentId}`);
		// Should pass the on:visible condition to the hydration helper
		// (the IntersectionObserver logic lives in server-island-hydrate.ts)
		expect(html).toContain('"on:visible"');
		expect(html).toContain("hydrateServerIsland");
	});

	it("uses modulePath as fallback when componentSrc is not provided in __island", async () => {
		const componentId = "test-no-src";
		const modulePath = import.meta.url;
		addToManifest(componentId, modulePath);

		vi.doMock(modulePath, () => ({ default: TestComponent }));

		const props = {
			name: "NoSrc",
			__island: {
				condition: "on:client",
				framework: "preact",
				// No componentSrc — should fall back to modulePath
			},
		};
		const encryptedProps = encrypt(JSON.stringify(props));

		const event = createMockEvent({
			pathname: `/_server-islands/${componentId}`,
			params: { componentId },
			searchParams: new URLSearchParams({ p: encryptedProps }),
		});

		const response = await handler(event);
		const html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain("Hello NoSrc");
		expect(html).toContain('<script type="module">');
		// Should fall back to the modulePath
		expect(html).toContain(modulePath);
	});

	it("strips __island from props before rendering the component", async () => {
		const componentId = "test-strip";
		const modulePath = import.meta.url;
		addToManifest(componentId, modulePath);

		// Component that would render __island if it were in props
		function PropsInspector(props: Record<string, unknown>) {
			return h("div", null, JSON.stringify(props));
		}

		vi.doMock(modulePath, () => ({ default: PropsInspector }));

		const props = {
			name: "Test",
			__island: {
				condition: "on:idle",
				framework: "preact",
				componentSrc: "/islands/Test.js",
			},
		};
		const encryptedProps = encrypt(JSON.stringify(props));

		const event = createMockEvent({
			pathname: `/_server-islands/${componentId}`,
			params: { componentId },
			searchParams: new URLSearchParams({ p: encryptedProps }),
		});

		const response = await handler(event);
		const html = await response.text();

		expect(response.status).toBe(200);
		// The rendered component should NOT see __island in its props
		expect(html).not.toContain('"__island"');
		// But should see the actual props
		expect(html).toContain('"name":"Test"');
	});

	it("passes conditionArg to the hydration script when provided", async () => {
		const componentId = "test-arg";
		const modulePath = import.meta.url;
		addToManifest(componentId, modulePath);

		vi.doMock(modulePath, () => ({ default: TestComponent }));

		const props = {
			name: "WithArg",
			__island: {
				condition: "on:delay",
				conditionArg: "3000",
				framework: "preact",
				componentSrc: "/islands/Delayed.js",
			},
		};
		const encryptedProps = encrypt(JSON.stringify(props));

		const event = createMockEvent({
			pathname: `/_server-islands/${componentId}`,
			params: { componentId },
			searchParams: new URLSearchParams({ p: encryptedProps }),
		});

		const response = await handler(event);
		const html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain('<script type="module">');
		expect(html).toContain("/islands/Delayed.js");
	});

	it("serializes component props (without __island) in the hydration script propsJson", async () => {
		const componentId = "test-props-json";
		const modulePath = import.meta.url;
		addToManifest(componentId, modulePath);

		vi.doMock(modulePath, () => ({ default: TestComponent }));

		const props = {
			name: "PropsTest",
			count: 42,
			__island: {
				condition: "on:client",
				framework: "preact",
				componentSrc: "/islands/Counter.js",
			},
		};
		const encryptedProps = encrypt(JSON.stringify(props));

		const event = createMockEvent({
			pathname: `/_server-islands/${componentId}`,
			params: { componentId },
			searchParams: new URLSearchParams({ p: encryptedProps }),
		});

		const response = await handler(event);
		const html = await response.text();

		expect(response.status).toBe(200);
		// The hydration script should contain the props JSON (without __island)
		expect(html).toContain('"name":"PropsTest"');
		expect(html).toContain('"count":42');
	});
});

// A simple test component for POST body tests (outer scope)
function PostComponent(props: Record<string, unknown>) {
	return h("div", { class: "post" }, `Hello ${props.name}`);
}

describe("defineServerIslandHandler - POST body reading across environments", () => {
	const handler = defineServerIslandHandler({ isDev: true });

	it("reads the body from a web standard Request (event.web.request)", async () => {
		const componentId = "post-web";
		const modulePath = `${import.meta.url}#post-web`;
		addToManifest(componentId, modulePath);
		vi.doMock(modulePath, () => ({ default: PostComponent }));

		const props = { name: "WebRequest" };
		const encrypted = encrypt(JSON.stringify(props));

		const event: any = {
			url: new URL(`http://localhost/_server-islands/${componentId}`),
			req: { method: "POST" },
			context: { params: { componentId } },
			web: { request: { text: () => Promise.resolve(encrypted) } },
		};

		const response = await handler(event);
		const html = await response.text();
		expect(response.status).toBe(200);
		expect(html).toContain("Hello WebRequest");
	});

	it("reads the body from a Node IncomingMessage stream (event.node.req)", async () => {
		const componentId = "post-node";
		const modulePath = `${import.meta.url}#post-node`;
		addToManifest(componentId, modulePath);
		vi.doMock(modulePath, () => ({ default: PostComponent }));

		const props = { name: "NodeStream" };
		const encrypted = encrypt(JSON.stringify(props));

		// Minimal Node IncomingMessage stub that emits the body via events,
		// asserting readNodeRequestBody's stream path is exercised.
		const listeners: Record<string, ((arg?: unknown) => void)[]> = {};
		const nodeReq = {
			on(eventName: string, cb: (arg?: unknown) => void) {
				if (!listeners[eventName]) listeners[eventName] = [];
				listeners[eventName].push(cb);
				return this;
			},
		};

		const event: any = {
			url: new URL(`http://localhost/_server-islands/${componentId}`),
			req: { method: "POST" },
			context: { params: { componentId } },
			node: { req: nodeReq },
		};

		const responsePromise = handler(event);

		// Drive the stream after the handler has attached its listeners.
		await new Promise((r) => setTimeout(r, 0));
		listeners.data?.forEach((cb) => cb(Buffer.from(encrypted, "utf8")));
		listeners.end?.forEach((cb) => cb());

		const response = await responsePromise;
		const html = await response.text();
		expect(response.status).toBe(200);
		expect(html).toContain("Hello NodeStream");
	});

	it("reads an already-parsed body (event._body)", async () => {
		const componentId = "post-parsed";
		const modulePath = `${import.meta.url}#post-parsed`;
		addToManifest(componentId, modulePath);
		vi.doMock(modulePath, () => ({ default: PostComponent }));

		const props = { name: "ParsedBody" };
		const encrypted = encrypt(JSON.stringify(props));

		const event: any = {
			url: new URL(`http://localhost/_server-islands/${componentId}`),
			req: { method: "POST" },
			context: { params: { componentId } },
			_body: encrypted,
		};

		const response = await handler(event);
		const html = await response.text();
		expect(response.status).toBe(200);
		expect(html).toContain("Hello ParsedBody");
	});
});

// Builds an unencrypted "dev." payload (the format the renderer emits only in
// development). A production endpoint must NOT honor it.
function devPayload(obj: Record<string, unknown>): string {
	return `dev.${Buffer.from(JSON.stringify(obj), "utf8").toString("base64url")}`;
}

describe("defineServerIslandHandler - security: dev-payload bypass", () => {
	it("rejects a dev-prefixed (unencrypted) payload in production", async () => {
		const prodHandler = defineServerIslandHandler({ isDev: false });
		const componentId = "not-in-manifest";
		const payload = devPayload({ __src: "node:child_process", name: "x" });

		const event = createMockEvent({
			pathname: `/_server-islands/${componentId}`,
			params: { componentId },
			searchParams: new URLSearchParams({ p: payload }),
		});

		const response = await prodHandler(event);

		// The dev branch is not taken in prod: the payload falls through to
		// decrypt(), fails the GCM auth check, and is rejected — the attacker's
		// __src is never used to import a module.
		expect(response.status).toBe(400);
		expect(await response.text()).toBe("Bad Request: decryption failed");
	});

	it("still accepts a dev-prefixed payload in development", async () => {
		const devHandler = defineServerIslandHandler({ isDev: true });
		const componentId = "dev-accepts";
		const modulePath = `${import.meta.url}#dev-accepts`;
		addToManifest(componentId, modulePath);
		vi.doMock(modulePath, () => ({ default: TestComponent }));

		const event = createMockEvent({
			pathname: `/_server-islands/${componentId}`,
			params: { componentId },
			searchParams: new URLSearchParams({ p: devPayload({ name: "DevMode" }) }),
		});

		const response = await devHandler(event);
		expect(response.status).toBe(200);
		expect(await response.text()).toContain("Hello DevMode");
	});
});
