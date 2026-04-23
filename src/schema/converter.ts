// ---------------------------------------------------------------------------
// Schema-to-JSON converter
// Converts a SchemaDefinition into the JSON format expected by
// PocketBase's PUT /api/collections/import endpoint.
// ---------------------------------------------------------------------------

import type {
  AuthCollectionDefinition,
  BaseCollectionDefinition,
  CollectionDefinition,
  FieldDefinition,
  FieldsMap,
  IndexDefinition,
  SchemaDefinition,
  ViewCollectionDefinition,
} from './types.js';

// ---------------------------------------------------------------------------
// Deterministic field ID generation
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic 15-char alphanumeric ID from a seed string.
 * Uses a simple FNV-1a-like hash to produce stable IDs so that repeated
 * pushes don't create field drift.
 */
export function deterministicId(seed: string): string {
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
  }
  // Convert to positive integer and encode as base36, pad to 15 chars
  const n = (h >>> 0).toString(36);
  const prefix = 'f';
  return (prefix + n).padEnd(15, '0').slice(0, 15);
}

// ---------------------------------------------------------------------------
// Convert a single field
// ---------------------------------------------------------------------------

export interface FieldJSON {
  id: string;
  name: string;
  type: string;
  [key: string]: unknown;
}

function convertField(
  collectionName: string,
  fieldName: string,
  def: FieldDefinition,
): FieldJSON {
  const { _type, _options } = def;

  // Build the JSON object for this field
  const json: FieldJSON = {
    id: deterministicId(`${collectionName}/${fieldName}`),
    name: fieldName,
    type: _type,
  };

  // Copy over all options (skip undefined values)
  for (const [key, value] of Object.entries(_options)) {
    if (value !== undefined) {
      json[key] = value;
    }
  }

  return json;
}

// ---------------------------------------------------------------------------
// Convert a single collection
// ---------------------------------------------------------------------------

export interface CollectionJSON {
  id?: string;
  name: string;
  type: string;
  fields?: FieldJSON[];
  indexes?: string[];
  listRule?: string | null;
  viewRule?: string | null;
  createRule?: string | null;
  updateRule?: string | null;
  deleteRule?: string | null;
  viewQuery?: string;
  // Auth-specific options are merged at top level in PocketBase JSON
  [key: string]: unknown;
}

function convertIndex(collectionName: string, idx: IndexDefinition): string {
  const unique = idx.unique ? 'UNIQUE ' : '';
  const where = idx.where ? ` WHERE ${idx.where}` : '';
  return `CREATE ${unique}INDEX \`${idx.name}\` ON \`${collectionName}\` (${idx.columns})${where}`;
}

function convertBaseCollection(
  name: string,
  def: BaseCollectionDefinition,
): CollectionJSON {
  const json: CollectionJSON = {
    name,
    type: 'base',
    fields: convertFields(name, def.fields),
  };

  applyRules(json, def.rules);
  if (def.indexes?.length) {
    json.indexes = def.indexes.map((idx) => convertIndex(name, idx));
  }

  return json;
}

function convertAuthCollection(
  name: string,
  def: AuthCollectionDefinition,
): CollectionJSON {
  const json: CollectionJSON = {
    name,
    type: 'auth',
    fields: convertFields(name, def.fields),
  };

  applyRules(json, def.rules);
  if (def.indexes?.length) {
    json.indexes = def.indexes.map((idx) => convertIndex(name, idx));
  }

  // Merge auth-specific options
  if (def.authOptions) {
    const ao = def.authOptions;
    if (ao.authRule !== undefined) json.authRule = ao.authRule;
    if (ao.manageRule !== undefined) json.manageRule = ao.manageRule;
    if (ao.passwordAuth) json.passwordAuth = ao.passwordAuth;
    if (ao.oauth2) json.oauth2 = ao.oauth2;
    if (ao.mfa) json.mfa = ao.mfa;
    if (ao.otp) json.otp = ao.otp;
    if (ao.authAlert) json.authAlert = ao.authAlert;
    if (ao.authToken) json.authToken = ao.authToken;
    if (ao.passwordResetToken) json.passwordResetToken = ao.passwordResetToken;
    if (ao.emailChangeToken) json.emailChangeToken = ao.emailChangeToken;
    if (ao.verificationToken) json.verificationToken = ao.verificationToken;
    if (ao.fileToken) json.fileToken = ao.fileToken;
    if (ao.verificationTemplate) json.verificationTemplate = ao.verificationTemplate;
    if (ao.resetPasswordTemplate) json.resetPasswordTemplate = ao.resetPasswordTemplate;
    if (ao.confirmEmailChangeTemplate) json.confirmEmailChangeTemplate = ao.confirmEmailChangeTemplate;
  }

  return json;
}

