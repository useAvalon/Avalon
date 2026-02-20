/**
 * Property-based tests for IntegrationConfigEntrySchema and AvalonConfigSchema
 *
 * Feature: zod-typescript-cleanup, Property 4: New Zod schemas correctly validate their corresponding types
 * Validates: Requirements 4.1, 4.2
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  IntegrationConfigEntrySchema,
  AvalonConfigSchema,
} from '../integration-config.ts';

// Arbitrary for valid IntegrationConfigEntry objects
const validEntryArb = fc.record({
  name: fc.string({ minLength: 1 }),
  enabled: fc.option(fc.boolean(), { nil: undefined }),
  options: fc.option(
    fc.dictionary(fc.string(), fc.anything()),
    { nil: undefined }
  ),
});

describe('IntegrationConfigEntrySchema', () => {
  // Feature: zod-typescript-cleanup, Property 4: New Zod schemas correctly validate their corresponding types
  it('accepts valid IntegrationConfigEntry objects', () => {
    fc.assert(
      fc.property(validEntryArb, (entry) => {
        const result = IntegrationConfigEntrySchema.safeParse(entry);
        return result.success;
      }),
      { numRuns: 100 }
    );
  });

  // Feature: zod-typescript-cleanup, Property 4: New Zod schemas correctly validate their corresponding types
  it('rejects entries missing the required name field', () => {
    fc.assert(
      fc.property(
        fc.record({ enabled: fc.boolean() }), // no name field
        (entry) => {
          const result = IntegrationConfigEntrySchema.safeParse(entry);
          return !result.success;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects entries where name is not a string', () => {
    fc.assert(
      fc.property(
        fc.record({ name: fc.oneof(fc.integer(), fc.boolean(), fc.constant(null)) }),
        (entry) => {
          const result = IntegrationConfigEntrySchema.safeParse(entry);
          return !result.success;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accepts entry with only required name field', () => {
    const result = IntegrationConfigEntrySchema.safeParse({ name: 'preact' });
    expect(result.success).toBe(true);
  });

  it('accepts entry with all optional fields', () => {
    const result = IntegrationConfigEntrySchema.safeParse({
      name: 'react',
      enabled: true,
      options: { ssr: true },
    });
    expect(result.success).toBe(true);
  });
});

describe('AvalonConfigSchema', () => {
  // Feature: zod-typescript-cleanup, Property 4: New Zod schemas correctly validate their corresponding types
  it('accepts valid AvalonConfig objects', () => {
    fc.assert(
      fc.property(
        fc.record({
          integrations: fc.option(fc.array(validEntryArb), { nil: undefined }),
          autoDiscoverIntegrations: fc.option(fc.boolean(), { nil: undefined }),
          validateIntegrations: fc.option(fc.boolean(), { nil: undefined }),
          showWarnings: fc.option(fc.boolean(), { nil: undefined }),
        }),
        (config) => {
          const result = AvalonConfigSchema.safeParse(config);
          return result.success;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accepts an empty config object (all fields optional)', () => {
    const result = AvalonConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects config where integrations is not an array', () => {
    fc.assert(
      fc.property(
        fc.record({ integrations: fc.oneof(fc.string(), fc.integer(), fc.boolean()) }),
        (config) => {
          const result = AvalonConfigSchema.safeParse(config);
          return !result.success;
        }
      ),
      { numRuns: 100 }
    );
  });
});
