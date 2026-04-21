// ---------------------------------------------------------------------------
// CLI: pull — fetch collections from PocketBase and generate a schema.ts
// ---------------------------------------------------------------------------

import { writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { PBAdminClient, type CollectionResponse, type FieldResponse, type PBClientConfig } from './client.js';
import { log } from './log.js';

export interface PullOptions extends PBClientConfig {
  output: string;
  includeSystem?: boolean;
}

// ---------------------------------------------------------------------------
// Reverse-map a PocketBase field response to a v.xxx() call string
// ---------------------------------------------------------------------------

/** Fields that are part of every FieldDefinition but not field-specific options */
const BASE_FIELD_KEYS = new Set(['id', 'name', 'type', 'system', 'hidden', 'presentable', 'help']);

function fieldToValidator(field: FieldResponse, collectionsById: Map<string, string>): string {
  const opts: Record<string, unknown> = {};

  // Collect field-specific options (skip base keys and defaults)
  for (const [key, value] of Object.entries(field)) {
    if (BASE_FIELD_KEYS.has(key)) continue;
    if (value === undefined || value === null || value === false || value === 0 || value === '') continue;
    // Keep arrays even if empty? No — skip empty arrays
    if (Array.isArray(value) && value.length === 0) continue;
    opts[key] = value;
  }

  // Re-add hidden/presentable/help if non-default
  if (field.hidden) opts.hidden = true;
  if (field.presentable) opts.presentable = true;
  if (field.help) opts.help = field.help;

  switch (field.type) {
    case 'text':
      return `v.text(${formatOpts(opts)})`;
    case 'number':
      return `v.number(${formatOpts(opts)})`;
    case 'bool':
      return `v.bool(${formatOpts(opts)})`;
    case 'email':
      return `v.email(${formatOpts(opts)})`;
    case 'url':
      return `v.url(${formatOpts(opts)})`;
    case 'date':
      return `v.date(${formatOpts(opts)})`;
    case 'select': {
      const values = (opts.values as string[]) ?? [];
      delete opts.values;
      const valuesStr = values.map((v) => JSON.stringify(v)).join(', ');
      const rest = formatOpts(opts);
      const inner = rest ? `{ values: [${valuesStr}] as const, ${rest.slice(2, -2)}` + ' }' : `{ values: [${valuesStr}] as const }`;
      return `v.select(${inner})`;
    }
    case 'relation': {
      const collectionId = opts.collectionId as string;
      delete opts.collectionId;
      const targetName = collectionsById.get(collectionId) ?? collectionId;
      const maxSelect = opts.maxSelect as number | undefined;
      if (maxSelect === 1) {
        delete opts.maxSelect;
        return `v.relationOne(${JSON.stringify(targetName)}${formatOptsArg(opts)})`;
      } else if (maxSelect && maxSelect > 1) {
        return `v.relationMany(${JSON.stringify(targetName)}${formatOptsArg(opts)})`;
      }
      return `v.relation(${JSON.stringify(targetName)}${formatOptsArg(opts)})`;
    }
    case 'file': {
      const maxSelect = opts.maxSelect as number | undefined;
      if (maxSelect === 1) {
        delete opts.maxSelect;
        return `v.fileOne(${formatOpts(opts)})`;
      } else if (maxSelect && maxSelect > 1) {
        return `v.fileMany(${formatOpts(opts)})`;
      }
      return `v.file(${formatOpts(opts)})`;
    }
    case 'json':
      return `v.json(${formatOpts(opts)})`;
    case 'geopoint':
      return `v.geoPoint(${formatOpts(opts)})`;
    case 'password':
      return `v.password(${formatOpts(opts)})`;
    case 'editor':
      return `v.editor(${formatOpts(opts)})`;
    case 'autodate':
      return `v.autodate(${formatOpts(opts)})`;
    default:
      return `v.json(/* unknown type: ${field.type} */)`;
  }
}

function formatOpts(opts: Record<string, unknown>): string {
  const entries = Object.entries(opts);
  if (entries.length === 0) return '';
  return '{ ' + entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ') + ' }';
}

function formatOptsArg(opts: Record<string, unknown>): string {
  const s = formatOpts(opts);
  return s ? `, ${s}` : '';
}

// ---------------------------------------------------------------------------
// Generate the schema.ts source string
// ---------------------------------------------------------------------------

