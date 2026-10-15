# Contributing to EnvGuard

Thanks for considering a contribution.

## Before opening a pull request

- Check existing issues and pull requests to avoid duplicate work.
- For significant API changes, open an issue or discussion first.
- Keep changes focused and include tests.
- Update documentation for user-visible changes.
- Never include real secrets or credentials in tests, fixtures, logs, or examples.

## Development setup

Requirements:

- A supported Node.js version
- pnpm

```bash
pnpm install
pnpm check
```

Use the actual scripts declared in `package.json`; if `pnpm check` is not yet available, run the documented lint, typecheck, test, and build scripts separately.

## Pull request expectations

A PR should:

- Explain the problem and proposed solution.
- Include tests for new behavior and regressions.
- Preserve strict typing and existing public API contracts unless the change explicitly updates them.
- Pass CI checks.
- Update README or changelog when appropriate.
- Avoid unrelated formatting or generated-file changes.

## Commit and branch guidance

Use descriptive branch names, for example:

- `feat/enum-validation`
- `fix/empty-number-input`
- `docs/api-examples`

Follow the repository's configured commit-message convention if one is added.

## Security issues

Do not report undisclosed vulnerabilities in public issues. Follow [SECURITY.md](./SECURITY.md).

## Implemented quality gates

Use Node.js 22.13+ or 24 and pnpm 10.32.1. Run `pnpm check` for formatting, ESLint,
strict compile-time fixtures, runtime tests, build, and actual-tarball consumer
verification. `pnpm format` applies formatting. `pnpm audit` checks development
and production dependencies against npm advisories; CI runs this separately.

Keep pnpm-lock.yaml committed. Core runtime dependencies must remain zero.
Use named exports, explicit `.js` relative imports, and single quotes. Test
security regressions using synthetic sentinel strings, never actual credentials.
See API_DECISIONS.md before changing missing-value, parser, or default behavior.

Declaration consumers must pass with both the pinned TypeScript 5.4.5 minimum
compiler and the development compiler. `pnpm package:check` runs both against
the actual tarball under NodeNext, Node16 and Bundler resolution.
