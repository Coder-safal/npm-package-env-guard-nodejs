import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'envguard-consumer-'));
const run = (command, args, cwd = temp) =>
  execFileSync(command, args, { cwd, encoding: 'utf8', stdio: 'pipe' });
try {
  // Pack the actual publishable artifact; never use a workspace symlink.
  run('pnpm', ['pack', '--pack-destination', temp], root);
  const tarball = readdirSync(temp).find((file) => file.endsWith('.tgz'));
  assert.ok(tarball);
  const archive = join(temp, tarball);
  console.log(
    run('pnpm', ['exec', 'publint', archive, '--strict'], root).trim(),
  );
  console.log(run('pnpm', ['exec', 'attw', archive], root).trim());
  const entries = run('tar', ['-tzf', archive]).trim().split('\n');
  const allowed =
    /^package\/(?:dist\/index\.(?:js|cjs|d\.ts|d\.cts)|package\.json|README\.md|SECURITY\.md|CHANGELOG\.md|CONTRIBUTING\.md|API_DECISIONS\.md|examples\/(?:basic|express)\.ts|LICENSE)$/;
  for (const entry of entries) assert.match(entry, allowed);
  for (const file of ['index.js', 'index.cjs', 'index.d.ts', 'index.d.cts']) {
    assert.ok(entries.includes(`package/dist/${file}`));
  }
  assert.ok(entries.includes('package/LICENSE'));
  writeFileSync(
    join(temp, 'package.json'),
    JSON.stringify({ private: true, type: 'module' }),
  );
  run('pnpm', [
    'add',
    '--offline',
    '--ignore-scripts',
    '--store-dir',
    join(temp, 'store'),
    archive,
  ]);
  const installed = join(temp, 'node_modules/@coder-safal/envguard');
  const manifest = JSON.parse(
    readFileSync(join(installed, 'package.json'), 'utf8'),
  );
  assert.equal(manifest.name, '@coder-safal/envguard');
  assert.equal(Object.keys(manifest.dependencies ?? {}).length, 0);
  for (const mode of ['import', 'require']) {
    for (const target of Object.values(manifest.exports['.'][mode])) {
      assert.ok(readFileSync(resolve(installed, target)).length > 0);
    }
  }
  const assertions = `
assert.equal(createEnv({ PORT: { type: 'port', default: 3000 } }, { source: {} }).PORT, 3000);
assert.throws(() => createEnv({ REQUIRED: { type: 'boolean' } }, { source: {} }), EnvValidationError);
assert.ok(Object.isFrozen(createEnv({}, { source: {} })));
`;
  writeFileSync(
    join(temp, 'consumer.mjs'),
    `import assert from 'node:assert/strict';\nimport { createEnv, EnvValidationError } from '@coder-safal/envguard';\n${assertions}`,
  );
  writeFileSync(
    join(temp, 'consumer.cjs'),
    `const assert = require('node:assert/strict');\nconst { createEnv, EnvValidationError } = require('@coder-safal/envguard');\n${assertions}`,
  );
  run(process.execPath, ['consumer.mjs']);
  run(process.execPath, ['consumer.cjs']);
  const typeFixture = `import { createEnv, EnvValidationError } from '@coder-safal/envguard';
import type { EnvIssue, InferEnv } from '@coder-safal/envguard';
const schema = { MODE: { type: 'enum', values: ['dev', 'prod'], default: 'dev' }, OPTIONAL: { type: 'number', optional: true } } as const;
const env = createEnv(schema, { source: {} });
const mode: 'dev' | 'prod' = env.MODE;
const optional: number | undefined = env.OPTIONAL;
const inferred: InferEnv<typeof schema> = env;
const issues: readonly EnvIssue[] = new EnvValidationError([]).issues;
// @ts-expect-error literal union cannot include another value
const invalid: 'other' = env.MODE;
// @ts-expect-error optional includes undefined
const required: number = env.OPTIONAL;
// @ts-expect-error invalid enum default
createEnv({ A: { type: 'enum', values: ['a', 'b'], default: 'c' } });
void [mode, optional, inferred, issues, invalid, required];
`;
  mkdirSync(join(temp, 'types'));
  for (const extension of ['mts', 'cts'])
    writeFileSync(join(temp, `types/consumer.${extension}`), typeFixture);
  for (const compiler of ['typescript-minimum', 'typescript']) {
    const tsc = join(root, `node_modules/${compiler}/bin/tsc`);
    for (const resolution of ['NodeNext', 'Node16', 'Bundler']) {
      const module = resolution === 'Bundler' ? 'ESNext' : resolution;
      run(process.execPath, [
        tsc,
        '--strict',
        '--noEmit',
        '--target',
        'ES2022',
        '--module',
        module,
        '--moduleResolution',
        resolution,
        'types/consumer.mts',
        'types/consumer.cts',
      ]);
    }
  }
  console.log(
    'Tarball allowlist, offline install, ESM/CommonJS runtime imports and declaration consumers passed.',
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
