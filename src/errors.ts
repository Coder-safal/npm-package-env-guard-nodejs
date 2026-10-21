export type EnvIssueCode =
  | 'MISSING_REQUIRED'
  | 'INVALID_TYPE'
  | 'INVALID_FORMAT'
  | 'OUT_OF_RANGE'
  | 'CUSTOM_VALIDATION_FAILED';

export interface EnvIssue {
  readonly variable: string;
  readonly code: EnvIssueCode;
  readonly message: string;
}

export class EnvValidationError extends Error {
  readonly issues: readonly EnvIssue[];

  constructor(issues: readonly EnvIssue[]) {
    super(
      `Environment validation failed (${issues.length} issues):\n${issues
        .map((issue) => `${issue.variable}: ${issue.message} [${issue.code}]`)
        .join('\n')}`,
    );
    this.name = 'EnvValidationError';
    this.issues = Object.freeze(
      issues.map((issue) => Object.freeze({ ...issue })),
    );
  }
}
