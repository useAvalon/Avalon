#!/usr/bin/env node
import { generateKey } from "../src/server-islands/encryption.ts";

const command = process.argv[2];

if (command === "key") {
	const key = generateKey();
	console.log(`\nGenerated AVALON_KEY:\n`);
	console.log(`  ${key}\n`);
	console.log(`Set this in your environment:\n`);
	console.log(`  export AVALON_KEY="${key}"\n`);
} else {
	console.log("Usage: avalon <command>\n");
	console.log("Commands:");
	console.log("  key    Generate a cryptographically random AES-256-GCM key");
	process.exit(command === "--help" || command === "-h" ? 0 : 1);
}
