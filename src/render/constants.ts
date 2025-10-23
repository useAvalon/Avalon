/**
 * Server constants and configuration
 */

import { join } from '@std/path';

// Server configuration
export const STATIC_FILES_DIR = join(Deno.cwd(), 'public');
export const VITE_DEV_PORT = 8012;
export const VITE_HMR_PORT = 8013;
export const DEFAULT_SERVER_PORT = 8002; // Updated to match Avalon demo and design requirements

// File extensions
export const BINARY_EXTENSIONS = [
	'.woff',
	'.woff2',
	'.otf',
	'.ttf',
	'.eot', // Fonts
	'.png',
	'.jpg',
	'.jpeg',
	'.gif',
	'.webp',
	'.svg',
	'.ico',
	'.bmp',
	'.tiff',
	'.avif', // Images
	'.mp3',
	'.mp4',
	'.webm',
	'.ogg',
	'.wav',
	'.avi',
	'.mov', // Media
	'.pdf',
	'.zip',
	'.tar',
	'.gz',
	'.7z',
	'.rar', // Archives/Documents
] as const;

export const FONT_EXTENSIONS = ['.woff', '.woff2', '.otf', '.ttf', '.eot'] as const;

export const STATIC_FILE_EXTENSIONS = [
	...FONT_EXTENSIONS,
	'.png',
	'.jpg',
	'.jpeg',
	'.gif',
	'.webp',
	'.svg',
	'.ico', // Images
	'.css',
	'.js',
	'.json',
	'.txt',
	'.xml', // Text files
	'.pdf',
	'.zip',
	'.mp3',
	'.mp4',
	'.webm', // Documents & media
] as const;

// Security patterns
export const DANGEROUS_PATH_PATTERNS = [
	'..',
	'\\',
	'.well-known',
	'node_modules',
	'package.json',
	'deno.json',
	'.env',
	'/.',
] as const;
