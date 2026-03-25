import { describe, it, expect, beforeEach } from 'vitest';
import {
	addUniversalHead,
	getUniversalHeadForInjection,
	clearUniversalHead,
	setSolidHydrationScript,
	injectSolidHydrationScriptIfNeeded,
} from '../universal-head-collector.ts';

describe('injectSolidHydrationScriptIfNeeded', () => {
	const mockHydrationScript = '<script>window._$HY={events:[],completed:new WeakSet}</script>';

	beforeEach(() => {
		clearUniversalHead();
		// Reset the cached script
		globalThis.__solidHydrationScript = undefined;
	});

	it('should not inject script when no Solid islands are present', () => {
		setSolidHydrationScript(mockHydrationScript);

		const html = `<!DOCTYPE html>
<html><head><title>Test</title></head>
<body><div>No islands here</div></body></html>`;

		const result = injectSolidHydrationScriptIfNeeded(html);
		expect(result).toBe(html);
		expect(result).not.toContain('_$HY');
	});

	it('should inject script when Solid islands are present', () => {
		setSolidHydrationScript(mockHydrationScript);

		const html = `<!DOCTYPE html>
<html><head><title>Test</title></head>
<body><avalon-island data-framework="solid" data-src="/islands/Counter.tsx"></avalon-island></body></html>`;

		const result = injectSolidHydrationScriptIfNeeded(html);
		expect(result).toContain('window._$HY');
		expect(result).toContain(mockHydrationScript);
	});

	it('should inject script before </head>', () => {
		setSolidHydrationScript(mockHydrationScript);

		const html = `<html><head><title>Test</title></head>
<body><avalon-island data-framework="solid"></avalon-island></body></html>`;

		const result = injectSolidHydrationScriptIfNeeded(html);
		const headCloseIdx = result.indexOf('</head>');
		const scriptIdx = result.indexOf(mockHydrationScript);
		expect(scriptIdx).toBeLessThan(headCloseIdx);
	});

	it('should not inject if script is already present in HTML', () => {
		setSolidHydrationScript(mockHydrationScript);

		const html = `<html><head><script>window._$HY={}</script></head>
<body><avalon-island data-framework="solid"></avalon-island></body></html>`;

		const result = injectSolidHydrationScriptIfNeeded(html);
		// Should not double-inject
		expect(result).toBe(html);
	});

	it('should not inject if no hydration script has been cached', () => {
		// Don't call setSolidHydrationScript

		const html = `<html><head></head>
<body><avalon-island data-framework="solid"></avalon-island></body></html>`;

		const result = injectSolidHydrationScriptIfNeeded(html);
		expect(result).toBe(html);
	});

	it('should not inject for non-Solid framework islands', () => {
		setSolidHydrationScript(mockHydrationScript);

		const html = `<html><head></head>
<body><avalon-island data-framework="preact" data-src="/islands/Counter.tsx"></avalon-island></body></html>`;

		const result = injectSolidHydrationScriptIfNeeded(html);
		expect(result).toBe(html);
		expect(result).not.toContain('_$HY');
	});

	it('should handle pages with multiple Solid islands (inject only once)', () => {
		setSolidHydrationScript(mockHydrationScript);

		const html = `<html><head></head>
<body>
<avalon-island data-framework="solid" data-src="/islands/A.tsx"></avalon-island>
<avalon-island data-framework="solid" data-src="/islands/B.tsx"></avalon-island>
</body></html>`;

		const result = injectSolidHydrationScriptIfNeeded(html);
		const occurrences = result.split(mockHydrationScript).length - 1;
		expect(occurrences).toBe(1);
	});
});

describe('setSolidHydrationScript', () => {
	beforeEach(() => {
		globalThis.__solidHydrationScript = undefined;
	});

	it('should cache the hydration script globally', () => {
		const script = '<script>window._$HY={}</script>';
		setSolidHydrationScript(script);
		expect(globalThis.__solidHydrationScript).toBe(script);
	});
});

describe('Solid hydration script is not in universal head collector', () => {
	beforeEach(() => {
		clearUniversalHead();
		globalThis.__solidHydrationScript = undefined;
	});

	it('should not include Solid hydration script in universal head output', () => {
		// Simulate what used to happen: adding the script to the universal head collector
		// After the fix, the Solid renderer no longer adds it there
		// This test verifies the collector doesn't contain Solid hydration scripts
		addUniversalHead('<meta name="test" content="value">', '/test', 'preact', 'meta');

		const headContent = getUniversalHeadForInjection(true);
		expect(headContent).not.toContain('_$HY');
		expect(headContent).toContain('meta name="test"');
	});
});
