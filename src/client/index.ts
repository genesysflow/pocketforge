// ---------------------------------------------------------------------------
// Runtime typed client factory
// Minimal wrapper — generated code does the heavy lifting
// ---------------------------------------------------------------------------

import PocketBase from 'pocketbase';

/**
 * Create a PocketBase client instance.
 * For full type safety, use the generated `createClient` from your codegen output instead.
 */
export function createClient(url: string): PocketBase {
  return new PocketBase(url);
}

export { PocketBase };
