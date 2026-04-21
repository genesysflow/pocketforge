// ---------------------------------------------------------------------------
// Helper: convert server collections → in-memory SchemaDefinition
// Used by `generate --from-server` to skip needing a local schema file.
// ---------------------------------------------------------------------------

import type {
  CollectionDefinition,
  FieldDefinition,
  FieldsMap,
  SchemaDefinition,
} from '../schema/types.js';
import { PBAdminClient, type CollectionResponse, type FieldResponse, type PBClientConfig } from './client.js';

function fieldResponseToDefinition(
  field: FieldResponse,
  collectionsById: Map<string, string>,
): FieldDefinition {
  const { id, name, type, system, hidden, presentable, help, ...rest } = field;

  // For relations, remap collectionId to _relationTarget name
  let relationTarget: string | undefined;
  if (type === 'relation' && rest.collectionId) {
    relationTarget = collectionsById.get(rest.collectionId as string) ?? (rest.collectionId as string);
    delete rest.collectionId;
  }

  const options: Record<string, unknown> = {};
  // Add back non-base fields
  if (hidden) options.hidden = true;
  if (presentable) options.presentable = true;
  if (help) options.help = help;
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined && v !== null && v !== false && v !== 0 && v !== '') {
      if (Array.isArray(v) && v.length === 0) continue;
      options[k] = v;
    }
  }

  return {
    _type: type,
    _tsType: undefined as unknown,
    _options: options,
    ...(relationTarget ? { _relationTarget: relationTarget } : {}),
  };
}

export async function pullSchemaFromServer(config: PBClientConfig): Promise<SchemaDefinition> {
  const client = new PBAdminClient(config);
  await client.authenticate();

  const collections = await client.listCollections();
  const idToName = new Map<string, string>();
  for (const col of collections) {
    idToName.set(col.id, col.name);
  }

  const schema: Record<string, CollectionDefinition> = {};

  for (const col of collections) {
    if (col.system) continue;

    const userFields = col.fields.filter((f) => !f.system);
    const fields: FieldsMap = {};
    for (const f of userFields) {
      fields[f.name] = fieldResponseToDefinition(f, idToName);
    }

    if (col.type === 'view') {
      schema[col.name] = {
        type: 'view',
        viewQuery: col.viewQuery ?? '',
        rules: {
          list: col.listRule,
          view: col.viewRule,
        },
      };
    } else if (col.type === 'auth') {
      schema[col.name] = {
        type: 'auth',
        fields,
        rules: {
          list: col.listRule,
          view: col.viewRule,
          create: col.createRule,
          update: col.updateRule,
          delete: col.deleteRule,
        },
      };
    } else {
      schema[col.name] = {
        type: 'base',
        fields,
        rules: {
          list: col.listRule,
          view: col.viewRule,
          create: col.createRule,
          update: col.updateRule,
          delete: col.deleteRule,
        },
      };
    }
  }

  return schema;
}
