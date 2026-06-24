// ---------------------------------------------------------------------------
// CLI: backup — create a PocketBase backup (full pb_data snapshot)
// ---------------------------------------------------------------------------

import { PBAdminClient, type PBClientConfig } from './client.js';
import { log } from './log.js';

export interface BackupOptions extends PBClientConfig {
  /** Explicit backup name (default: timestamped). */
  name?: string;
}

export async function backup(opts: BackupOptions): Promise<string> {
  const timer = log.timer();
  log.step('BACKUP');

  const client = new PBAdminClient(opts);
  await client.authenticate();
  log.success('Authenticated');

  const name = await client.createBackup(opts.name);

  log.done(`Backup created: ${name}`, timer.elapsed());
  return name;
}
