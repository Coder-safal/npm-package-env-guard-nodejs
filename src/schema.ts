type Presence<T> =
  | { readonly optional: true; readonly required?: never; readonly default?: T }
  | {
      readonly optional?: never;
      readonly required?: true;
      readonly default?: T;
    };

type Rules<T> = Presence<T> & {
  /** Return true to accept. False or a thrown exception produces a generic issue. */
  readonly validate?: (value: T) => boolean;
};

export type StringField = Rules<string> & {
  readonly type: 'string';
  readonly trim?: boolean;
  readonly minLength?: number;
  readonly maxLength?: number;
};
export type NumberField = Rules<number> & {
  readonly type: 'number';
  readonly integer?: boolean;
  readonly min?: number;
  readonly max?: number;
};
export type BooleanField = Rules<boolean> & { readonly type: 'boolean' };
export type EnumField = Rules<string> & {
  readonly type: 'enum';
  readonly values: readonly [string, ...string[]];
};
export type UrlField = Rules<string> & {
  readonly type: 'url';
  /** Protocols include the trailing colon, for example 'https:'. */
  readonly protocols?: readonly [string, ...string[]];
};
export type PortField = Rules<number> & { readonly type: 'port' };
export type JsonField = Rules<unknown> & { readonly type: 'json' };
export type EnvField =
  | StringField
  | NumberField
  | BooleanField
  | EnumField
  | UrlField
  | PortField
  | JsonField;
export type EnvSchema = Readonly<Record<string, EnvField>>;

type Value<F> = F extends {
  readonly type: 'enum';
  readonly values: readonly (infer V)[];
}
  ? V
  : F extends { readonly type: 'number' | 'port' }
    ? number
    : F extends { readonly type: 'boolean' }
      ? boolean
      : F extends { readonly type: 'json' }
        ? unknown
        : string;

export type InferEnv<S extends EnvSchema> = {
  readonly [K in keyof S]: S[K] extends { readonly default: unknown }
    ? Value<S[K]>
    : S[K] extends { readonly optional: true }
      ? Value<S[K]> | undefined
      : Value<S[K]>;
};

/** Reject unrelated field options and defaults outside enum literal values. */
export type CheckedSchema<S extends EnvSchema> = {
  readonly [K in keyof S]: Exclude<
    keyof S[K],
    keyof Extract<EnvField, { type: S[K]['type'] }>
  > extends never
    ? S[K] extends {
        readonly type: 'enum';
        readonly values: readonly (infer V)[];
        readonly default: infer D;
      }
      ? [D] extends [V]
        ? S[K]
        : never
      : S[K]
    : never;
};

const fieldOptions = {
  string: ['trim', 'minLength', 'maxLength'],
  number: ['integer', 'min', 'max'],
  boolean: [],
  enum: ['values'],
  url: ['protocols'],
  port: [],
  json: [],
} satisfies Record<EnvField['type'], readonly string[]>;
const commonOptions = ['type', 'required', 'optional', 'default', 'validate'];

/** Reject nonsensical constraints before reading any environment values. */
export function assertField(
  field: unknown,
  variable: string,
): asserts field is EnvField {
  const invalid = (): never => {
    throw new TypeError(`Invalid schema definition for ${variable}.`);
  };
  if (typeof field !== 'object' || field === null || Array.isArray(field))
    invalid();
  const definition = field as Record<string, unknown>;
  if (
    typeof definition.type !== 'string' ||
    !['string', 'number', 'boolean', 'enum', 'url', 'port', 'json'].includes(
      definition.type,
    )
  )
    invalid();
  const allowed = [
    ...commonOptions,
    ...fieldOptions[definition.type as EnvField['type']],
  ];
  if (
    Reflect.ownKeys(definition).some(
      (key) => typeof key !== 'string' || !allowed.includes(key),
    )
  )
    invalid();
  if (
    (definition.required !== undefined && definition.required !== true) ||
    (definition.optional !== undefined && definition.optional !== true) ||
    (definition.required === true && definition.optional === true) ||
    (definition.validate !== undefined &&
      typeof definition.validate !== 'function')
  )
    invalid();
  if (definition.type === 'string' || definition.type === 'number') {
    const lower =
      definition.type === 'string' ? definition.minLength : definition.min;
    const upper =
      definition.type === 'string' ? definition.maxLength : definition.max;
    for (const bound of [lower, upper]) {
      if (
        bound !== undefined &&
        (typeof bound !== 'number' ||
          !Number.isFinite(bound) ||
          (definition.type === 'string' &&
            (!Number.isInteger(bound) || bound < 0)))
      )
        invalid();
    }
    if (typeof lower === 'number' && typeof upper === 'number' && lower > upper)
      invalid();
    const flag =
      definition.type === 'string' ? definition.trim : definition.integer;
    if (flag !== undefined && typeof flag !== 'boolean') invalid();
  }
  if (
    definition.type === 'enum' ||
    (definition.type === 'url' && definition.protocols !== undefined)
  ) {
    const values: unknown =
      definition.type === 'enum' ? definition.values : definition.protocols;
    if (
      !Array.isArray(values) ||
      values.length === 0 ||
      !Array.from(values).every(
        (value: unknown) =>
          typeof value === 'string' &&
          (definition.type !== 'url' || /^[a-z][a-z0-9+.-]*:$/.test(value)),
      )
    )
      invalid();
  }
}
