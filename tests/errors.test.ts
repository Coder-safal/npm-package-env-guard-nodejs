import { inspect } from 'node:util';
import { expect, it, vi } from 'vitest';
import { createEnv, EnvValidationError } from '../src/index.js';

it('aggregates immutable issues in schema declaration order', () => {
  try {
    createEnv(
      {
        MISSING: { type: 'string' },
        BAD: { type: 'boolean' },
        RANGE: { type: 'port' },
      },
      { source: { BAD: 'no', RANGE: '0' } },
    );
    expect.unreachable();
  } catch (error) {
    expect(error).toBeInstanceOf(EnvValidationError);
    if (!(error instanceof EnvValidationError)) throw error;
    expect(error.issues.map(({ variable, code }) => [variable, code])).toEqual([
      ['MISSING', 'MISSING_REQUIRED'],
      ['BAD', 'INVALID_FORMAT'],
      ['RANGE', 'OUT_OF_RANGE'],
    ]);
    expect(Object.isFrozen(error.issues)).toBe(true);
    expect(error.issues.every(Object.isFrozen)).toBe(true);
    expect(error.message).toContain('3 issues');
  }
});

it('never leaks source values, thrown messages, or validator return values', () => {
  const secret = 'test-secret-123';
  const password = 'postgres://admin:database-password@localhost/db';
  const token = 'token-sentinel-456';
  const log = vi.spyOn(console, 'log');
  const warn = vi.spyOn(console, 'warn');
  const errorLog = vi.spyOn(console, 'error');
  try {
    createEnv(
      {
        NUMBER: { type: 'number' },
        URL: { type: 'url', protocols: ['https:'] },
        JSON: { type: 'json' },
        CUSTOM: {
          type: 'string',
          validate: (value) => {
            throw new Error(value);
          },
        },
        FALSE: { type: 'string', validate: () => false },
        ENUM: { type: 'enum', values: [token] },
      },
      {
        source: {
          NUMBER: secret,
          URL: password,
          JSON: `{${token}`,
          CUSTOM: secret,
          FALSE: token,
          ENUM: secret,
        },
      },
    );
    expect.unreachable();
  } catch (error) {
    expect(error).toBeInstanceOf(EnvValidationError);
    const rendered = [
      String(error),
      JSON.stringify(error),
      inspect(error),
      error instanceof Error ? error.stack : '',
    ].join('\n');
    for (const value of [secret, password, token, 'database-password'])
      expect(rendered).not.toContain(value);
    if (error instanceof EnvValidationError)
      expect(error.issues).toHaveLength(6);
  } finally {
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  }
});

it.each([
  'test-secret-123',
  1,
  null,
  undefined,
  { token: 'token-sentinel-456' },
])(
  'rejects non-boolean validator returns without exposing them',
  (returned) => {
    const validate = (() => returned) as unknown as (value: string) => boolean;
    expect(() =>
      createEnv(
        { VALUE: { type: 'string', validate } },
        { source: { VALUE: 'database-password' } },
      ),
    ).toThrow('Custom validation failed.');
    try {
      createEnv(
        { VALUE: { type: 'string', validate } },
        { source: { VALUE: 'database-password' } },
      );
    } catch (error) {
      const rendered = [
        String(error),
        JSON.stringify(error),
        inspect(error),
      ].join('\n');
      for (const secret of [
        'test-secret-123',
        'token-sentinel-456',
        'database-password',
      ])
        expect(rendered).not.toContain(secret);
      expect(error).toBeInstanceOf(EnvValidationError);
      if (error instanceof EnvValidationError)
        expect(error.issues[0]?.code).toBe('CUSTOM_VALIDATION_FAILED');
    }
  },
);

it('keeps invalid defaults and schema option names out of all error renderings', () => {
  const cases: readonly (() => unknown)[] = [
    () =>
      createEnv(
        {
          VALUE: {
            type: 'url',
            default: 'postgres://admin:database-password@localhost/db',
            protocols: ['https:'],
          },
        },
        { source: {} },
      ),
    () =>
      createEnv(
        {
          VALUE: {
            type: 'string',
            default: 'test-secret-123',
            validate: (value) => {
              throw new Error(value);
            },
          },
        },
        { source: {} },
      ),
    () =>
      createEnv(
        {
          VALUE: { type: 'number', 'token-sentinel-456': 1 },
        } as unknown as import('../src/index.js').EnvSchema,
        { source: {} },
      ),
  ];
  for (const run of cases) {
    expect(run).toThrow();
    try {
      run();
    } catch (error) {
      const rendered = [
        String(error),
        JSON.stringify(error),
        inspect(error),
        error instanceof Error ? error.stack : '',
      ].join('\n');
      for (const secret of [
        'test-secret-123',
        'database-password',
        'token-sentinel-456',
      ])
        expect(rendered).not.toContain(secret);
    }
  }
});
