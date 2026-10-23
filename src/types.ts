/** Input values are never modified. Only own properties are read. */
export type EnvSource = Readonly<Record<string, string | undefined>>;

export interface EnvOptions {
  readonly source?: EnvSource;
}
