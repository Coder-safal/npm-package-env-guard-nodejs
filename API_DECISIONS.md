# API decisions for v1

The supplied specifications left these choices open. These decisions define the
implemented API and are covered by runtime and compile-time fixtures.

- Package root: the repository root (`env-guard`). Source, documentation, package
  metadata and GitHub Actions workflows live directly under this directory.
- Fields are required by default. `required: true` is explicit documentation;
  `optional: true` permits absence. The two flags cannot be combined.
- `undefined` or no own source property means absent. Empty strings are supplied
  values. Inherited source properties are ignored.
- A default takes precedence over optionality and is validated, including by the
  custom validator, but is never parsed or trimmed. Invalid supplied values do
  not fall back to defaults.
- Strings are exact unless `trim: true`; length constraints count UTF-16 code
  units. Empty strings are valid strings unless constrained.
- Numbers accept signed decimal notation, decimal points and exponents; no
  surrounding whitespace, radix prefixes, separators, NaN or infinities.
- Booleans accept only case-insensitive `true` / `false`, without whitespace.
- Enums match exact declared strings and preserve literal unions. Empty members
  are permitted if explicitly declared. Enum defaults must be members.
- URLs return the original string after standard WHATWG URL validation. All
  absolute protocols are allowed by default; `protocols` restricts them using
  lowercase names with trailing colons. Standard URL normalization is used for
  validation only, including the constructor's whitespace handling.
- Ports accept decimal digits only (leading zeroes allowed), range 1–65535.
- JSON uses standard JSON.parse and returns unknown. No structural type assertion
  or deep freeze is implied. Typed defaults for JSON are also unknown.
- Custom `validate` returns boolean; only `true` accepts. False, non-boolean
  runtime returns and exceptions produce a fixed generic issue. It runs once
  after successful built-in validation, including defaults, and never on absent
  optional fields. There is no custom error-message option.
- Results include own enumerable properties for all schema keys, including
  optional fields set to undefined, and are shallowly frozen and readonly in
  TypeScript. Nested JSON/default objects remain mutable.
- Issue ordering follows Object.entries schema order (JavaScript sorts integer
  keys before other string keys). Diagnostics never enumerate allowed enum
  values, protocol lists, custom exceptions or source values.
- Malformed field definitions throw TypeError before reading the source. Numeric
  bounds must be finite and ordered; lengths must be nonnegative integers. Protocol
  allowlists use lowercase protocol names with trailing colons.
- Schemas and callbacks are trusted application code. Callbacks must be pure and
  must not log values. EnvGuard cannot prevent a callback from performing its
  own side effects. Sources should be plain data records, not throwing getters
  or proxies. Variable names in schemas should be static identifiers, not secrets.
- Node.js 22 and 24 are the CI targets; TypeScript 5.4+ is needed for const generic
  inference in declarations. Runtime dependencies remain zero.
- MIT was selected by the owner during implementation; copyright uses the given
  public handle, coder-safal. Publication remains a separate owner action.

## Schema hardening and compatibility review

- Runtime field definitions reject unknown own keys, including misplaced options,
  non-enumerable keys and symbols. This matches the existing TypeScript contract;
  schema option names are not included in diagnostics because they may be sensitive.
- Enum and protocol lists must be dense arrays of strings. Array holes are invalid
  definitions, even when another element is valid.
- Numeric fields retain JavaScript Number semantics. `integer: true` checks
  integrality, not safe-integer precision. Use explicit safe bounds for integer
  configuration; exact large identifiers should remain strings. No new numeric
  option or implicit coercion is introduced.
- Consumer declarations are checked with both TypeScript 5.4.5 (the supported 5.4
  baseline) and the development compiler, across all advertised module resolutions.
- Repository and private reporting addresses must come from the maintainer; they
  cannot be inferred from the npm scope or invented during implementation.
