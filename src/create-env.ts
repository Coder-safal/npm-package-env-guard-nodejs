import { EnvValidationError } from './errors.js';
import type { EnvIssue } from './errors.js';
import { assertField } from './schema.js';
import type { CheckedSchema, EnvSchema, InferEnv } from './schema.js';
import type { EnvOptions } from './types.js';
import { parseValue, validateValue } from './validators.js';

export function createEnv<const S extends EnvSchema>(
  schema: S,
  ...args: S extends CheckedSchema<S>
    ? [options?: EnvOptions]
    : [options: never]
): InferEnv<S> {
  const options = args[0] ?? {};
  const fields = Object.entries(schema as EnvSchema);
  for (const [variable, field] of fields) assertField(field, variable);
  const source = options.source ?? process.env;
  const output: Record<string, unknown> = {};
  const issues: EnvIssue[] = [];
  for (const [variable, field] of fields) {
    const raw: unknown = Object.hasOwn(source, variable)
      ? source[variable]
      : undefined;
    let result;
    if (raw === undefined) {
      if (Object.hasOwn(field, 'default')) {
        result = validateValue(field, field.default);
      } else if (field.optional) {
        result = { ok: true as const, value: undefined };
      } else {
        result = {
          ok: false as const,
          code: 'MISSING_REQUIRED' as const,
          message: 'Required variable is missing.',
        };
      }
    } else if (typeof raw !== 'string') {
      result = {
        ok: false as const,
        code: 'INVALID_TYPE' as const,
        message: 'Expected a source string.',
      };
    } else {
      const parsed = parseValue(field, raw);
      result = parsed.ok ? validateValue(field, parsed.value) : parsed;
    }
    if (result.ok) {
      Object.defineProperty(output, variable, {
        value: result.value,
        enumerable: true,
      });
    } else {
      issues.push({ variable, code: result.code, message: result.message });
    }
  }
  if (issues.length) throw new EnvValidationError(issues);
  return Object.freeze(output) as InferEnv<S>;
}
