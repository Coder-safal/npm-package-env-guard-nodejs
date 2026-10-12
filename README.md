# EnvGuard

Type-safe environment configuration and startup validation for Node.js.
`@coder-safal/envguard` has zero runtime dependencies and provides ESM and CommonJS
entry points with TypeScript declarations. Requires Node.js 22+ and TypeScript 5.4+
for TypeScript consumers.

## Install

After the package is published:

```bash
pnpm add @coder-safal/envguard
```

This repository contains the implementation; publication is a separate step.

## Usage

```ts
import { createEnv, EnvValidationError } from '@coder-safal/envguard';

const env = createEnv({
  PORT: { type: 'port', default: 3000 },
  DEBUG: { type: 'boolean', default: false },
  NODE_ENV: {
    type: 'enum',
    values: ['development', 'test', 'production'],
    default: 'development',
  },
  DATABASE_URL: {
    type: 'url',
    required: true,
    protocols: ['postgres:', 'postgresql:'],
  },
  OPTIONAL_LABEL: { type: 'string', optional: true },
});

env.PORT; // number
env.DEBUG; // boolean
env.NODE_ENV; // 'development' | 'test' | 'production'
env.DATABASE_URL; // string
env.OPTIONAL_LABEL; // string | undefined
```

`createEnv(schema, { source })` accepts a readonly record of strings or undefined.
It defaults to `process.env`, reads only own source properties, ignores extra
source keys, and never writes to the source or `process.env`. Load any `.env` file
before calling EnvGuard, using Node's environment-file support or a separate loader.

```ts
const env = createEnv(
  { PORT: { type: 'port', default: 3000 } },
  { source: { PORT: '8080' } },
);
```

CommonJS consumers use named exports:

```js
const { createEnv } = require('@coder-safal/envguard');
```

## Schema

All fields are required unless marked `optional: true`. `required: true` can make
that intent explicit; combining both flags is a type error. An absent property or
`undefined` is missing. Empty strings are supplied values and are never replaced
with a default. Present invalid values always fail, even when a default exists.

A `default` is an already typed value. It is validated but not parsed or trimmed.
It makes the output non-optional, even on an optional field. Constraints and custom
validators apply to defaults too.

| Type      | Output        | Parsing and constraints                                                                                                                                                              |
| --------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `string`  | `string`      | Exact input; optional `trim`, `minLength`, `maxLength` (UTF-16 code units). Empty allowed unless constrained.                                                                        |
| `number`  | `number`      | Finite signed decimal, including `.5`, `1.`, `1e3`; optional `integer`, inclusive `min`, `max`. Rejects whitespace, radix prefixes, separators, NaN and infinity.                    |
| `boolean` | `boolean`     | Case-insensitive `true` or `false` only. Rejects `1`, `0`, whitespace and other strings.                                                                                             |
| `enum`    | Literal union | Nonempty `values` tuple; exact case-sensitive match. Defaults must be declared members.                                                                                              |
| `url`     | `string`      | Absolute WHATWG URL, returned unchanged. Optional nonempty `protocols` list such as `['https:']`. All protocols allowed unless restricted. Standard URL whitespace handling applies. |
| `port`    | `number`      | Decimal digits only; integer 1–65535 inclusive. Leading zeroes allowed; signs, decimal points and exponent notation rejected.                                                        |
| `json`    | `unknown`     | Standard `JSON.parse`; malformed JSON fails. No structural validation or inferred object shape.                                                                                      |

Numeric fields use JavaScript IEEE-754 `number` precision. `integer: true` checks
integrality, not safe-integer precision. For integer configuration that must stay
within the safe range, set `integer: true`, `min: Number.MIN_SAFE_INTEGER` and
`max: Number.MAX_SAFE_INTEGER`. Keep exact large identifiers as strings; decimal
fractions and values beyond the safe range may round during parsing.

Numbers use the grammar `[+-]?(digits[.digits?]?|.digits)([eE][+-]?digits)?`.
Enums preserve literal unions with inline schemas, or use `as const satisfies EnvSchema`
for reusable schemas. Annotating a schema as the broad `EnvSchema` type loses its
specific literals and presence information.

