import { afterEach, describe, expect, it, vi } from 'vitest';
import { backup } from '../src/cli/backup.js';
import { defaultBackupName } from '../src/cli/client.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('defaultBackupName', () => {
  it('formats a UTC timestamp and matches PocketBase naming rules', () => {
    const name = defaultBackupName(new Date(Date.UTC(2026, 5, 24, 15, 30, 12)));
    expect(name).toBe('pocketforge-backup-20260624-153012.zip');
    // PocketBase requires `^[a-z0-9_-]+\.zip$`
    expect(name).toMatch(/^[a-z0-9_-]+\.zip$/);
  });
});

describe('backup', () => {
  it('POSTs to /api/backups with the token and provided name', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return { ok: true, status: 204, text: async () => '' } as Response;
    }) as unknown as typeof fetch;

    const name = await backup({
      url: 'http://localhost:8090/',
      token: 'test-token',
      name: 'pre-deploy.zip',
    });

    expect(name).toBe('pre-deploy.zip');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('http://localhost:8090/api/backups');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('test-token');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ name: 'pre-deploy.zip' });
  });

  it('falls back to a timestamped name when none is given', async () => {
    let sentBody: { name: string } | undefined;
    globalThis.fetch = vi.fn(async (_url: string, init: RequestInit) => {
      sentBody = JSON.parse(init.body as string);
      return { ok: true, status: 204, text: async () => '' } as Response;
    }) as unknown as typeof fetch;

    const name = await backup({ url: 'http://localhost:8090', token: 't' });

    expect(name).toMatch(/^pocketforge-backup-\d{8}-\d{6}\.zip$/);
    expect(sentBody?.name).toBe(name);
  });

  it('throws with the server message on a non-ok response', async () => {
    globalThis.fetch = vi.fn(async () => {
      return { ok: false, status: 403, text: async () => 'forbidden' } as Response;
    }) as unknown as typeof fetch;

    await expect(
      backup({ url: 'http://localhost:8090', token: 'bad', name: 'x.zip' }),
    ).rejects.toThrow(/Backup failed \(403\): forbidden/);
  });
});
