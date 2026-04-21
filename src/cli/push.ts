// ---------------------------------------------------------------------------
// CLI: push — convert schema to JSON and import to PocketBase
// ---------------------------------------------------------------------------

import { resolve } from 'node:path';
import { schemaToJSON } from '../schema/converter.js';
import type { SchemaDefinition } from '../schema/types.js';
import { PBAdminClient, type PBClientConfig } from './client.js';
import { loadSchema } from './loader.js';
import { log } from './log.js';

export interface PushOptions extends PBClientConfig {
  schema: string;
  deleteMissing?: boolean;
  dryRun?: boolean;
  /** Pre-authenticated client (reused in dev mode to skip re-auth) */
  client?: PBAdminClient;
  /** Suppress banner/done (used in dev mode) */
  quiet?: boolean;
}

export async function push(opts: PushOptions): Promise<void> {
  const timer = log.timer();
  const schemaPath = resolve(opts.schema);

  if (!opts.quiet) log.step('PUSH');
  log.info(`Loading schema from ${schemaPath}`);

  const schema: SchemaDefinition = await loadSchema(schemaPath);
  const collectionNames = Object.keys(schema);
  log.info(`Found ${collectionNames.length} collection(s)`);
  log.collections(collectionNames);

  // Authenticate (or reuse existing client)
  const client = opts.client ?? new PBAdminClient(opts);
  if (!opts.client) {
    await client.authenticate();
    log.success('Authenticated');
  }

  // Fetch existing collections to build name→ID map and field ID map
  const existing = await client.listCollections();
  const idMap: Record<string, string> = {};
  const fieldIdMap: Record<string, Record<string, string>> = {};
  for (const col of existing) {
    idMap[col.name] = col.id;
    const fMap: Record<string, string> = {};
    for (const f of col.fields) {
      fMap[f.name] = f.id;
    }
    fieldIdMap[col.name] = fMap;
  }

  // Convert schema to import JSON
  const collections = schemaToJSON(schema, idMap);

  // Patch field IDs to match existing fields (PocketBase matches by ID, not name)
  for (const col of collections) {
    const existingFields = fieldIdMap[col.name];
    if (!existingFields || !col.fields) continue;
    for (const field of col.fields) {
      const existingId = existingFields[field.name];
      if (existingId) {
        field.id = existingId;
      }
    }
  }

  if (opts.dryRun) {
    log.step('DRY RUN');
    console.log(JSON.stringify({ collections, deleteMissing: opts.deleteMissing ?? false }, null, 2));
    return;
  }

  // Classify changes
  const created: string[] = [];
  const updated: string[] = [];
  for (const col of collections) {
    if (idMap[col.name]) {
      updated.push(col.name);
    } else {
      created.push(col.name);
    }
  }

  // Push
  await client.importCollections(
    collections as Record<string, unknown>[],
    opts.deleteMissing ?? false,
  );

  // Report
  let deleted: string[] = [];
  if (opts.deleteMissing) {
    const schemaNames = new Set(collections.map((c) => c.name));
    deleted = existing
      .filter((c) => !c.system && !schemaNames.has(c.name))
      .map((c) => c.name);
  }

  log.summary({
    created: created.length,
    updated: updated.length,
    deleted: deleted.length,
  });

  if (created.length) log.dim(`Created: ${created.join(', ')}`);
  if (deleted.length) log.dim(`Deleted: ${deleted.join(', ')}`);

  if (!opts.quiet) log.done('Push complete', timer.elapsed());
}