function generateSchemaSource(
  collections: CollectionResponse[],
  includeSystem: boolean,
): string {
  const filtered = includeSystem
    ? collections
    : collections.filter((c) => !c.system);

  // Build ID→name map for relation resolution
  const idToName = new Map<string, string>();
  for (const col of collections) {
    idToName.set(col.id, col.name);
  }

  const lines: string[] = [
    `import { defineSchema, defineCollection, v } from 'pocketforge';`,
    '',
    'export default defineSchema({',
  ];

  for (let ci = 0; ci < filtered.length; ci++) {
    const col = filtered[ci]!;
    const isLast = ci === filtered.length - 1;
    const trailing = isLast ? '' : '';

    if (col.type === 'view') {
      lines.push(`  ${safePropName(col.name)}: defineCollection({`);
      lines.push(`    type: 'view',`);
      lines.push(`    viewQuery: ${JSON.stringify(col.viewQuery ?? '')},`);
      if (col.listRule || col.viewRule) {
        lines.push(`    rules: {`);
        if (col.listRule !== null && col.listRule !== undefined)
          lines.push(`      list: ${JSON.stringify(col.listRule)},`);
        if (col.viewRule !== null && col.viewRule !== undefined)
          lines.push(`      view: ${JSON.stringify(col.viewRule)},`);
        lines.push(`    },`);
      }
      lines.push(`  }),`);
      continue;
    }

    // Filter out system fields for auth collections (they're auto-created)
    const userFields = col.fields.filter((f) => !f.system);

    lines.push(`  ${safePropName(col.name)}: defineCollection({`);
    lines.push(`    type: '${col.type}',`);

    // Fields
    lines.push(`    fields: {`);
    for (const field of userFields) {
      const validator = fieldToValidator(field, idToName);
      lines.push(`      ${safePropName(field.name)}: ${validator},`);
    }
    lines.push(`    },`);

    // Rules
    const hasRules = col.listRule !== null || col.viewRule !== null ||
      col.createRule !== null || col.updateRule !== null || col.deleteRule !== null;
    if (hasRules) {
      lines.push(`    rules: {`);
      if (col.listRule !== null) lines.push(`      list: ${JSON.stringify(col.listRule)},`);
      if (col.viewRule !== null) lines.push(`      view: ${JSON.stringify(col.viewRule)},`);
      if (col.createRule !== null) lines.push(`      create: ${JSON.stringify(col.createRule)},`);
      if (col.updateRule !== null) lines.push(`      update: ${JSON.stringify(col.updateRule)},`);
      if (col.deleteRule !== null) lines.push(`      delete: ${JSON.stringify(col.deleteRule)},`);
      lines.push(`    },`);
    }

    // Indexes (parse back from SQL)
    if (col.indexes?.length) {
      lines.push(`    indexes: [`);
      for (const idx of col.indexes) {
        const parsed = parseIndex(idx);
        if (parsed) {
          lines.push(`      { name: ${JSON.stringify(parsed.name)}${parsed.unique ? ', unique: true' : ''}, columns: ${JSON.stringify(parsed.columns)}${parsed.where ? `, where: ${JSON.stringify(parsed.where)}` : ''} },`);
        }
      }
      lines.push(`    ],`);
    }

    // Auth options
    if (col.type === 'auth') {
      const authKeys = [
        'authRule', 'manageRule', 'passwordAuth', 'oauth2', 'mfa', 'otp',
        'authAlert', 'authToken', 'passwordResetToken', 'emailChangeToken',
        'verificationToken', 'fileToken', 'verificationTemplate',
        'resetPasswordTemplate', 'confirmEmailChangeTemplate',
      ];
      const authOpts: Record<string, unknown> = {};
      for (const key of authKeys) {
        if (col[key] !== undefined && col[key] !== null) {
          authOpts[key] = col[key];
        }
      }
      if (Object.keys(authOpts).length) {
        lines.push(`    authOptions: ${JSON.stringify(authOpts, null, 6).replace(/\n/g, '\n    ')},`);
      }
    }

    lines.push(`  }),${trailing}`);
  }

  lines.push('});');
  lines.push('');

  return lines.join('\n');
}

function safePropName(name: string): string {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

function parseIndex(sql: string): { name: string; unique: boolean; columns: string; where?: string } | null {
  const match = sql.match(
    /CREATE\s+(UNIQUE\s+)?INDEX\s+[`"]?(\w+)[`"]?\s+ON\s+[`"]?\w+[`"]?\s*\((.+?)\)(\s+WHERE\s+(.+))?$/i,
  );
  if (!match) return null;
  return {
    name: match[2]!,
    unique: !!match[1],
    columns: match[3]!.trim(),
    where: match[5]?.trim(),
  };
}

// ---------------------------------------------------------------------------
// Main pull function
// ---------------------------------------------------------------------------

export async function pull(opts: PullOptions): Promise<void> {
  const timer = log.timer();
  log.step('PULL');

  const client = new PBAdminClient(opts);
  await client.authenticate();
  log.success('Authenticated');

  const collections = await client.listCollections();
  log.info(`Fetched ${collections.length} collection(s) from server`);

  const source = generateSchemaSource(collections, opts.includeSystem ?? false);
  const outPath = resolve(opts.output);
  writeFileSync(outPath, source, 'utf-8');

  const count = opts.includeSystem
    ? collections.length
    : collections.filter((c) => !c.system).length;
  log.collections(collections.filter(c => opts.includeSystem || !c.system).map(c => c.name));
  log.file(relative(process.cwd(), outPath));

  log.done('Pull complete', timer.elapsed());
}
