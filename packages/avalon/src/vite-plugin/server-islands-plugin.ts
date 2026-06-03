/**
 * Server Islands Vite Plugin
 *
 * Collects server island components during build by scanning for `server` prop usage
 * in JSX/TSX files. Generates a component manifest mapping componentId → modulePath
 * and embeds the encryption key in the server bundle.
 *
 * Detection:
 *   Any component used with a `server` prop (e.g. `<UserAvatar server={{ fallback: ... }} />`)
 *   is registered as a server island. The component's import path is resolved and hashed
 *   to produce a stable componentId.
 *
 * Outputs:
 *   - A virtual module `virtual:server-island-manifest` that exports the manifest
 *   - A virtual module `virtual:server-island-key` that exports the encryption key
 */

import { dirname, relative, resolve } from "node:path";
import type { Plugin } from "vite";
import { generateKey, getKey } from "../server-islands/encryption.ts";
import {
	addToManifest,
	clearManifest,
	generateComponentId,
	getManifest,
} from "../server-islands/manifest.ts";

const VIRTUAL_MANIFEST_ID = "virtual:server-island-manifest";
const RESOLVED_MANIFEST_ID = "\0" + VIRTUAL_MANIFEST_ID;

const VIRTUAL_KEY_ID = "virtual:server-island-key";
const RESOLVED_KEY_ID = "\0" + VIRTUAL_KEY_ID;

/**
 * Regex to detect `server` prop usage on JSX components.
 * Matches patterns like:
 *   <Component server={{ ... }} />
 *   <Component server={expr} />
 *   <Component server />
 *
 * Uses a non-greedy [\s\S]*? span (not [^>]*) so it still matches when an
 * earlier attribute value contains a `>` character (e.g. label="a>b").
 */