Every field also accepts `validate(value): boolean`:

```ts
const env = createEnv({
  WORKERS: {
    type: 'number',
    integer: true,
    min: 1,
    max: 64,
    default: 4,
    validate: (value) => value % 2 === 0,
  },
});
```

The callback runs exactly once after built-in validation succeeds, including for
defaults. Missing optional values skip it. Only `true` accepts a value. False,
non-boolean JavaScript returns and thrown exceptions produce the generic
`CUSTOM_VALIDATION_FAILED` issue; thrown messages and return values are discarded.
Callbacks are trusted application code: keep them pure and never log their inputs.

## Errors

All field failures are aggregated into one `EnvValidationError`:

```ts
try {
  createEnv(
    { PORT: { type: 'port' }, DEBUG: { type: 'boolean' } },
    { source: { PORT: '0', DEBUG: 'yes' } },
  );
} catch (error) {
  if (error instanceof EnvValidationError) {
    // Safe diagnostics: variable names, codes, and fixed explanations only.
    const issues = error.issues;
    // [{ variable: 'PORT', code: 'OUT_OF_RANGE', message: '...' }, ...]
    void issues;
  } else {
    throw error;
  }
}
```

Codes are `MISSING_REQUIRED`, `INVALID_TYPE`, `INVALID_FORMAT`, `OUT_OF_RANGE` and
`CUSTOM_VALIDATION_FAILED`. Issues and the issue array are frozen. Ordering follows
JavaScript schema enumeration order (integer-like keys precede other string keys).
Messages never include input values, enum member lists, URL contents or custom
exceptions. Variable names must be static schema identifiers, never secrets.
Invalid schema definitions (such as nonfinite bounds, inverted ranges, empty enum
lists, sparse enum/protocol lists, unknown or misplaced field options, or malformed protocol lists) throw a generic `TypeError` before source values
are read. Constraints on string length must be nonnegative integers.
Schemas are trusted configuration; use plain source records, not getters or proxies
that may throw outside validation.

The returned object is shallowly frozen and has readonly properties in TypeScript.
Optional fields are present with value `undefined`. Nested parsed JSON and object
defaults remain mutable; defaults are not cloned. Never serialize or log the returned
configuration, which contains the successfully parsed secrets.

## Public API

Named runtime exports: `createEnv`, `EnvValidationError`.
Named type exports: `EnvSchema`, `EnvField`, `InferEnv`, `EnvSource`, `EnvOptions`,
`EnvIssue`, `EnvIssueCode`, `StringField`, `NumberField`, `BooleanField`, `EnumField`,
`UrlField`, `PortField`, `JsonField`. Internal parsers are not package entry points.

EnvGuard does not load files, fetch remote configuration, manage secrets, or provide
framework adapters. See [examples](./examples) for basic and Express-compatible usage,
[API decisions](./API_DECISIONS.md) for design details, and [SECURITY.md](./SECURITY.md)
for reporting guidance.

## Development

From this package directory, with Node.js 22.13+ or 24 and pnpm 10.32.1:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm audit
```

`pnpm check` runs formatting, ESLint, strict TypeScript checks (including negative
type fixtures and examples), runtime tests, ESM/CommonJS builds, and package checks.
`pnpm package:check` packs with pnpm, runs strict publint and Are the Types Wrong on
that tarball, checks an exact file allowlist and zero runtime dependencies, installs
it offline in a temporary consumer, runs ESM and CommonJS consumers, and compiles
both declaration consumers under NodeNext, Node16 and Bundler resolution with
TypeScript 5.4.5 and the development compiler. Temporary
consumer files are removed afterward. Run `pnpm build` before standalone package checks.

CI runs these checks on Node.js 22 and 24. Local results must be reported separately
from CI results; a workflow definition is not proof of a completed CI run.

## License

[MIT](./LICENSE). See [CONTRIBUTING.md](./CONTRIBUTING.md) to contribute.
