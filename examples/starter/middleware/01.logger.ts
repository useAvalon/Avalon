import { defineHandler } from "nitro";

export default defineHandler((event) => {
	console.log(`[${new Date().toISOString()}] ${event.req.method} ${event.url.pathname}`);
});
