// ---------------------------------------------------------------------------
// defineCollection / defineSchema — public schema definition API
// ---------------------------------------------------------------------------

import type {
  AuthCollectionDefinition,
  AuthOptions,
  BaseCollectionDefinition,
  CollectionDefinition,
  CollectionRules,
  FieldsMap,
  IndexDefinition,
  SchemaDefinition,
  ViewCollectionDefinition,
} from './types.js';

// ---------------------------------------------------------------------------
// defineCollection overloads
// ---------------------------------------------------------------------------

export function defineCollection<F extends FieldsMap>(
  def: { type: 'base'; fields: F; rules?: CollectionRules; indexes?: IndexDefinition[] },
): BaseCollectionDefinition<F>;

export function defineCollection<F extends FieldsMap>(
  def: {
    type: 'auth';
    fields: F;
    rules?: CollectionRules;
    indexes?: IndexDefinition[];
    authOptions?: AuthOptions;
  },
): AuthCollectionDefinition<F>;

export function defineCollection(
  def: {
    type: 'view';
    viewQuery: string;
    rules?: Pick<CollectionRules, 'list' | 'view'>;
  },
): ViewCollectionDefinition;

export function defineCollection(def: CollectionDefinition<any>): CollectionDefinition<any> {
  return def;
}

// ---------------------------------------------------------------------------
// defineSchema
// ---------------------------------------------------------------------------

export function defineSchema<S extends Record<string, CollectionDefinition<any>>>(
  collections: S,
): S & SchemaDefinition {
  return collections;
}
