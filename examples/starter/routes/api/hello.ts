import { defineHandler } from "nitro";

export default defineHandler(() => {
	return Response.json({ message: "Hello from Avalon!" });
});
