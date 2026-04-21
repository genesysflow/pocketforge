// ---------------------------------------------------------------------------
// Code generator: Schema → TypeScript record interfaces and collection maps
// ---------------------------------------------------------------------------

import type {
  AuthCollectionDefinition,
  BaseCollectionDefinition,
  CollectionDefinition,
  FieldDefinition,
  FieldsMap,
  SchemaDefinition,
  ViewCollectionDefinition,
} from '../schema/types.js';

// ---------------------------------------------------------------------------
// Map PocketBase field types → TypeScript type strings
// ---------------------------------------------------------------------------

function fieldTypeToTS(def: FieldDefinition): string {
  const opts = def._options;

  switch (def._type) {
    case 'text':
    case 'email':
    case 'url':
    case 'date':
    case 'editor':
    case 'autodate':
      return 'string';

    case 'number':
      return 'number';

    case 'bool':
      return 'boolean';

    case 'select': {
      const values = opts.values as string[] | undefined;
      const maxSelect = (opts.maxSelect as number) ?? 1;
      if (values?.length) {
        const union = values.map((v) => JSON.stringify(v)).join(' | ');
        return maxSelect > 1 ? `(${union})[]` : union;
      }
      return maxSelect > 1 ? 'string[]' : 'string';
    }

    case 'relation': {
      const maxSelect = (opts.maxSelect as number) ?? 1;
      return maxSelect > 1 ? 'string[]' : 'string';
    }

    case 'file': {
      const maxSelect = (opts.maxSelect as number) ?? 1;
      return maxSelect > 1 ? 'string[]' : 'string';
    }

    case 'json':
      return 'unknown';

    case 'geopoint':
      return '{ lat: number; lon: number }';

    case 'password':
      // Password fields are never returned in API responses
      return 'never';

    default:
      return 'unknown';
  }
}

function isRequired(def: FieldDefinition): boolean {
  return !!(def._options.required);
}

// ---------------------------------------------------------------------------
// Generate interface for a single collection
// ---------------------------------------------------------------------------

function collectionTypeName(name: string): string {
  // PascalCase + "Record" suffix
  const pascal = name
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^./, (c) => c.toUpperCase());
  return `${pascal}Record`;
}

function collectionCreateTypeName(name: string): string {
  const pascal = name
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^./, (c) => c.toUpperCase());
  return `${pascal}Create`;
}

function collectionUpdateTypeName(name: string): string {
  const pascal = name
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^./, (c) => c.toUpperCase());
  return `${pascal}Update`;
}

function generateFieldLines(fields: FieldsMap, forInput: 'record' | 'create' | 'update'): string[] {
  const lines: string[] = [];

  for (const [name, def] of Object.entries(fields)) {
    const tsType = fieldTypeToTS(def);
    if (tsType === 'never') continue; // skip password fields in record type

    if (forInput === 'record') {
      lines.push(`  ${name}: ${tsType};`);
    } else if (forInput === 'create') {
      const optional = !isRequired(def);
      lines.push(`  ${name}${optional ? '?' : ''}: ${tsType};`);
    } else {
      // update — all fields optional
      lines.push(`  ${name}?: ${tsType};`);
    }
  }

  return lines;
}

function generateRecordInterface(
  name: string,
  def: CollectionDefinition,
): string {
  const typeName = collectionTypeName(name);

  if (def.type === 'view') {
    return [
      `export interface ${typeName} extends BaseRecord {`,
      `  [key: string]: unknown;`,
      `}`,
    ].join('\n');
  }

  const base = def.type === 'auth' ? 'AuthRecord' : 'BaseRecord';
  const fields = (def as BaseCollectionDefinition | AuthCollectionDefinition).fields;
  const fieldLines = generateFieldLines(fields, 'record');

  return [
    `export interface ${typeName} extends ${base} {`,
    ...fieldLines,
    `}`,
  ].join('\n');
}

