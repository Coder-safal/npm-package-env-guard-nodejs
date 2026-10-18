import { createEnv } from '@coder-safal/envguard';

export const env = createEnv({
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
