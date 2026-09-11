/**
 * Shared vs per-island hydration.
 *
 * Dev always uses a long-lived entry-client runtime (HMR). Production uses
 * per-island inline scripts unless `clientRouter` is on — the router must
 * re-scan islands after a DOM swap, which inline scripts cannot do.
 */
export type HydrationMode = "entry-client" | "per-island";

export function resolveHydrationMode(isDev: boolean, clientRouter: boolean): HydrationMode {
	return isDev || clientRouter ? "entry-client" : "per-island";
}

/** Import lines for `virtual:avalon/client-entry` based on hydration mode. */
export function clientEntryImportLines(isDev: boolean, clientRouter: boolean): string[] {
	const lines: string[] = [];
	if (resolveHydrationMode(isDev, clientRouter) === "entry-client") {
		const runtime = isDev ? "@useavalon/avalon/client/main" : "@useavalon/avalon/client/main-slim";
		lines.push(`import '${runtime}';`);
	} else {
		lines.push(`// Per-island hydration mode — no shared runtime needed`);
	}
	if (clientRouter) {
		lines.push(`import '@useavalon/avalon/client/router';`);
	}
	return lines;
}
