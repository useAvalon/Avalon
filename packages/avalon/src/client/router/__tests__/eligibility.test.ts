import { describe, expect, it } from "vitest";
import {
	type ClickModifiers,
	eligibleNavigationUrl,
	isModifiedClick,
	type LinkAttributes,
	type LocationLike,
} from "../eligibility.ts";

const location: LocationLike = {
	origin: "https://example.com",
	href: "https://example.com/home",
	pathname: "/home",
	search: "",
};

const click: ClickModifiers = {
	defaultPrevented: false,
	button: 0,
	metaKey: false,
	ctrlKey: false,
	shiftKey: false,
	altKey: false,
};

function link(partial: Partial<LinkAttributes> & { href: string }): LinkAttributes {
	return {
		download: false,
		target: null,
		reload: false,
		...partial,
	};
}

describe("isModifiedClick", () => {
	it("rejects non-primary buttons and modifier keys", () => {
		expect(isModifiedClick({ ...click, button: 1 })).toBe(true);
		expect(isModifiedClick({ ...click, metaKey: true })).toBe(true);
		expect(isModifiedClick({ ...click, ctrlKey: true })).toBe(true);
		expect(isModifiedClick({ ...click, shiftKey: true })).toBe(true);
		expect(isModifiedClick({ ...click, altKey: true })).toBe(true);
		expect(isModifiedClick({ ...click, defaultPrevented: true })).toBe(true);
		expect(isModifiedClick(click)).toBe(false);
	});
});

describe("eligibleNavigationUrl", () => {
	it("allows internal same-origin GET links", () => {
		const url = eligibleNavigationUrl(link({ href: "/about" }), click, location);
		expect(url?.pathname).toBe("/about");
		expect(url?.origin).toBe("https://example.com");
	});

	it("rejects data-router-reload", () => {
		expect(eligibleNavigationUrl(link({ href: "/about", reload: true }), click, location)).toBe(
			null,
		);
	});

	it("rejects download, new-tab, hash-only, external, and mailto", () => {
		expect(eligibleNavigationUrl(link({ href: "/file", download: true }), click, location)).toBe(
			null,
		);
		expect(eligibleNavigationUrl(link({ href: "/about", target: "_blank" }), click, location)).toBe(
			null,
		);
		expect(eligibleNavigationUrl(link({ href: "#section" }), click, location)).toBe(null);
		expect(eligibleNavigationUrl(link({ href: "https://other.test/x" }), click, location)).toBe(
			null,
		);
		expect(eligibleNavigationUrl(link({ href: "mailto:hi@example.com" }), click, location)).toBe(
			null,
		);
		expect(eligibleNavigationUrl(link({ href: "tel:+15551212" }), click, location)).toBe(null);
	});

	it("rejects same-path hash-only updates", () => {
		expect(eligibleNavigationUrl(link({ href: "/home#top" }), click, location)).toBe(null);
	});

	it("allows a new path that includes a hash", () => {
		const url = eligibleNavigationUrl(link({ href: "/about#team" }), click, location);
		expect(url?.pathname).toBe("/about");
		expect(url?.hash).toBe("#team");
	});
});