function generateCreateInterface(
  name: string,
  def: CollectionDefinition,
): string | null {
  if (def.type === 'view') return null;

  const typeName = collectionCreateTypeName(name);
  const fields = (def as BaseCollectionDefinition | AuthCollectionDefinition).fields;
  const fieldLines = generateFieldLines(fields, 'create');

  // For auth collections, add password as required
  if (def.type === 'auth') {
    fieldLines.push(`  password: string;`);
    fieldLines.push(`  passwordConfirm: string;`);
  }

  return [
    `export interface ${typeName} {`,
    ...fieldLines,
    `}`,
  ].join('\n');
}

function generateUpdateInterface(
  name: string,
  def: CollectionDefinition,
): string | null {
  if (def.type === 'view') return null;

  const typeName = collectionUpdateTypeName(name);
  const fields = (def as BaseCollectionDefinition | AuthCollectionDefinition).fields;
  const fieldLines = generateFieldLines(fields, 'update');

  if (def.type === 'auth') {
    fieldLines.push(`  password?: string;`);
    fieldLines.push(`  passwordConfirm?: string;`);
    fieldLines.push(`  oldPassword?: string;`);
  }

  return [
    `export interface ${typeName} {`,
    ...fieldLines,
    `}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Generate the full types.ts file
// ---------------------------------------------------------------------------

export function generateTypes(schema: SchemaDefinition): string {
  const blocks: string[] = [];

  // Header
  blocks.push(`// Auto-generated by pocketforge — DO NOT EDIT`);
  blocks.push(`// Generated at: ${new Date().toISOString()}`);
  blocks.push('');

  // Base types
  blocks.push(`export interface BaseRecord {`);
  blocks.push(`  id: string;`);
  blocks.push(`  created: string;`);
  blocks.push(`  updated: string;`);
  blocks.push(`  collectionId: string;`);
  blocks.push(`  collectionName: string;`);
  blocks.push(`}`);
  blocks.push('');

  blocks.push(`export interface AuthRecord extends BaseRecord {`);
  blocks.push(`  email: string;`);
  blocks.push(`  emailVisibility: boolean;`);
  blocks.push(`  verified: boolean;`);
  blocks.push(`  username: string;`);
  blocks.push(`}`);
  blocks.push('');

  // Per-collection record interfaces
  for (const [name, def] of Object.entries(schema)) {
    blocks.push(generateRecordInterface(name, def));
    blocks.push('');

    const createIface = generateCreateInterface(name, def);
    if (createIface) {
      blocks.push(createIface);
      blocks.push('');
    }

    const updateIface = generateUpdateInterface(name, def);
    if (updateIface) {
      blocks.push(updateIface);
      blocks.push('');
    }
  }

  // Collection name union type
  const names = Object.keys(schema);
  blocks.push(`export type CollectionName = ${names.map((n) => JSON.stringify(n)).join(' | ')};`);
  blocks.push('');

  // CollectionRecords map
  blocks.push(`export interface CollectionRecords {`);
  for (const name of names) {
    blocks.push(`  ${safePropName(name)}: ${collectionTypeName(name)};`);
  }
  blocks.push(`}`);
  blocks.push('');

  // CollectionCreate map
  blocks.push(`export interface CollectionCreate {`);
  for (const name of names) {
    const def = schema[name]!;
    if (def.type === 'view') continue;
    blocks.push(`  ${safePropName(name)}: ${collectionCreateTypeName(name)};`);
  }
  blocks.push(`}`);
  blocks.push('');

  // CollectionUpdate map
  blocks.push(`export interface CollectionUpdate {`);
  for (const name of names) {
    const def = schema[name]!;
    if (def.type === 'view') continue;
    blocks.push(`  ${safePropName(name)}: ${collectionUpdateTypeName(name)};`);
  }
  blocks.push(`}`);
  blocks.push('');

  return blocks.join('\n');
}

function safePropName(name: string): string {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}
