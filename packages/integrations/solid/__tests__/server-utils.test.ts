import { describe, expect, it } from 'vitest';
import { normalizeProps, isSolidComponent } from '../server/utils.ts';

describe('normalizeProps', () => {
	describe('Requirement 4.4: returns empty object for non-object values', () => {
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

		it('returns empty object for zero', () => {
			expect(normalizeProps(0)).toEqual({});
		});

		it('returns empty object for empty string', () => {
			expect(normalizeProps('')).toEqual({});
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

describe('isSolidComponent', () => {
	it('returns true for a regular function', () => {
		expect(isSolidComponent(function MyComponent() {})).toBe(true);
	});

	it('returns true for an arrow function', () => {
		expect(isSolidComponent(() => {})).toBe(true);
	});

	it('returns false for a string', () => {
		expect(isSolidComponent('not a component')).toBe(false);
	});

	it('returns false for a number', () => {
		expect(isSolidComponent(42)).toBe(false);
	});

	it('returns false for null', () => {
		expect(isSolidComponent(null)).toBe(false);
	});

	it('returns false for undefined', () => {
		expect(isSolidComponent(undefined)).toBe(false);
	});

	it('returns false for an object', () => {
		expect(isSolidComponent({ render: () => {} })).toBe(false);
	});

	it('returns false for a boolean', () => {
		expect(isSolidComponent(true)).toBe(false);
	});
});
