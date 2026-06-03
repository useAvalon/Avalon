import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
// The build-time key is embedded into the server bundle via a virtual module.
// This allows single-instance deploys to work out-of-the-box without setting
// AVALON_KEY in the environment. Multi-instance deploys should still set
// AVALON_KEY so all instances share the same secret.
import { serverIslandKey as embeddedKey } from "virtual:server-island-key";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;

/**
 * Build-time generated key, used in development when AVALON_KEY is not set.
 * Lazily initialized on first use. In production, AVALON_KEY is required so all
 * processes share the same secret (a per-process key would break cross-process
 * decryption in multi-instance deployments).
 */
let buildTimeKey: string | undefined;

/** Whether a missing-AVALON_KEY warning has already been emitted (avoid log spam). */
let warnedMissingKey = false;

/**
 * Generates a new random AES-256 key as a base64 string.
 */
export function generateKey(): string {
	return randomBytes(KEY_LENGTH).toString("base64");
}

/**
 * Gets the encryption key from the AVALON_KEY env var, or falls back to a
 * per-process build-time key in development.
 *
 * In production, AVALON_KEY is REQUIRED: a per-process key would cause
 * cross-process decryption failures (one instance encrypts, another can't
 * decrypt). We throw to surface the misconfiguration instead of failing
 * silently at request time.
 */
export function getKey(): string {
	// Read AVALON_KEY via a dynamic pattern that Nitro's bundler does not
	// statically replace. Nitro substitutes literal `process.env.X` with
	// build-time values (or undefined), making runtime env vars unreachable.
	// Using an indirect access preserves runtime resolution.
	const env = globalThis.process?.env ?? {};
	const envKey = env.AVALON_KEY;
	if (envKey) {
		const buf = Buffer.from(envKey, "base64");
		if (buf.length !== KEY_LENGTH) {
			throw new Error(
				`AVALON_KEY must be a base64-encoded 256-bit (32-byte) key. Got ${buf.length} bytes.`,
			);
		}
		return envKey;
	}

	// No AVALON_KEY in environment. Fall back to the build-time-embedded key.
	// This works out-of-the-box for single-instance deploys (Netlify, Vercel, etc.)
	// where the same process that rendered the page also handles the endpoint.
	// For multi-instance deploys (multiple servers/lambdas), set AVALON_KEY so
	// all instances share the same secret — otherwise one instance encrypts with
	// its build key and another can't decrypt.
	if (embeddedKey) {
		const buf = Buffer.from(embeddedKey, "base64");
		if (buf.length === KEY_LENGTH) {
			return embeddedKey;
		}
	}

	// No key available at all.
	const nodeEnv = env.NODE_ENV ?? globalThis.process?.env?.NODE_ENV;
	if (nodeEnv === "production") {
		throw new Error(
			"AVALON_KEY is required in production for server islands. " +
				"Generate one with `npx avalon key` and set it as an environment variable " +
				"so all server instances share the same encryption secret.",
		);
	}

	if (!warnedMissingKey) {
		warnedMissingKey = true;
		console.warn(
			"[avalon] AVALON_KEY not set — using a per-process key for server islands. " +
				"This only works for single-process development. Set AVALON_KEY for production.",
		);
	}

	if (!buildTimeKey) {
		buildTimeKey = generateKey();
	}
	return buildTimeKey;
}

/**
 * Converts a standard base64 string to base64url (URL-safe).
 */
function toBase64Url(base64: string): string {
	return base64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/**
 * Converts a base64url string back to standard base64.
 */
function fromBase64Url(base64url: string): string {
	let base64 = base64url.replaceAll("-", "+").replaceAll("_", "/");
	const pad = base64.length % 4;
	if (pad === 2) base64 += "==";
	else if (pad === 3) base64 += "=";
	return base64;
}

/**
 * Encrypts data using AES-256-GCM.
 * Output format: base64url(iv + ciphertext + authTag)
 *
 * @param data - The plaintext string to encrypt
 * @param key - Optional base64-encoded key. Defaults to getKey().
 * @returns base64url-encoded encrypted string
 */
export function encrypt(data: string, key?: string): string {
	const keyBuffer = Buffer.from(key ?? getKey(), "base64");
	if (keyBuffer.length !== KEY_LENGTH) {
		throw new Error(`Encryption key must be 32 bytes. Got ${keyBuffer.length} bytes.`);
	}

	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, keyBuffer, iv);

	const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
	const authTag = cipher.getAuthTag();

	// Output: iv (12) + ciphertext (variable) + authTag (16)
	const combined = Buffer.concat([iv, encrypted, authTag]);
	return toBase64Url(combined.toString("base64"));
}

/**
 * Decrypts a base64url-encoded AES-256-GCM encrypted string.
 *
 * @param data - The base64url-encoded encrypted string
 * @param key - Optional base64-encoded key. Defaults to getKey().
 * @returns The decrypted plaintext string
 * @throws Error if decryption fails (tampered data, wrong key, etc.)
 */
export function decrypt(data: string, key?: string): string {
	const keyBuffer = Buffer.from(key ?? getKey(), "base64");
	if (keyBuffer.length !== KEY_LENGTH) {
		throw new Error(`Encryption key must be 32 bytes. Got ${keyBuffer.length} bytes.`);
	}

	const combined = Buffer.from(fromBase64Url(data), "base64");

	if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
		throw new Error("Invalid encrypted data: too short");
	}

	const iv = combined.subarray(0, IV_LENGTH);
	const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
	const ciphertext = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);

	const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv);
	decipher.setAuthTag(authTag);

	const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

	return decrypted.toString("utf8");
}
