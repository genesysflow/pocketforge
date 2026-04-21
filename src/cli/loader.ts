// ---------------------------------------------------------------------------
// Load a TypeScript schema file at runtime using jiti
// ---------------------------------------------------------------------------

import { createRequire } from 'node:module';
import type { SchemaDefinition } from '../schema/types.js';

const require2 = createRequire(import.meta.url);

export async function loadSchema(schemaPath: string): Promise<SchemaDefinition> {
  const { createJiti } = await import('jiti');

  // Clear any cached version so jiti picks up the latest file contents
  for (const key of Object.keys(require2.cache)) {
    if (key.startsWith(schemaPath)) {
      delete require2.cache[key];
    }
  }

  const jiti = createJiti(import.meta.url, { interopDefault: true });
  const mod = await jiti.import(schemaPath) as { default?: SchemaDefinition };

  const schema = mod.default ?? mod;
  if (!schema || typeof schema !== 'object') {
    throw new Error(
      `Schema file "${schemaPath}" must export a schema definition (default export).`,
    );
  }

  return schema as SchemaDefinition;
}
