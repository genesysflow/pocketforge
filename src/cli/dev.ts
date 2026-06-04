// ---------------------------------------------------------------------------
// CLI: dev — watch schema file, push + generate on changes
// ---------------------------------------------------------------------------

import { resolve } from 'node:path';
import { push, type PushOptions } from './push.js';
import { generate, type GenerateOptions } from './generate.js';
import { PBAdminClient } from './client.js';
import { log } from './log.js';

const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

export interface DevOptions {
  url: string;
  schema: string;
  output: string;
  token?: string;
  email?: string;
  password?: string;
  deleteMissing?: boolean;
}

export function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err instanceof TypeError) return true;
  const msg = err.message.toLowerCase();
  return msg.includes('econnrefused') || msg.includes('enotfound');
}

export async function waitForServer(url: string): Promise<void> {
  const healthUrl = `${url.replace(/\/+$/, '')}/api/health`;
  process.stdout.write(`    ${DIM}waiting for server to come back${RESET}`);
  while (true) {
    await new Promise<void>((r) => setTimeout(r, 2000));
    try {
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        process.stdout.write('\n');
        return;
      }
    } catch {
      process.stdout.write(` ${DIM}·${RESET}`);
    }
  }
}

async function runCycle(opts: DevOptions, client: PBAdminClient): Promise<'ok' | 'error' | 'offline'> {
  const timer = log.timer();
  try {
    await push({
      url: opts.url,
      schema: opts.schema,
      token: opts.token,
      email: opts.email,
      password: opts.password,
      deleteMissing: opts.deleteMissing,
      client,
      quiet: true,
    });
    await generate({
      schema: opts.schema,
      output: opts.output,
      quiet: true,
    });
    log.done('Synced', timer.elapsed());
    return 'ok';
  } catch (err) {
    if (isNetworkError(err)) return 'offline';
    log.error(err instanceof Error ? err.message : String(err));
    return 'error';
  }
}

async function runWithRetry(opts: DevOptions, client: PBAdminClient): Promise<void> {
  let status = await runCycle(opts, client);
  while (status === 'offline') {
    log.warn('Server is unreachable — waiting for it to come back...');
    await waitForServer(opts.url);
    log.separator();
    log.info('Server is back online, re-syncing...');
    // Re-authenticate to get a fresh token after restart (no-op for token auth)
    await client.authenticate().catch(() => {});
    status = await runCycle(opts, client);
  }
}

export async function dev(opts: DevOptions): Promise<void> {
  const schemaPath = resolve(opts.schema);

  log.banner();
  log.info(`Watching ${schemaPath}`);
  log.dim('Press Ctrl+C to stop');

  // Authenticate once upfront
  const client = new PBAdminClient(opts);
  await client.authenticate();
  log.success(`Connected to ${opts.url}`);
  log.separator();

  // Initial run
  await runWithRetry(opts, client);

  // Watch for changes
  const { watch } = await import('chokidar');
  const watcher = watch(schemaPath, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 50 },
  });

  let running = false;
  watcher.on('change', async () => {
    if (running) return;
    running = true;
    log.separator();
    log.info('Schema changed, syncing...');
    await runWithRetry(opts, client);
    running = false;
  });

  // Keep the process alive
  await new Promise<void>(() => {});
}
