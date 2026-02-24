import { describe, expect, it } from 'vitest';
import { serializeProps } from '../server/utils.ts';

describe('serializeProps', () => {
	describe('Requirement 4.1: strips non-serializable values', () => {
		it('removes function values from props', () => {
			const props = { name: 'test', onClick: () => {} };
			const result = serializeProps(props);
			expect(result).toEqual({ name: 'test' });
			expect(result).not.toHaveProperty('onClick');
		});

		it('removes symbol values from props', () => {
			const props = { title: 'hello', sym: Symbol('test') };
			const result = serializeProps(props);
			expect(result).toEqual({ title: 'hello' });
			expect(result).not.toHaveProperty('sym');
		});

		it('removes undefined values from props', () => {
			const props = { a: 1, b: undefined };
			const result = serializeProps(props);
			expect(result).toEqual({ a: 1 });
		});

		it('removes nested function values', () => {
			const props = { data: { value: 42, handler: () => {} } };
			const result = serializeProps(props);
			expect(result).toEqual({ data: { value: 42 } });
		});

		it('strips all non-serializable keys from a mixed object', () => {
			const props = {
				str: 'hello',
				num: 42,
				bool: true,
				fn: function () {},
				arrow: () => {},
				sym: Symbol('x'),
				undef: undefined,
			};
			const result = serializeProps(props);
			expect(result).toEqual({ str: 'hello', num: 42, bool: true });
		});
	});

	describe('Requirement 4.2: preserves serializable values via JSON round-trip', () => {
		it('preserves strings', () => {
			const props = { name: 'Alice' };
			expect(serializeProps(props)).toEqual({ name: 'Alice' });
		});

		it('preserves numbers', () => {
			const props = { count: 42, pi: 3.14 };
			expect(serializeProps(props)).toEqual({ count: 42, pi: 3.14 });
		});

		it('preserves booleans', () => {
			const props = { active: true, disabled: false };
			expect(serializeProps(props)).toEqual({ active: true, disabled: false });
		});

		it('preserves null', () => {
			const props = { value: null };
			expect(serializeProps(props)).toEqual({ value: null });
		});

		it('preserves arrays', () => {
			const props = { items: [1, 'two', true, null] };
			expect(serializeProps(props)).toEqual({ items: [1, 'two', true, null] });
		});

		it('preserves nested objects', () => {
			const props = { user: { name: 'Bob', age: 30 } };
			expect(serializeProps(props)).toEqual({ user: { name: 'Bob', age: 30 } });
		});

		it('returns empty object for empty input', () => {
			expect(serializeProps({})).toEqual({});
		});

		it('returns empty object when serialization fails', () => {
			const circular: Record<string, unknown> = {};
			circular.self = circular;
			expect(serializeProps(circular)).toEqual({});
		});
	});
});
