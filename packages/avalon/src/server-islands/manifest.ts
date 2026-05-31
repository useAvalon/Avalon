import { createHash } from "node:crypto";

/**
 * Generates a stable 12-character component ID from a module's relative path.
 * Uses base64url(sha256(relativePath)).slice(0, 12) for brevity and URL safety.
 */
export function generateComponentId(relativePath: string): string {
	const hash = createHash("sha256").update(relativePath).digest("base64url");
	return hash.slice(0, 12);
}

/**
 * Internal manifest store mapping componentId → modulePath.
 * Populated at build time, queried at runtime.
 */
const manifest = new Map<string, string>();

/**
 * Registers a component in the manifest at build time.
 *
 * @param componentId - The hashed component identifier
 * @param modulePath - The relative module path to the component
 */
export function addToManifest(componentId: string, modulePath: string): void {
	manifest.set(componentId, modulePath);
}

/**
 * Looks up a component's module path by its ID at runtime.
 *
 * @param componentId - The hashed component identifier
 * @returns The module path if found, or undefined
 */
export function lookupComponent(componentId: string): string | undefined {
	return manifest.get(componentId);
}

/**
 * Returns the full manifest as a plain object for serialization into the server bundle.
 */
export function getManifest(): Record<string, string> {
	return Object.fromEntries(manifest);
}

/**
 * Clears the manifest. Useful for testing or rebuilds.
 */
export function clearManifest(): void {
	manifest.clear();
}
