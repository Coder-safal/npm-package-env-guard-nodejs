import { createEnv } from '@coder-safal/envguard';

// Structural interface keeps Express out of EnvGuard's dependencies.
interface App {
  listen(port: number): unknown;
}

export function startServer(app: App): void {
  const env = createEnv({ PORT: { type: 'port', default: 3000 } });
  app.listen(env.PORT);
}
