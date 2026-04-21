// ---------------------------------------------------------------------------
// CLI: dev — watch schema file, push + generate on changes
// ---------------------------------------------------------------------------

import { resolve } from 'node:path';
import { push, type PushOptions } from './push.js';
import { generate, type GenerateOptions } from './generate.js';
import { PBAdminClient } from './client.js';
import { log } from './log.js';

export interface DevOptions {
  url: string;
  schema: string;
  output: string;
  token?: string;
  email?: string;
  password?: string;
  deleteMissing?: boolean;
}

async function runCycle(opts: DevOptions, client: PBAdminClient): Promise<boolean> {
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
    return true;
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    return false;
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
  await runCycle(opts, client);

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
    await runCycle(opts, client);
    running = false;
  });

  // Keep the process alive
  await new Promise<void>(() => {});
}
