import { describe, expect, it } from "vitest";
import { decrypt, encrypt, generateKey, getKey } from "../encryption.ts";

describe("generateKey", () => {
	it("generates a base64 string that decodes to 32 bytes", () => {
		const key = generateKey();
		const buf = Buffer.from(key, "base64");
		expect(buf.length).toBe(32);
	});

	it("generates unique keys on each call", () => {
		const key1 = generateKey();
		const key2 = generateKey();
		expect(key1).not.toBe(key2);
	});
});

describe("getKey", () => {
	it("rejects AVALON_KEY with invalid length", () => {
		const originalKey = process.env.AVALON_KEY;
		try {
			// 16 bytes instead of 32
			process.env.AVALON_KEY = Buffer.from("a".repeat(16)).toString("base64");
			expect(() => getKey()).toThrow("must be a base64-encoded 256-bit (32-byte) key");
		} finally {
			if (originalKey === undefined) {
				delete process.env.AVALON_KEY;
			} else {
				process.env.AVALON_KEY = originalKey;
			}
		}
	});

	it("accepts a valid 32-byte AVALON_KEY", () => {
		const originalKey = process.env.AVALON_KEY;
		try {
			const validKey = generateKey();
			process.env.AVALON_KEY = validKey;
			expect(getKey()).toBe(validKey);
		} finally {
			if (originalKey === undefined) {
				delete process.env.AVALON_KEY;
			} else {
				process.env.AVALON_KEY = originalKey;
			}
		}
	});
});

describe("encrypt / decrypt round-trip", () => {
	const key = generateKey();

	it("round-trips a simple string", () => {
		const plaintext = "hello world";
		const encrypted = encrypt(plaintext, key);
		const decrypted = decrypt(encrypted, key);
		expect(decrypted).toBe(plaintext);
	});

	it("round-trips an empty string", () => {
		const plaintext = "";
		const encrypted = encrypt(plaintext, key);
		const decrypted = decrypt(encrypted, key);
		expect(decrypted).toBe(plaintext);
	});

	it("round-trips JSON data", () => {
		const data = JSON.stringify({ userId: 42, role: "admin", tags: ["a", "b"] });
		const encrypted = encrypt(data, key);
		const decrypted = decrypt(encrypted, key);
		expect(decrypted).toBe(data);
	});

	it("round-trips unicode content", () => {
		const plaintext = "こんにちは世界 🌍 émojis & spëcial chars";
		const encrypted = encrypt(plaintext, key);
		const decrypted = decrypt(encrypted, key);
		expect(decrypted).toBe(plaintext);
	});

	it("produces different ciphertext for the same plaintext (random IV)", () => {
		const plaintext = "same input";
		const encrypted1 = encrypt(plaintext, key);
		const encrypted2 = encrypt(plaintext, key);
		expect(encrypted1).not.toBe(encrypted2);
		// Both decrypt to the same value
		expect(decrypt(encrypted1, key)).toBe(plaintext);
		expect(decrypt(encrypted2, key)).toBe(plaintext);
	});
});

describe("URL-safe output", () => {
	const key = generateKey();

	it("does not contain +, /, or = characters", () => {
		// Encrypt several payloads to increase chance of catching non-URL-safe chars
		for (let i = 0; i < 20; i++) {
			const encrypted = encrypt(`test payload number ${i} with some data`, key);
			expect(encrypted).not.toMatch(/[+/=]/);
		}
	});

	it("only contains base64url characters", () => {
		const encrypted = encrypt("validate charset", key);
		expect(encrypted).toMatch(/^[A-Za-z0-9_-]+$/);
	});
});

describe("tampered payload detection", () => {
	const key = generateKey();

	it("throws when ciphertext is modified", () => {
		const encrypted = encrypt("sensitive data", key);
		// Flip a character in the middle of the encrypted string
		const chars = encrypted.split("");
		const midpoint = Math.floor(chars.length / 2);
		chars[midpoint] = chars[midpoint] === "A" ? "B" : "A";
		const tampered = chars.join("");

		expect(() => decrypt(tampered, key)).toThrow();
	});

	it("throws when encrypted data is truncated", () => {
		const encrypted = encrypt("some data", key);
		const truncated = encrypted.slice(0, Math.floor(encrypted.length / 2));

		expect(() => decrypt(truncated, key)).toThrow();
	});

	it("throws for completely invalid input", () => {
		expect(() => decrypt("not-valid-encrypted-data", key)).toThrow();
	});

	it("throws for empty string input", () => {
		expect(() => decrypt("", key)).toThrow();
	});
});

describe("invalid key handling", () => {
	it("throws when encrypting with a key that is too short", () => {
		const shortKey = Buffer.from("too-short").toString("base64");
		expect(() => encrypt("data", shortKey)).toThrow("must be 32 bytes");
	});

	it("throws when encrypting with a key that is too long", () => {
		const longKey = Buffer.from("a".repeat(64)).toString("base64");
		expect(() => encrypt("data", longKey)).toThrow("must be 32 bytes");
	});

	it("throws when decrypting with a key that is too short", () => {
		const key = generateKey();
		const encrypted = encrypt("data", key);
		const shortKey = Buffer.from("too-short").toString("base64");
		expect(() => decrypt(encrypted, shortKey)).toThrow("must be 32 bytes");
	});

	it("throws when decrypting with the wrong key", () => {
		const key1 = generateKey();
		const key2 = generateKey();
		const encrypted = encrypt("secret", key1);

		expect(() => decrypt(encrypted, key2)).toThrow();
	});
});
