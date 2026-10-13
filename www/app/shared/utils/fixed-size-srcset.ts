/** Width-based srcset for fixed-size icons (SVG/raster) so responsive-image audits see srcset. */
export function fixedSizeSrcSet(src: string, width: number): string {
	const w2 = width * 2;
	return `${src} ${width}w, ${src} ${w2}w`;
}

export function fixedSizeSizes(width: number): string {
	return `${width}px`;
}
