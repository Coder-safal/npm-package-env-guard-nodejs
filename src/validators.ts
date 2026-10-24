import type { EnvField } from './schema.js';
import type { EnvIssueCode } from './errors.js';

type Failure = {
  readonly ok: false;
  readonly code: EnvIssueCode;
  readonly message: string;
};
type Result = { readonly ok: true; readonly value: unknown } | Failure;
const fail = (code: EnvIssueCode, message: string): Failure => ({
  ok: false,
  code,
  message,
});
const success = (value: unknown): Result => ({ ok: true, value });
const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/** Parse external strings separately from checking already typed defaults. */
export function parseValue(field: EnvField, raw: string): Result {
  switch (field.type) {
    case 'string':
      return success(field.trim ? raw.trim() : raw);
    case 'url':
    case 'enum':
      return success(raw);
    case 'number':
      return numeric.test(raw)
        ? success(Number(raw))
        : fail('INVALID_FORMAT', 'Expected a decimal number.');
    case 'port':
      return /^\d+$/.test(raw)
        ? success(Number(raw))
        : fail('INVALID_FORMAT', 'Expected a port as decimal digits.');
    case 'boolean':
      return /^(true|false)$/i.test(raw)
        ? success(raw.toLowerCase() === 'true')
        : fail('INVALID_FORMAT', 'Expected true or false.');
    case 'json':
      try {
        return success(JSON.parse(raw) as unknown);
      } catch {
        return fail('INVALID_FORMAT', 'Expected valid JSON.');
      }
  }
}

export function validateValue(field: EnvField, value: unknown): Result {
  switch (field.type) {
    case 'string':
      if (typeof value !== 'string')
        return fail('INVALID_TYPE', 'Expected a string.');
      if (
        (field.minLength !== undefined && value.length < field.minLength) ||
        (field.maxLength !== undefined && value.length > field.maxLength)
      )
        return fail(
          'OUT_OF_RANGE',
          'String length is outside the allowed range.',
        );
      break;
    case 'number':
    case 'port':
      if (typeof value !== 'number' || !Number.isFinite(value))
        return fail('INVALID_TYPE', 'Expected a finite number.');
      if (field.type === 'port') {
        if (!Number.isInteger(value) || value < 1 || value > 65535)
          return fail(
            'OUT_OF_RANGE',
            'Expected an integer port from 1 to 65535.',
          );
      } else {
        if (field.integer && !Number.isInteger(value))
          return fail('INVALID_FORMAT', 'Expected an integer.');
        if (
          (field.min !== undefined && value < field.min) ||
          (field.max !== undefined && value > field.max)
        )
          return fail('OUT_OF_RANGE', 'Number is outside the allowed range.');
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean')
        return fail('INVALID_TYPE', 'Expected a boolean.');
      break;
    case 'enum':
      if (typeof value !== 'string' || !field.values.includes(value))
        return fail('INVALID_FORMAT', 'Expected a declared enum member.');
      break;
    case 'url':
      if (typeof value !== 'string')
        return fail('INVALID_TYPE', 'Expected a URL string.');
      try {
        const url = new URL(value);
        if (field.protocols && !field.protocols.includes(url.protocol))
          return fail(
            'INVALID_FORMAT',
            'Expected a URL with an allowed protocol.',
          );
      } catch {
        return fail('INVALID_FORMAT', 'Expected an absolute URL.');
      }
      break;
    case 'json':
      break;
  }
  if (field.validate) {
    try {
      // The discriminated schema ties the callback to the parsed value type.
      const validate = field.validate as (value: unknown) => boolean;
      if (validate(value) !== true)
        return fail('CUSTOM_VALIDATION_FAILED', 'Custom validation failed.');
    } catch {
      return fail('CUSTOM_VALIDATION_FAILED', 'Custom validation failed.');
    }
  }
  return success(value);
}
