import { describe, expect, it } from "vitest";
import {
	CLIENT_NAVIGATION_HEADER,
	clientNavigationResponseHeaders,
	currentDocumentDisablesClientNavigation,
	documentDisablesClientNavigation,
	headerDisablesClientNavigation,
	htmlDisablesClientNavigation,
	isClientNavigationDisabled,
	stampClientNavigationOptOut,
} from "../opt-out.ts";

describe("isClientNavigationDisabled", () => {
	it("reads the page export and MDX frontmatter", () => {
		expect(isClientNavigationDisabled({})).toBe(false);
		expect(isClientNavigationDisabled({ clientNavigation: true })).toBe(false);
		expect(isClientNavigationDisabled({ clientNavigation: false })).toBe(true);
		expect(isClientNavigationDisabled({ frontmatter: { clientNavigation: false } })).toBe(true);
		expect(isClientNavigationDisabled({ frontmatter: { clientNavigation: true } })).toBe(false);
	});
});

describe("stampClientNavigationOptOut", () => {
	it("stamps the html opening tag once", () => {
		const stamped = stampClientNavigationOptOut('<html lang="en"><body></body></html>');
		expect(stamped).toBe('<html data-client-navigation="false" lang="en"><body></body></html>');
		expect(stampClientNavigationOptOut(stamped)).toBe(stamped);
	});

	it("stamps a bare html tag", () => {
		expect(stampClientNavigationOptOut("<html><body></body></html>")).toBe(
			'<html data-client-navigation="false"><body></body></html>',
		);
	});
});

describe("html / header / document detection", () => {
	it("detects the stamped attribute", () => {
		expect(htmlDisablesClientNavigation('<html lang="en">')).toBe(false);
		expect(htmlDisablesClientNavigation('<html data-client-navigation="false">')).toBe(true);
		expect(htmlDisablesClientNavigation("<HTML DATA-CLIENT-NAVIGATION='false'>")).toBe(true);
	});

	it("detects the response header", () => {
		const headers = new Headers({ [CLIENT_NAVIGATION_HEADER]: "false" });
		expect(headerDisablesClientNavigation(headers)).toBe(true);
		expect(headerDisablesClientNavigation(new Headers())).toBe(false);
		expect(
			headerDisablesClientNavigation(new Headers({ [CLIENT_NAVIGATION_HEADER]: "true" })),
		).toBe(false);
	});

	it("detects the live document", () => {
		expect(
			documentDisablesClientNavigation({
				documentElement: { dataset: { clientNavigation: "false" } },
			}),
		).toBe(true);
		expect(documentDisablesClientNavigation({ documentElement: { dataset: {} } })).toBe(false);
		expect(currentDocumentDisablesClientNavigation()).toBe(false);
	});

	it("emits the header only when disabled", () => {
		expect(clientNavigationResponseHeaders(false)).toEqual({});
		expect(clientNavigationResponseHeaders(true)).toEqual({
			[CLIENT_NAVIGATION_HEADER]: "false",
		});
	});
});
