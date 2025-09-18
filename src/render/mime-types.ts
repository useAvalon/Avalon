/**
 * MIME type mappings for static file serving
 */

export const MIME_TYPES: Record<string, string> = {
	// Scripts
	'.js': 'application/javascript',
	'.ts': 'application/typescript',
	'.tsx': 'application/typescript',
	'.jsx': 'application/javascript',
	'.mjs': 'application/javascript',
	'.vue': 'text/x-vue',

	// Styles
	'.css': 'text/css',
	'.scss': 'text/css',
	'.sass': 'text/css',

	// Markup
	'.html': 'text/html',
	'.htm': 'text/html',
	'.xml': 'application/xml',

	// Data
	'.json': 'application/json',
	'.csv': 'text/csv',
	'.txt': 'text/plain',

	// Images
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.bmp': 'image/bmp',
	'.tiff': 'image/tiff',
	'.avif': 'image/avif',

	// Fonts
	'.otf': 'font/otf',
	'.ttf': 'font/ttf',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.eot': 'application/vnd.ms-fontobject',

	// Media
	'.mp3': 'audio/mpeg',
	'.mp4': 'video/mp4',
	'.webm': 'video/webm',
	'.ogg': 'audio/ogg',
	'.wav': 'audio/wav',

	// Archives
	'.pdf': 'application/pdf',
	'.zip': 'application/zip',
	'.tar': 'application/x-tar',
	'.gz': 'application/gzip',

	// Manifests
	'.webmanifest': 'application/manifest+json',
	'.manifest': 'text/cache-manifest',
} as const;

export function getMimeType(extension: string): string {
	return MIME_TYPES[extension] || 'application/octet-stream';
}
