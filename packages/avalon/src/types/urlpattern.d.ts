/**
 * Global URLPattern type declaration.
 * URLPattern is available at runtime in Node 22+, Bun, and Deno,
 * but TypeScript's lib.dom.d.ts may not include it in all configurations.
 */
declare class URLPattern {
	constructor(init?: URLPatternInit | string, baseURL?: string);
	readonly protocol: string;
	readonly username: string;
	readonly password: string;
	readonly hostname: string;
	readonly port: string;
	readonly pathname: string;
	readonly search: string;
	readonly hash: string;
	test(input?: URLPatternInput, baseURL?: string): boolean;
	exec(input?: URLPatternInput, baseURL?: string): URLPatternResult | null;
}

interface URLPatternInit {
	baseURL?: string;
	username?: string;
	password?: string;
	hostname?: string;
	port?: string;
	pathname?: string;
	search?: string;
	hash?: string;
	protocol?: string;
}

type URLPatternInput = URLPatternInit | string;

interface URLPatternComponentResult {
	input: string;
	groups: Record<string, string | undefined>;
}

interface URLPatternResult {
	inputs: [URLPatternInput, string?];
	protocol: URLPatternComponentResult;
	username: URLPatternComponentResult;
	password: URLPatternComponentResult;
	hostname: URLPatternComponentResult;
	port: URLPatternComponentResult;
	pathname: URLPatternComponentResult;
	search: URLPatternComponentResult;
	hash: URLPatternComponentResult;
}
