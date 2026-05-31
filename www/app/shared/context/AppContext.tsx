import type { ComponentChildren } from "preact";
import { createContext } from "preact";
import { useContext } from "preact/hooks";

/**
 * App-wide context for sharing data across layouts and pages.
 *
 * This wraps the root layout so any page or island can access
 * shared data without prop drilling.
 */

export interface AppContextValue {
	siteName: string;
	version: string;
	environment: string;
	buildTime: string;
	features: string[];
	initialCount: number;
}

const defaultValue: AppContextValue = {
	siteName: "Avalon Demo",
	version: "1.0.0",
	environment:
		typeof process !== "undefined" ? process.env.NODE_ENV || "development" : "development",
	buildTime: new Date().toISOString(),
	features: ["islands", "streaming", "multi-framework", "file-routing", "layouts"],
	initialCount: 42,
};

/** Exported so pages can read config without hooks (pages render outside the Preact tree) */
export const appDefaults = defaultValue;

export const AppContext = createContext<AppContextValue>(defaultValue);

export function AppProvider({
	children,
	value,
}: Readonly<{ children: ComponentChildren; value?: Partial<AppContextValue> }>) {
	const merged = { ...defaultValue, ...value };
	return <AppContext.Provider value={merged}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
	return useContext(AppContext);
}
