# Security Policy

## Scope

EnvGuard validates and parses environment configuration. It is not a secret manager, encryption system, access-control system, or secure storage solution.

## Reporting a vulnerability

Please do not publish sensitive vulnerability details in a public issue. Contact the maintainer through a private security reporting channel configured in the repository or npm/GitHub profile. If no private channel is listed yet, contact the maintainer privately before sharing exploit details.

Do not invent or publish an email address until the maintainer has configured one.

## Security requirements

- Error messages must not print environment values.
- Never log or transmit configuration values.
- Do not mutate the environment source.
- Treat custom validator failures as untrusted and avoid leaking thrown messages that may contain input.
- JSON parsing results are untrusted data.
- Do not imply that validating a value makes the secret itself secure.
- Keep dependencies minimal and review dependency changes.
- Report and fix security regressions with tests.

## Supported versions

Version 1.0.0 is currently unreleased. Security fixes target the current v1
codebase. No published release support window or response-time guarantee has
been established. A private reporting address must be supplied by the maintainer
before publication.
