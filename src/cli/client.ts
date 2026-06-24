// ---------------------------------------------------------------------------
// Shared helpers for CLI commands — PocketBase REST API client
// ---------------------------------------------------------------------------

export interface PBClientConfig {
  url: string;
  token?: string;
  email?: string;
  password?: string;
}

export class PBAdminClient {
  private baseUrl: string;
  private token: string = '';

  constructor(private config: PBClientConfig) {
    this.baseUrl = config.url.replace(/\/+$/, '');
  }

  async authenticate(): Promise<void> {
    if (this.config.token) {
      this.token = this.config.token;
      return;
    }

    if (!this.config.email || !this.config.password) {
      throw new Error(
        'Authentication required. Provide --token or both --email and --password.',
      );
    }

    const res = await fetch(
      `${this.baseUrl}/api/superusers/auth-with-password`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity: this.config.email,
          password: this.config.password,
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Authentication failed (${res.status}): ${body}`);
    }

    const data = (await res.json()) as { token: string };
    this.token = data.token;
  }

  private authHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: this.token } : {}),
    };
  }

  /** GET /api/collections — list all collections */
  async listCollections(): Promise<CollectionResponse[]> {
    const res = await fetch(
      `${this.baseUrl}/api/collections?perPage=500`,
      { headers: this.authHeaders() },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to list collections (${res.status}): ${body}`);
    }
    const data = (await res.json()) as { items: CollectionResponse[] };
    return data.items;
  }

  /**
   * POST /api/backups — create a full backup of pb_data (database + uploaded
   * files) and return the backup name.
   *
   * PocketBase responds 204 with no body, so the name is generated/echoed
   * client-side rather than read back from the response. `name` must satisfy
   * PocketBase's `^[a-z0-9_-]+\.zip$` rule; when omitted a timestamped default
   * is used.
   */
  async createBackup(name?: string): Promise<string> {
    const backupName = name ?? defaultBackupName();
    const res = await fetch(
      `${this.baseUrl}/api/backups`,
      {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify({ name: backupName }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Backup failed (${res.status}): ${body}`);
    }

    return backupName;
  }

  /** PUT /api/collections/import — batch import (upsert) collections */
  async importCollections(
    collections: Record<string, unknown>[],
    deleteMissing: boolean = false,
  ): Promise<void> {
    const res = await fetch(
      `${this.baseUrl}/api/collections/import`,
      {
        method: 'PUT',
        headers: this.authHeaders(),
        body: JSON.stringify({ collections, deleteMissing }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Import failed (${res.status}): ${body}`);
    }
  }
}

/**
 * UTC-timestamped default backup name, e.g. `pocketforge-backup-20260624-153012.zip`.
 * Matches PocketBase's `^[a-z0-9_-]+\.zip$` naming rule.
 */
export function defaultBackupName(date: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
    `-${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}`;
  return `pocketforge-backup-${stamp}.zip`;
}

// ---------------------------------------------------------------------------
// Types for PocketBase collection API responses
// ---------------------------------------------------------------------------

export interface FieldResponse {
  id: string;
  name: string;
  type: string;
  system: boolean;
  hidden: boolean;
  presentable: boolean;
  required?: boolean;
  [key: string]: unknown;
}

export interface CollectionResponse {
  id: string;
  name: string;
  type: string;
  system: boolean;
  fields: FieldResponse[];
  indexes: string[];
  listRule: string | null;
  viewRule: string | null;
  createRule: string | null;
  updateRule: string | null;
  deleteRule: string | null;
  viewQuery?: string;
  [key: string]: unknown;
}
