import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import type { PBClientConfig } from './client.js';

export interface ConnectionInput {
  url?: string;
  token?: string;
  email?: string;
  password?: string;
}

const ENV_KEYS = {
  url: ['POCKETFORGE_URL', 'POCKETBASE_URL'],
  token: ['POCKETFORGE_TOKEN', 'POCKETBASE_TOKEN', 'POCKETBASE_SUPERUSER_TOKEN'],
  email: ['POCKETFORGE_EMAIL', 'POCKETBASE_EMAIL', 'POCKETBASE_SUPERUSER_EMAIL'],
  password: ['POCKETFORGE_PASSWORD', 'POCKETBASE_PASSWORD', 'POCKETBASE_SUPERUSER_PASSWORD'],
} as const;

function readEnvValue(keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

export function loadLocalEnv(cwd: string = process.cwd()): void {
  const envPath = resolve(cwd, '.env.local');
  if (!existsSync(envPath)) {
    return;
  }

  loadDotenv({ path: envPath, override: false });
}

export function resolveConnectionConfig<T extends ConnectionInput>(
  config: T,
): Omit<T, keyof ConnectionInput> & PBClientConfig {
  return {
    ...config,
    url: config.url || readEnvValue(ENV_KEYS.url) || 'http://localhost:8090',
    token: config.token || readEnvValue(ENV_KEYS.token),
    email: config.email || readEnvValue(ENV_KEYS.email),
    password: config.password || readEnvValue(ENV_KEYS.password),
  };
}