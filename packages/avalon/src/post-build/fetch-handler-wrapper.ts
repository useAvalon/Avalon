/**
 * Node HTTP wrapper around a Fetch handler (Netlify/Cloudflare) so prerender
 * can boot the production server with `node _prerender-server.mjs`.
 *
 * Cloudflare Pages' Nitro handler calls `ctx.waitUntil.bind(ctx)`. An empty
 * `{}` as the third argument throws when bind is read off undefined.
 */
import { ssrDomShimModuleSource } from "../vite-plugin/ssr-dom-shim-module.ts";

export function fetchHandlerWrapperSource(importSpec: string, port: number): string {
	return `
import 'urlpattern-polyfill';
import { createServer } from 'node:http';

${ssrDomShimModuleSource()}

const mod = await import(${JSON.stringify(importSpec)});
const handler = mod.handler || mod.default;
if (!handler) { console.error('No handler found in ${importSpec}'); process.exit(1); }

const cfCtx = {
  waitUntil(promise) {
    if (promise && typeof promise.then === 'function') {
      promise.catch(() => {});
    }
  },
  passThroughOnException() {},
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:${port}');
  try {
    const hdrs = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v) hdrs.set(k, Array.isArray(v) ? v.join(', ') : v);
    }
    const request = new Request(url.href, { method: req.method, headers: hdrs });

    let response;
    if (handler.fetch) {
      response = await handler.fetch(request, {}, cfCtx);
    } else if (typeof handler === 'function') {
      response = await handler(request);
    } else {
      res.writeHead(500);
      res.end('Unknown handler format');
      return;
    }

    const body = await response.text();
    const resHdrs = {};
    if (response.headers && typeof response.headers.forEach === 'function') {
      response.headers.forEach((v, k) => { resHdrs[k] = v; });
    } else if (response.headers && typeof response.headers === 'object') {
      Object.assign(resHdrs, response.headers);
    }
    res.writeHead(response.status || 200, resHdrs);
    res.end(body);
  } catch (err) {
    console.error('Prerender request error:', err);
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});
server.listen(${port}, '127.0.0.1', () => console.log('Listening on http://127.0.0.1:${port}'));
`;
}
