import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadLocalEnv, resolveConnectionConfig } from '../src/cli/env.js';

const ENV_KEYS = [
  'POCKETBASE_URL',
  'POCKETBASE_SUPERUSER_EMAIL',
  'POCKETBASE_SUPERUSER_PASSWORD',
  'POCKETBASE_TOKEN',
  'POCKETFORGE_URL',
  'POCKETFORGE_EMAIL',
  'POCKETFORGE_PASSWORD',
  'POCKETFORGE_TOKEN',
] as const;

const ORIGINAL_ENV = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = ORIGINAL_ENV.get(key);
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
});

describe('loadLocalEnv', () => {
  it('loads values from .env.local into process.env', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pocketforge-env-'));

    try {
      writeFileSync(
        join(dir, '.env.local'),
        [
          'POCKETBASE_URL=http://127.0.0.1:8090',
          'POCKETBASE_SUPERUSER_EMAIL=admin@example.com',
          'POCKETBASE_SUPERUSER_PASSWORD=secret',
        ].join('\n'),
        'utf8',
      );

      delete process.env.POCKETBASE_URL;
      delete process.env.POCKETBASE_SUPERUSER_EMAIL;
      delete process.env.POCKETBASE_SUPERUSER_PASSWORD;

      loadLocalEnv(dir);

      expect(process.env.POCKETBASE_URL).toBe('http://127.0.0.1:8090');
      expect(process.env.POCKETBASE_SUPERUSER_EMAIL).toBe('admin@example.com');
      expect(process.env.POCKETBASE_SUPERUSER_PASSWORD).toBe('secret');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not override existing process.env values', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pocketforge-env-'));

    try {
      writeFileSync(
        join(dir, '.env.local'),
        'POCKETBASE_URL=http://127.0.0.1:8090\n',
        'utf8',
      );

      process.env.POCKETBASE_URL = 'http://already-set:8090';

      loadLocalEnv(dir);

      expect(process.env.POCKETBASE_URL).toBe('http://already-set:8090');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('resolveConnectionConfig', () => {
  it('uses environment values when flags are absent', () => {
    process.env.POCKETBASE_URL = 'http://env-url:8090';
    process.env.POCKETBASE_SUPERUSER_EMAIL = 'env@example.com';
    process.env.POCKETBASE_SUPERUSER_PASSWORD = 'env-secret';

    const config = resolveConnectionConfig({ url: undefined, email: undefined, password: undefined, token: undefined });

    expect(config.url).toBe('http://env-url:8090');
    expect(config.email).toBe('env@example.com');
    expect(config.password).toBe('env-secret');
  });

  it('keeps explicit CLI values ahead of environment values', () => {
    process.env.POCKETBASE_URL = 'http://env-url:8090';
    process.env.POCKETBASE_TOKEN = 'env-token';

    const config = resolveConnectionConfig({
      url: 'http://cli-url:8090',
      token: 'cli-token',
      email: undefined,
      password: undefined,
    });

    expect(config.url).toBe('http://cli-url:8090');
    expect(config.token).toBe('cli-token');
  });

  it('falls back to localhost when neither flags nor env define a URL', () => {
    delete process.env.POCKETBASE_URL;
    delete process.env.POCKETFORGE_URL;

    const config = resolveConnectionConfig({ url: undefined, token: undefined, email: undefined, password: undefined });

    expect(config.url).toBe('http://localhost:8090');
  });
});