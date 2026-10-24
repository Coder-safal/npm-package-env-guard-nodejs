import { describe, expect, it, vi } from 'vitest';
import { createEnv, EnvValidationError } from '../src/index.js';
import type { EnvSource } from '../src/index.js';

describe('createEnv', () => {
  it('requires fields by default and honors explicit required', () => {
    expect(() =>
      createEnv(
        { A: { type: 'string' }, B: { type: 'number', required: true } },
        { source: {} },
      ),
    ).toThrow(EnvValidationError);
  });
  it('applies defaults only to absent values and includes optional keys', () => {
    expect(
      createEnv(
        {
          A: { type: 'port', default: 3000 },
          B: { type: 'string', optional: true },
          C: { type: 'boolean', optional: true, default: false },
        },
        { source: { A: undefined } },
      ),
    ).toEqual({ A: 3000, B: undefined, C: false });
    expect(() =>
      createEnv({ A: { type: 'number', default: 1 } }, { source: { A: '' } }),
    ).toThrow(EnvValidationError);
  });
  it('validates defaults without parsing or trimming them', () => {
    expect(() =>
      createEnv({ A: { type: 'port', default: 0 } }, { source: {} }),
    ).toThrow(EnvValidationError);
    expect(
      createEnv(
        { A: { type: 'string', trim: true, default: ' a ' } },
        { source: {} },
      ).A,
    ).toBe(' a ');
    expect(() =>
      createEnv({ A: { type: 'number', default: NaN } }, { source: {} }),
    ).toThrow(EnvValidationError);
    expect(() =>
      createEnv({ A: { type: 'url', default: 'invalid' } }, { source: {} }),
    ).toThrow(EnvValidationError);
  });
  it('calls custom validators exactly once for parsed values and defaults', () => {
    const validate = vi.fn((value: number) => value > 0);
    const schema = { A: { type: 'number', default: 2, validate } } as const;
    createEnv(schema, { source: { A: '1' } });
    expect(validate).toHaveBeenCalledExactlyOnceWith(1);
    validate.mockClear();
    createEnv(schema, { source: {} });
    expect(validate).toHaveBeenCalledExactlyOnceWith(2);
    validate.mockClear();
    expect(() => createEnv(schema, { source: { A: 'invalid' } })).toThrow(
      EnvValidationError,
    );
    expect(validate).not.toHaveBeenCalled();
  });
  it('does not call validators for missing optional fields', () => {
    const validate = vi.fn(() => true);
    createEnv(
      { A: { type: 'string', optional: true, validate } },
      { source: {} },
    );
    expect(validate).not.toHaveBeenCalled();
  });
  it('returns a shallow frozen result without mutating source or process.env', () => {
    const source = Object.freeze({ A: '{"nested":true}', EXTRA: 'ignored' });
    const before = { ...process.env };
    const schema = { A: { type: 'json' } } as const;
    const first = createEnv(schema, { source });
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.A)).toBe(false);
    expect(createEnv(schema, { source })).toEqual(first);
    expect(source).toEqual({ A: '{"nested":true}', EXTRA: 'ignored' });
    expect(process.env).toEqual(before);
    expect(() => Reflect.set(first, 'A', 1)).not.toThrow();
    expect(Reflect.set(first, 'A', 1)).toBe(false);
  });
  it('uses process.env by default without writing to it', () => {
    const before = { ...process.env };
    expect(createEnv({ PATH: { type: 'string', optional: true } }).PATH).toBe(
      process.env.PATH,
    );
    expect(process.env).toEqual(before);
  });
  it('ignores inherited source values and supports special property names', () => {
    const source = Object.create({ INHERITED: 'hidden' }) as EnvSource;
    expect(
      createEnv({ INHERITED: { type: 'string', optional: true } }, { source })
        .INHERITED,
    ).toBeUndefined();
    const result = createEnv(
      { ['__proto__']: { type: 'string' }, constructor: { type: 'string' } },
      {
        source: JSON.parse(
          '{"__proto__":"safe","constructor":"safe"}',
        ) as EnvSource,
      },
    );
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.hasOwn(result, '__proto__')).toBe(true);
    expect(result.constructor).toBe('safe');
  });
  it('handles non-string input safely at a JavaScript trust boundary', () => {
    const source = { A: 42 } as unknown as EnvSource;
    expect(() => createEnv({ A: { type: 'number' } }, { source })).toThrow(
      EnvValidationError,
    );
  });
  it('supports an empty schema', () => {
    expect(createEnv({}, { source: {} })).toEqual({});
  });
});

it.each([
  { type: 'number', min: NaN },
  { type: 'number', max: Infinity },
  { type: 'number', min: 2, max: 1 },
  { type: 'string', minLength: -1 },
  { type: 'string', maxLength: 1.5 },
  { type: 'string', minLength: 3, maxLength: 2 },
  { type: 'string', trim: 'yes' },
  { type: 'number', integer: 'yes' },
  { type: 'enum', values: [] },
  { type: 'enum', values: [42] },
  { type: 'url', protocols: [] },
  { type: 'url', protocols: ['HTTPS:'] },
  { type: 'url', protocols: ['https'] },
  { type: 'string', required: true, optional: true },
  { type: 'string', validate: 42 },
  { type: 'unrecognized' },
  null,
])(
  'rejects malformed schema definitions without reading source values',
  (field) => {
    const source = Object.defineProperty({}, 'A', {
      get: () => {
        throw new Error('test-secret-123');
      },
    }) as EnvSource;
    // Simulate an untyped JavaScript caller.
    const schema = {
      A: field,
    } as unknown as import('../src/index.js').EnvSchema;
    expect(() => createEnv(schema, { source })).toThrow(
      'Invalid schema definition for A.',
    );
  },
);

it.each([
  { type: 'boolean', min: 1 },
  { type: 'number', minn: 5 },
  { type: 'string', protocols: ['https:'] },
  { type: 'enum', values: new Array<unknown>(1) },
  { type: 'enum', values: ['valid', ...new Array<unknown>(1)] },
  { type: 'url', protocols: new Array<unknown>(1) },
  { type: 'string', [Symbol('test-secret-123')]: true },
  Object.defineProperty({ type: 'number' }, 'test-secret-123', { value: 1 }),
])(
  'rejects unsupported options and sparse lists before source reads',
  (field) => {
    const read = vi.fn(() => 'value');
    const source = Object.defineProperty({}, 'A', { get: read }) as EnvSource;
    const schema = {
      A: field,
    } as unknown as import('../src/index.js').EnvSchema;
    expect(() => createEnv(schema, { source })).toThrow(
      'Invalid schema definition for A.',
    );
    expect(read).not.toHaveBeenCalled();
  },
);