const SERVER_PROP_PATTERN = /<([A-Z][a-zA-Z0-9_$]*)\s[\s\S]*?\bserver\s*[={/>]/;

/**
 * Find all default imports with PascalCase names (component imports).
 */
function findDefaultImports(code: string): Array<{ localName: string; importPath: string }> {
	const imports: Array<{ localName: string; importPath: string }> = [];
	const re = /^[ \t]*import\s+([A-Z]\w*)\s+from\s+(['"][^'"]+['"])/gm;
	let m: RegExpExecArray | null = null;
	for (m = re.exec(code); m !== null; m = re.exec(code)) {
		imports.push({
			localName: m[1],
			importPath: m[2].slice(1, -1),
		});
	}
	return imports;
}

/**
 * Check if a specific component name is used with the `server` prop in the code.
 */
function hasServerPropUsage(code: string, componentName: string): boolean {
	// Match <ComponentName followed by attributes and a `server` prop.
	// Uses a non-greedy [\s\S]*? span (not [^>]*) so it still matches when an
	// earlier attribute value contains a `>` character.
	const pattern = new RegExp(String.raw`<${componentName}\s[\s\S]*?\bserver\s*[={/>]`);
	return pattern.test(code);
}

/**
 * Resolve an import path to a project-relative path suitable for manifest registration.
 * Handles relative imports, alias imports, and absolute imports.
 *
 * Exported so the Nitro integration's source-scanning manifest generator can reuse
 * the EXACT same resolution logic — the resulting path must equal the `src` that
 * `island.tsx` hashes at runtime via `generateComponentId(src)`.
 */
export function resolveToRelativePath(
	importPath: string,
	fileId: string,
	projectRoot: string,
): string {
	// Already project-relative (starts with /src/ or /app/)
	if (importPath.startsWith("/src/") || importPath.startsWith("/app/")) {
		return importPath;
	}

	// Common aliases — resolve to project-relative paths
	if (importPath.startsWith("@/")) return `/app/${importPath.slice(2)}`;
	if (importPath.startsWith("@shared/")) return `/app/shared/${importPath.slice(8)}`;
	if (importPath.startsWith("@modules/")) return `/app/modules/${importPath.slice(9)}`;
	if (importPath.startsWith("~/")) return `/src/${importPath.slice(2)}`;
	if (importPath.startsWith("$components/")) return `/src/components/${importPath.slice(12)}`;
	if (importPath.startsWith("$islands/")) return `/src/islands/${importPath.slice(9)}`;

	// Relative import — resolve relative to the importing file
	if (importPath.startsWith(".")) {
		const fileDir = dirname(fileId);
		const absolutePath = resolve(fileDir, importPath);
		const relativePath = relative(projectRoot, absolutePath);
		// Normalize to forward slashes and prefix with /
		return "/" + relativePath.replaceAll("\\", "/");
	}

	// Fallback: use the import path as-is
	return importPath;
}

export interface ServerIslandsPluginOptions {
	/** Whether to log verbose output */
	verbose?: boolean;
}

/**
 * Vite plugin that collects server island components during build.
 *
 * Responsibilities:
 * 1. Scans for `server` prop usage in JSX/TSX files during transform
 * 2. Registers discovered components in the manifest (componentId → modulePath)
 * 3. Provides virtual modules for the manifest and encryption key
 */
export function serverIslandsPlugin(options: ServerIslandsPluginOptions = {}): Plugin {
	let projectRoot: string;
	let encryptionKey: string;
	// Capture whether AVALON_KEY was provided by the environment BEFORE the config
	// hook generates a per-build fallback, so verbose logging reports the true source.
	const usedEnvKey = Boolean(process.env.AVALON_KEY);

	return {
		name: "avalon:server-islands",
		enforce: "pre" as const,

		config() {
			// Set AVALON_KEY early (before Nitro's environment loads encryption.ts)
			// so all module instances use the same key for encrypt/decrypt.
			if (!process.env.AVALON_KEY) {
				process.env.AVALON_KEY = generateKey();
			}
		},

		configResolved(config) {
			projectRoot = config.root;
		},

		buildStart() {
			// Clear manifest for fresh builds
			clearManifest();

			// Resolve the encryption key once at build start.
			// Uses AVALON_KEY env var (set in config hook above or by user).
			encryptionKey = getKey();

			if (options.verbose) {
				const source = usedEnvKey ? "AVALON_KEY env var" : "generated per-build";
				console.log(`[avalon:server-islands] Encryption key source: ${source}`);
			}
		},

		resolveId(id) {
			if (id === VIRTUAL_MANIFEST_ID) return RESOLVED_MANIFEST_ID;
			if (id === VIRTUAL_KEY_ID) return RESOLVED_KEY_ID;
			if (id === "virtual:server-island-integrations")
				return "\0virtual:server-island-integrations";
			return null;
		},

		load(id) {
			if (id === "\0virtual:server-island-integrations") {
				// In the SSR/client pass, this is a no-op (integrations are loaded
				// via the registry at runtime). The real registration happens in the
				// Nitro virtual module which has the full integration imports.
				return "export {};";
			}
			if (id === RESOLVED_MANIFEST_ID) {
				const manifest = getManifest();
				const entries = Object.entries(manifest);

				// Generate the static manifest mapping componentId → modulePath
				let code = `export const serverIslandManifest = ${JSON.stringify(manifest)};\n\n`;

				// Generate lazy loaders that dynamically import each component.
				// These ensure the bundler sees the components as reachable code
				// and does not tree-shake them from the server bundle.
				code += "export const serverIslandLoaders = {\n";
				for (const [componentId, modulePath] of entries) {
					code += `  ${JSON.stringify(componentId)}: () => import(${JSON.stringify(modulePath)}),\n`;
				}
				code += "};\n";

				return code;
			}
			if (id === RESOLVED_KEY_ID) {
				return `export const serverIslandKey = ${JSON.stringify(encryptionKey)};`;
			}
			return null;
		},

		transform(code: string, id: string) {
			// Only process TSX/JSX files
			if (!/\.(tsx|jsx)$/.test(id)) return null;

			// Skip node_modules
			if (id.includes("node_modules")) return null;

			// Quick check: does the file contain `server` as a prop at all?
			if (!SERVER_PROP_PATTERN.test(code)) return null;

			// Find all component imports
			const imports = findDefaultImports(code);
			if (imports.length === 0) return null;

			// Check each imported component for server prop usage
			for (const imp of imports) {
				if (hasServerPropUsage(code, imp.localName)) {
					const relativePath = resolveToRelativePath(imp.importPath, id, projectRoot);
					const componentId = generateComponentId(relativePath);
					addToManifest(componentId, relativePath);

					if (options.verbose) {
						console.log(
							`[avalon:server-islands] Registered: ${imp.localName} → ${componentId} (${relativePath})`,
						);
					}
				}
			}

			// No code transformation needed — we're just collecting metadata
			return null;
		},

		generateBundle() {
			const manifest = getManifest();
			const count = Object.keys(manifest).length;
			if (count > 0 && options.verbose) {
				console.log(`[avalon:server-islands] Manifest contains ${count} server island(s)`);
			}
		},
	};
}
