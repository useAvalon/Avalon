/**
 * File serving utilities and security helpers
 */

import { join } from '@std/path';
import { typeByExtension } from '@std/media-types';
import { BINARY_EXTENSIONS, FONT_EXTENSIONS, STATIC_FILE_EXTENSIONS, DANGEROUS_PATH_PATTERNS } from './constants.ts';

function getMimeType(extension: string): string {
	return typeByExtension(extension) || 'application/octet-stream';
}

// Security helpers
export function isSecurePath(path: string): boolean {
	return !DANGEROUS_PATH_PATTERNS.some(pattern => path.includes(pattern)) && !path.startsWith('.');
}

export function hasStaticExtension(path: string): boolean {
	return STATIC_FILE_EXTENSIONS.some(ext => path.toLowerCase().endsWith(ext));
}

// File type detection
export function isBinaryFile(extension: string): boolean {
	return BINARY_EXTENSIONS.includes(extension.toLowerCase() as any);
}

export function isFontFile(extension: string): boolean {
	return FONT_EXTENSIONS.includes(extension.toLowerCase() as any);
}

// Header generation
export function createFontHeaders(extension: string, originalUrl?: string): Record<string, string> {
	const headers: Record<string, string> = {
		'Content-Type': getMimeType(extension),
		'Cache-Control': 'public, max-age=31536000, immutable',
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
	};

	if (originalUrl) {
		headers['Link'] = `<${originalUrl}>; rel=preload; as=font; type=${getMimeType(extension)}; crossorigin`;
	}

	return headers;
}

export function createBinaryHeaders(extension: string): Record<string, string> {
	return {
		'Content-Type': getMimeType(extension),
		'Cache-Control': 'public, max-age=3600',
	};
}

export function createTextHeaders(extension: string): Record<string, string> {
	return {
		'Content-Type': getMimeType(extension),
		'Cache-Control': 'no-cache',
	};
}

// File serving functions
export async function serveBinaryFile(
	filePath: string,
	extension: string,
	originalUrl?: string,
	normalizedPath?: string
): Promise<Response> {
	const fileBytes = await Deno.readFile(filePath);

	const headers = isFontFile(extension)
		? createFontHeaders(extension, originalUrl || (normalizedPath ? '/' + normalizedPath : undefined))
		: createBinaryHeaders(extension);

	return new Response(fileBytes, { headers });
}

export async function serveTextFile(filePath: string, extension: string): Promise<Response> {
	const fileContent = await Deno.readTextFile(filePath);
	return new Response(fileContent, { headers: createTextHeaders(extension) });
}

export async function serveStaticFile(path: string, rootDir: string, originalUrl?: string): Promise<Response> {
	try {
		if (!isSecurePath(path)) {
			console.warn(`🚨 Security: Blocked potentially malicious path: ${path}`);
			return new Response('Forbidden', { status: 403 });
		}

		const normalizedPath = path.replace(/\/+/g, '/').replace(/^\//, '');
		const filePath = join(rootDir, normalizedPath);
		const extension = path.substring(path.lastIndexOf('.'));

		if (isBinaryFile(extension)) {
			return await serveBinaryFile(filePath, extension, originalUrl, normalizedPath);
		} else {
			return await serveTextFile(filePath, extension);
		}
	} catch (error: unknown) {
		console.error(`Error serving file ${path}:`, error);
		return new Response('File not found', { status: 404 });
	}
}
