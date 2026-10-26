import { describe, expect, it } from 'vitest';
import { createEnv, EnvValidationError } from '../src/index.js';
import type { EnvField } from '../src/index.js';

function parse(field: EnvField, value: string): unknown {
  return createEnv({ VALUE: field }, { source: { VALUE: value } }).VALUE;
}

describe('parsers', () => {
  it.each(['', ' hello ', '日本語 🔐', '\n'])(
    'preserves strings %j',
    (value) => {
      expect(parse({ type: 'string' }, value)).toBe(value);
    },
  );
  it('supports explicit trim and UTF-16 length limits', () => {
    expect(
      parse({ type: 'string', trim: true, minLength: 2, maxLength: 2 }, ' ab '),
    ).toBe('ab');
    expect(() => parse({ type: 'string', minLength: 1 }, '')).toThrow(
      EnvValidationError,
    );
    expect(() => parse({ type: 'string', maxLength: 1 }, 'ab')).toThrow(
      EnvValidationError,
    );
  });
  it.each(['0', '-12', '+1', '1.5', '.5', '1.', '1e3', '-2E-2'])(
    'accepts decimal %s',
    (value) => {
      expect(parse({ type: 'number' }, value)).toBe(Number(value));
    },
  );
  it.each([
    '',
    ' ',
    ' 1',
    '1 ',
    '0x10',
    '0b10',
    'NaN',
    'Infinity',
    '1e999',
    '1_000',
    '12px',
    '--1',
  ])('rejects number %j', (value) => {
    expect(() => parse({ type: 'number' }, value)).toThrow(EnvValidationError);
  });
  it('checks inclusive number bounds and integer constraint', () => {
    const field = { type: 'number', min: 1, max: 2, integer: true } as const;
    expect(parse(field, '1')).toBe(1);
    expect(parse(field, '2')).toBe(2);
    for (const value of ['0', '3', '1.5'])
      expect(() => parse(field, value)).toThrow(EnvValidationError);
  });
  it.each(['true', 'TRUE', 'TrUe', 'false', 'FALSE'])(
    'accepts boolean %s',
    (value) => {
      expect(parse({ type: 'boolean' }, value)).toBe(
        value.toLowerCase() === 'true',
      );
    },
  );
  it.each(['', '1', '0', 'yes', ' false ', 'anything'])(
    'rejects boolean %j',
    (value) => {
      expect(() => parse({ type: 'boolean' }, value)).toThrow(
        EnvValidationError,
      );
    },
  );
  it('matches enums exactly, including an explicitly allowed empty string', () => {
    const field = { type: 'enum', values: ['dev', 'prod', ''] } as const;
    expect(parse(field, 'prod')).toBe('prod');
    expect(parse(field, '')).toBe('');
    expect(() => parse(field, 'DEV')).toThrow(EnvValidationError);
    expect(() => parse(field, ' prod')).toThrow(EnvValidationError);
  });
  it('returns the original URL and supports protocol restrictions', () => {
    const value = 'https://example.com/path';
    expect(parse({ type: 'url' }, value)).toBe(value);
    expect(
      parse({ type: 'url' }, 'postgres://user:password@localhost/db'),
    ).toBe('postgres://user:password@localhost/db');
    expect(() =>
      parse({ type: 'url', protocols: ['https:'] }, 'http://example.com'),
    ).toThrow(EnvValidationError);
    expect(() => parse({ type: 'url' }, '/relative')).toThrow(
      EnvValidationError,
    );
    expect(() => parse({ type: 'url' }, '')).toThrow(EnvValidationError);
  });
  it.each(['1', '65535', '00080'])('accepts port %s', (value) => {
    expect(parse({ type: 'port' }, value)).toBe(Number(value));
  });
  it.each(['0', '65536', '-1', '+80', '1.5', '1e3', ' 80', '', 'Infinity'])(
    'rejects port %j',
    (value) => {
      expect(() => parse({ type: 'port' }, value)).toThrow(EnvValidationError);
    },
  );
  it.each(['null', 'false', '42', '"hello"', '[1,2]', '{"nested":{"x":1}}'])(
    'parses JSON %s',
    (value) => {
      expect(parse({ type: 'json' }, value)).toEqual(JSON.parse(value));
    },
  );
  it.each(['', 'undefined', '{', '{"x":}', 'NaN'])(
    'rejects JSON %j',
    (value) => {
      expect(() => parse({ type: 'json' }, value)).toThrow(EnvValidationError);
    },
  );
});

it.each(['\n', '\r', '\r\n', '\u2028', '\u2029'])(
  'rejects trailing line terminator %j in strict parsers',
  (ending) => {
    for (const [field, value] of [
      [{ type: 'number' }, '123'],
      [{ type: 'port' }, '80'],
      [{ type: 'boolean' }, 'true'],
      [{ type: 'boolean' }, 'false'],
    ] as const) {
      expect(() => parse(field, value + ending)).toThrow(EnvValidationError);
    }
  },
);

it('enforces explicit safe-integer bounds for source values and defaults', () => {
  const field = {
    type: 'number',
    integer: true,
    min: Number.MIN_SAFE_INTEGER,
    max: Number.MAX_SAFE_INTEGER,
  } as const;
  for (const value of [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]) {
    expect(parse(field, String(value))).toBe(value);
    expect(
      createEnv({ VALUE: { ...field, default: value } }, { source: {} }).VALUE,
    ).toBe(value);
  }
  for (const raw of [
    '9007199254740992',
    '9007199254740993',
    '-9007199254740993',
  ])
    expect(() => parse(field, raw)).toThrow(EnvValidationError);
  expect(() =>
    createEnv(
      { VALUE: { ...field, default: Number.MAX_SAFE_INTEGER + 1 } },
      { source: {} },
    ),
  ).toThrow(EnvValidationError);
});
