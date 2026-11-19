/**
 * Nitro accepts both `cloudflare-module` (its own name, also written to
 * `nitro.json`) and `cloudflare_module`. Avalon compares presets in the
 * underscore form.
 *
 * Kept free of imports: post-build runs this under plain Node, where
 * `nitro/config.ts` and its schemas need globals such as `URLPattern`.
 */
export function normalizePresetName(preset: string): string {
	return preset.trim().toLowerCase().replaceAll("-", "_");
}
