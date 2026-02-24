import { describe, expect, it } from 'vitest';

// DOM shim must be imported before any Lit utilities
import '../server/dom-shim.ts';
import { serializeAttributes, collectStyles } from '../server/utils.ts';

describe('serializeAttributes', () => {
	describe('Requirement 8.1: string props produce escaped key="value" pairs', () => {
		it('serializes a simple string prop', () => {
			const result = serializeAttributes({ title: 'Hello' });
			expect(result).toBe('title="Hello"');
		});

		it('escapes HTML special characters in string values', () => {
			const result = serializeAttributes({ label: '<b>"Tom & Jerry"</b>' });
			expect(result).toBe('label="&lt;b&gt;&quot;Tom &amp; Jerry&quot;&lt;/b&gt;"');
		});

		it('escapes single quotes in string values', () => {
			const result = serializeAttributes({ msg: "it's" });
			expect(result).toBe('msg="it&#39;s"');
		});

		it('serializes multiple string props separated by spaces', () => {
			const result = serializeAttributes({ id: 'el', name: 'widget' });
			expect(result).toBe('id="el" name="widget"');
		});

		it('handles empty string value', () => {
			const result = serializeAttributes({ alt: '' });
			expect(result).toBe('alt=""');
		});
	});

	describe('Requirement 4.5 / 4.6: boolean props', () => {
		it('renders truthy boolean as bare attribute', () => {
			const result = serializeAttributes({ disabled: true });
			expect(result).toBe('disabled');
		});

		it('omits falsy boolean attributes', () => {
			const result = serializeAttributes({ hidden: false });
			expect(result).toBe('');
		});

		it('handles mix of truthy and falsy booleans', () => {
			const result = serializeAttributes({ checked: true, disabled: false, required: true });
			expect(result).toBe('checked required');
		});
	});

	describe('number props', () => {
		it('serializes number props as attribute values', () => {
			const result = serializeAttributes({ count: 42 });
			expect(result).toBe('count="42"');
		});

		it('serializes zero', () => {
			const result = serializeAttributes({ index: 0 });
			expect(result).toBe('index="0"');
		});

		it('serializes negative numbers', () => {
			const result = serializeAttributes({ offset: -5 });
			expect(result).toBe('offset="-5"');
		});
	});

	describe('Requirement 8.2: object props are JSON-stringified and escaped', () => {
		it('serializes a plain object prop', () => {
			const result = serializeAttributes({ config: { a: 1 } });
			expect(result).toContain("config='");
			expect(result).toContain('}');
		});

		it('escapes HTML characters in JSON-stringified objects', () => {
			const result = serializeAttributes({ data: { tag: '<div>' } });
			// The JSON string contains < and > which should be escaped
			expect(result).not.toContain('<div>');
			expect(result).toContain('&lt;div&gt;');
		});

		it('serializes arrays as object props', () => {
			const result = serializeAttributes({ items: [1, 2, 3] });
			expect(result).toContain("items='");
			expect(result).toContain('[1,2,3]');
		});
	});

	describe('Requirement 8.3: null and undefined values are omitted', () => {
		it('omits undefined values', () => {
			const result = serializeAttributes({ title: 'hi', missing: undefined });
			expect(result).toBe('title="hi"');
			expect(result).not.toContain('missing');
		});

		it('omits null values', () => {
			const result = serializeAttributes({ title: 'hi', empty: null });
			expect(result).toBe('title="hi"');
			expect(result).not.toContain('empty');
		});

		it('returns empty string when all values are null/undefined', () => {
			const result = serializeAttributes({ a: null, b: undefined });
			expect(result).toBe('');
		});
	});

	describe('camelCase to kebab-case conversion', () => {
		it('converts camelCase attribute names to kebab-case', () => {
			const result = serializeAttributes({ myProp: 'val' });
			expect(result).toBe('my-prop="val"');
		});

		it('converts multi-word camelCase names', () => {
			const result = serializeAttributes({ backgroundColor: 'red' });
			expect(result).toBe('background-color="red"');
		});
	});

	describe('mixed prop types', () => {
		it('handles a mix of string, boolean, number, object, null, and undefined', () => {
			const result = serializeAttributes({
				id: 'el',
				disabled: true,
				hidden: false,
				count: 7,
				config: { x: 1 },
				missing: null,
				gone: undefined,
			});
			expect(result).toContain('id="el"');
			expect(result).toContain('disabled');
			expect(result).not.toContain('hidden');
			expect(result).toContain('count="7"');
			expect(result).toContain("config='");
			expect(result).not.toContain('missing');
			expect(result).not.toContain('gone');
		});

		it('returns empty string for empty props', () => {
			expect(serializeAttributes({})).toBe('');
		});
	});
});

describe('collectStyles', () => {
	describe('Requirement 8.4: extracts CSS text from LitElement with static styles', () => {
		it('extracts CSS from a class with a single CSSResult-like style', () => {
			const MockElement = class {
				static styles = { cssText: ':host { display: block; }' };
			};
			const result = collectStyles(MockElement as any);
			expect(result).toBe(':host { display: block; }');
		});

		it('extracts CSS from an array of CSSResult-like styles', () => {
			const MockElement = class {
				static styles = [
					{ cssText: ':host { display: block; }' },
					{ cssText: '.inner { color: red; }' },
				];
			};
			const result = collectStyles(MockElement as any);
			expect(result).toContain(':host { display: block; }');
			expect(result).toContain('.inner { color: red; }');
		});

		it('extracts CSS from a string style', () => {
			const MockElement = class {
				static styles = ':host { margin: 0; }';
			};
			const result = collectStyles(MockElement as any);
			expect(result).toBe(':host { margin: 0; }');
		});

		it('returns empty string when no styles are defined', () => {
			const MockElement = class {};
			const result = collectStyles(MockElement as any);
			expect(result).toBe('');
		});

		it('returns empty string when styles is null', () => {
			const MockElement = class {
				static styles = null;
			};
			const result = collectStyles(MockElement as any);
			expect(result).toBe('');
		});

		it('handles styles with toString method', () => {
			const MockElement = class {
				static styles = { toString: () => '.custom { padding: 8px; }' };
			};
			const result = collectStyles(MockElement as any);
			expect(result).toBe('.custom { padding: 8px; }');
		});

		it('filters out falsy entries in array styles', () => {
			const MockElement = class {
				static styles = [
					{ cssText: '.a { color: red; }' },
					null,
					undefined,
					{ cssText: '.b { color: blue; }' },
				];
			};
			const result = collectStyles(MockElement as any);
			expect(result).toContain('.a { color: red; }');
			expect(result).toContain('.b { color: blue; }');
		});
	});
});
