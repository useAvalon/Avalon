import { describe, expect, it } from 'vitest';
import { normalizeProps, isQwikComponent } from '../server/utils.ts';

describe('normalizeProps', () => {
	describe('returns empty object for non-object values', () => {
		it('returns empty object for null', () => {
			expect(normalizeProps(null)).toEqual({});
		});

		it('returns empty object for undefined', () => {
			expect(normalizeProps(undefined)).toEqual({});
		});

		it('returns empty object for a number', () => {
			expect(normalizeProps(42)).toEqual({});
		});

		it('returns empty object for a string', () => {
			expect(normalizeProps('hello')).toEqual({});
		});

		it('returns empty object for a boolean', () => {
			expect(normalizeProps(true)).toEqual({});
		});
	});

	describe('passes through valid objects', () => {
		it('returns the same object for a plain object', () => {
			const props = { name: 'test', count: 5 };
			expect(normalizeProps(props)).toEqual({ name: 'test', count: 5 });
		});

		it('returns the same object for an empty object', () => {
			expect(normalizeProps({})).toEqual({});
		});

		it('returns the same object for nested objects', () => {
			const props = { data: { items: [1, 2, 3] } };
			expect(normalizeProps(props)).toEqual({ data: { items: [1, 2, 3] } });
		});
	});
});

describe('isQwikComponent', () => {
	it('returns true for a regular function', () => {
		expect(isQwikComponent(function MyComponent() {})).toBe(true);
	});

	it('returns true for an arrow function', () => {
		expect(isQwikComponent(() => {})).toBe(true);
	});

	it('returns true for a function with __brand marker', () => {
		const comp = () => {};
		(comp as any).__brand = 'QwikComponent';
		expect(isQwikComponent(comp)).toBe(true);
	});

	it('returns true for a function with __qrl marker', () => {
		const comp = () => {};
		(comp as any).__qrl = true;
		expect(isQwikComponent(comp)).toBe(true);
	});

	it('returns false for a string', () => {
		expect(isQwikComponent('not a component')).toBe(false);
	});

	it('returns false for a number', () => {
		expect(isQwikComponent(42)).toBe(false);
	});

	it('returns false for null', () => {
		expect(isQwikComponent(null)).toBe(false);
	});

	it('returns false for undefined', () => {
		expect(isQwikComponent(undefined)).toBe(false);
	});

	it('returns false for an object', () => {
		expect(isQwikComponent({ render: () => {} })).toBe(false);
	});

	it('returns false for a boolean', () => {
		expect(isQwikComponent(true)).toBe(false);
	});
});