function convertViewCollection(
  name: string,
  def: ViewCollectionDefinition,
): CollectionJSON {
  const json: CollectionJSON = {
    name,
    type: 'view',
    viewQuery: def.viewQuery,
  };

  if (def.rules) {
    if (def.rules.list !== undefined) json.listRule = def.rules.list;
    if (def.rules.view !== undefined) json.viewRule = def.rules.view;
  }

  return json;
}

function convertFields(collectionName: string, fields: FieldsMap): FieldJSON[] {
  return Object.entries(fields).map(([fieldName, def]) =>
    convertField(collectionName, fieldName, def),
  );
}

function applyRules(json: CollectionJSON, rules?: CollectionDefinition['rules']): void {
  if (!rules) return;
  if ('list' in rules && rules.list !== undefined) json.listRule = rules.list;
  if ('view' in rules && rules.view !== undefined) json.viewRule = rules.view;
  if ('create' in rules && rules.create !== undefined) json.createRule = rules.create;
  if ('update' in rules && rules.update !== undefined) json.updateRule = rules.update;
  if ('delete' in rules && rules.delete !== undefined) json.deleteRule = rules.delete;
}

// ---------------------------------------------------------------------------
// Convert full schema
// ---------------------------------------------------------------------------

function convertSingleCollection(
  name: string,
  def: CollectionDefinition,
): CollectionJSON {
  switch (def.type) {
    case 'base':
      return convertBaseCollection(name, def);
    case 'auth':
      return convertAuthCollection(name, def);
    case 'view':
      return convertViewCollection(name, def);
    default:
      throw new Error(`Unknown collection type: ${(def as any).type}`);
  }
}

/**
 * Convert a full schema definition to PocketBase import JSON format.
 *
 * @param schema          The schema definition
 * @param collectionIdMap Map of collection name → existing PocketBase collection ID.
 *                        Used to resolve relation fields and preserve IDs on updates.
 * @returns Array of collection JSON objects ready for PUT /api/collections/import
 */
export function schemaToJSON(
  schema: SchemaDefinition,
  collectionIdMap?: Record<string, string>,
): CollectionJSON[] {
  // Build the full name→ID map up front so relation fields can resolve
  // targets regardless of import order — including collections being created
  // in this same import. Existing collections keep their IDs; new ones get
  // a deterministic ID derived from the collection name.
  const nameToId = new Map<string, string>();
  for (const name of Object.keys(schema)) {
    const existingId = collectionIdMap?.[name];
    nameToId.set(name, existingId ?? deterministicId(`collection/${name}`));
  }

  const collections: CollectionJSON[] = [];
  for (const [name, def] of Object.entries(schema)) {
    const json = convertSingleCollection(name, def);
    json.id = nameToId.get(name)!;
    collections.push(json);
  }

  for (const [name, def] of Object.entries(schema)) {
    if (def.type === 'view') continue;
    const col = collections.find((c) => c.name === name);
    if (!col?.fields) continue;

    for (const field of col.fields) {
      if (field.type !== 'relation') continue;

      const fields = (def as BaseCollectionDefinition | AuthCollectionDefinition).fields;
      const fieldDef = fields[field.name];
      if (!fieldDef?._relationTarget) continue;

      const targetId = nameToId.get(fieldDef._relationTarget) ?? collectionIdMap?.[fieldDef._relationTarget];
      if (targetId) {
        field.collectionId = targetId;
      } else {
        // Target isn't in the schema or the existing-id map — fall back to
        // the name and let PocketBase surface the error.
        field.collectionId = fieldDef._relationTarget;
      }
    }
  }

  return collections;
}
