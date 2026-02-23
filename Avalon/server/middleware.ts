/**
 * Avalon Demo - Server Middleware Configuration
 *
 * This file configures server-side middleware for the Nitro server.
 * Middleware runs before route handlers and can modify requests/responses.
 *
 * Requirements: 4.1 - Middleware System Migration
 */

import type { H3Event } from '@avalon/avalon/nitro/types';
import { getRequestURL } from 'h3';

/**
 * Logging middleware - logs all incoming requests
 */
export function loggingMiddleware(event: H3Event): void {
	const timestamp = new Date().toISOString();
	const method = event.method;
	const path = getRequestURL(event).pathname;

	console.log(`[${timestamp}] ${method} ${path}`);
}

/**
 * Security headers middleware - adds common security headers
 */
export function securityHeadersMiddleware(event: H3Event): void {
	// These headers will be added to all responses
	event.context.securityHeaders = {
		'X-Content-Type-Options': 'nosniff',
		'X-Frame-Options': 'DENY',
		'X-XSS-Protection': '1; mode=block',
		'Referrer-Policy': 'strict-origin-when-cross-origin',
	};
}

/**
 * Request timing middleware - tracks request duration
 */
export function timingMiddleware(event: H3Event): void {
	event.context.requestStartTime = Date.now();
}

/**
 * Default middleware chain for the Avalon demo
 */
export const defaultMiddleware = [loggingMiddleware, securityHeadersMiddleware, timingMiddleware];

export default defaultMiddleware;
