import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pull } from '../src/cli/pull.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('pull', () => {
  it('creates missing parent directories for output on first pull', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pocketforge-pull-'));

    try {
      const output = join(dir, 'pb_schema', 'schema.ts');

      globalThis.fetch = vi.fn(async () => {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: 'posts',
                name: 'posts',
                type: 'base',
                system: false,
                fields: [
                  {
                    id: 'title',
                    name: 'title',
                    type: 'text',
                    system: false,
                    hidden: false,
                    presentable: false,
                    required: true,
                  },
                ],
                indexes: [],
                listRule: null,
                viewRule: null,
                createRule: null,
                updateRule: null,
                deleteRule: null,
              },
            ],
          }),
        } as Response;
      }) as typeof fetch;

      await pull({
        url: 'http://localhost:8090',
        token: 'test-token',
        output,
      });

      expect(existsSync(output)).toBe(true);
      const source = readFileSync(output, 'utf-8');
      expect(source).toContain('defineSchema');
      expect(source).toContain('posts');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
