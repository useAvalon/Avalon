/**
 * Nitro SSR Renderer
 *
 * Connects Nitro to Avalon's SSR pipeline for page rendering.
 * This is the catch-all handler — requests that don't match API routes
 * or static files are rendered here as pages.
 */

import { createNitroRenderer } from '@avalon/avalon/nitro/renderer';
import avalonConfig from 'virtual:avalon/config';

export default createNitroRenderer({
	avalonConfig,
	isDev: avalonConfig.isDev,
});