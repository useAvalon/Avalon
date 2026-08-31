export interface HMRErrorOverlayOptions {
	framework: string;
	src: string;
	error: Error;
	filePath?: string;
	line?: number;
	column?: number;
}

export interface HMRToastOptions {
	message: string;
	type?: "info" | "error" | "success";
	duration?: number;
}

export declare function showHMRErrorOverlay(options: HMRErrorOverlayOptions): void;
export declare function removeHMRErrorOverlay(): void;
export declare function showHMRToast(options: HMRToastOptions): void;
