import { expect, expectTypeOf, it } from 'vitest';
import { createEnv, EnvValidationError } from '../src/index.js';
import type { EnvIssue, EnvSchema, InferEnv } from '../src/index.js';

it('preserves primitive, enum, optional and default types', () => {
  const env = createEnv(
    {
      TEXT: { type: 'string' },
      NUMBER: { type: 'number' },
      BOOL: { type: 'boolean' },
      PORT: { type: 'port', default: 80 },
      URL: { type: 'url' },
      JSON: { type: 'json' },
      MODE: { type: 'enum', values: ['dev', 'prod'], default: 'dev' },
      OPTIONAL: { type: 'string', optional: true },
      DEFAULTED: { type: 'number', optional: true, default: 0 },
    },
    {
      source: {
        TEXT: '',
        NUMBER: '1',
        BOOL: 'true',
        URL: 'https://example.com',
        JSON: '{}',
      },
    },
  );
  expectTypeOf(env.TEXT).toEqualTypeOf<string>();
  expectTypeOf(env.NUMBER).toEqualTypeOf<number>();
  expectTypeOf(env.BOOL).toEqualTypeOf<boolean>();
  expectTypeOf(env.PORT).toEqualTypeOf<number>();
  expectTypeOf(env.URL).toEqualTypeOf<string>();
  expectTypeOf(env.JSON).toEqualTypeOf<unknown>();
  expectTypeOf(env.MODE).toEqualTypeOf<'dev' | 'prod'>();
  expectTypeOf(env.OPTIONAL).toEqualTypeOf<string | undefined>();
  expectTypeOf(env.DEFAULTED).toEqualTypeOf<number>();
  const schema = {
    A: { type: 'enum', values: ['a', 'b'] },
  } as const satisfies EnvSchema;
  expect(createEnv(schema, { source: { A: 'a' } }).A).toBe('a');
  expectTypeOf<InferEnv<typeof schema>>().toEqualTypeOf<{
    readonly A: 'a' | 'b';
  }>();
  expectTypeOf(new EnvValidationError([]).issues).toEqualTypeOf<
    readonly EnvIssue[]
  >();
});

// These fixtures are checked by tsc, never executed.
function invalidSchemas() {
  // @ts-expect-error optional and required are mutually exclusive
  createEnv({ A: { type: 'string', optional: true, required: true } });
  // @ts-expect-error number defaults must be numbers
  createEnv({ A: { type: 'number', default: '1' } });
  // @ts-expect-error enum defaults must be members
  createEnv({ A: { type: 'enum', values: ['a', 'b'], default: 'c' } });
  // @ts-expect-error enum must have at least one value
  createEnv({ A: { type: 'enum', values: [] } });
  createEnv({
    // @ts-expect-error validator parameter must match the field type
    A: { type: 'number', validate: (value: string) => value.length > 0 },
  });
  // @ts-expect-error constraints cannot be used on unrelated field types
  createEnv({ A: { type: 'boolean', min: 1 } });
  // @ts-expect-error misspelled options are rejected even on reusable schemas
  createEnv({ A: { type: 'number', minn: 5 } } as const);
  // @ts-expect-error constraints belong to their declared field type
  createEnv({ A: { type: 'string', protocols: ['https:'] } });
  // @ts-expect-error custom validators must return boolean
  createEnv({ A: { type: 'string', validate: () => 'true' } });
  const env = createEnv({ A: { type: 'number', default: 1 } });
  // @ts-expect-error output properties are readonly
  env.A = 2;
}
void invalidSchemas;
