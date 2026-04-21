# pocketforge

TypeScript schema DSL and typed client generator for [PocketBase](https://pocketbase.io). Define your collections in TypeScript, push them to PocketBase, and get a fully typed client — similar to [Convex](https://convex.dev) schemas.

## Features

- **Schema DSL** — Define collections, fields, rules, and indexes in TypeScript
- **Bidirectional sync** — Push schemas to PocketBase or pull existing collections into a schema file
- **Automatic type generation** — Record, Create, and Update interfaces for every collection
- **Typed client** — Generated `TypedPocketBase` with full autocomplete for collection names, fields, and operations
- **Dev mode** — Watch your schema file and auto-push + regenerate types on save
- **All 14 field types** — text, number, bool, email, url, date, select, relation, file, json, geoPoint, password, editor, autodate

## Install

```bash
npm install pocketforge pocketbase
```

## Quick Start

### 1. Define your schema

```typescript
// pb_schema/schema.ts
import { defineSchema, defineCollection, v } from 'pocketforge';

export default defineSchema({
  posts: defineCollection({
    type: 'base',
    fields: {
      title: v.text({ required: true, min: 3, max: 500 }),
      body: v.editor({ required: true }),
      published: v.bool(),
      category: v.select({ values: ['tech', 'news', 'other'] as const, required: true }),
      author: v.relationOne('users'),
      tags: v.relationMany('tags', { maxSelect: 10 }),
      cover: v.fileOne({ mimeTypes: ['image/png', 'image/jpeg'] }),
      views: v.number({ min: 0, onlyInt: true }),
    },
    rules: {
      list: '',
      view: '',
      create: '@request.auth.id != ""',
      update: '@request.auth.id = author',
      delete: '@request.auth.id = author',
    },
    indexes: [
      { name: 'idx_posts_category', columns: 'category' },
    ],
  }),

  tags: defineCollection({
    type: 'base',
    fields: {
      name: v.text({ required: true }),
      slug: v.text({ required: true, pattern: '^[a-z0-9-]+$' }),
    },
    indexes: [
      { name: 'idx_tags_slug', unique: true, columns: 'slug' },
    ],
  }),

  users: defineCollection({
    type: 'auth',
    fields: {
      name: v.text({ max: 100 }),
      avatar: v.fileOne({ mimeTypes: ['image/png', 'image/jpeg'] }),
    },
    authOptions: {
      passwordAuth: { enabled: true, minPasswordLength: 8 },
    },
  }),
});
```

### 2. Push to PocketBase

```bash
npx pocketforge push --url http://localhost:8090 --email admin@example.com --password secret
```

You can also place connection settings in `.env.local` and omit the flags:

```dotenv
POCKETBASE_URL=http://localhost:8090
POCKETBASE_SUPERUSER_EMAIL=admin@example.com
POCKETBASE_SUPERUSER_PASSWORD=secret
```

### 3. Generate types

```bash
npx pocketforge generate
```

This creates three files in `pb_schema/generated/`:

- **`types.ts`** — Record, Create, and Update interfaces for each collection
- **`client.ts`** — `TypedPocketBase` interface and `createClient()` factory
- **`index.ts`** — Barrel re-export

### 4. Use the typed client

```typescript
import { createClient } from './pb_schema/generated';

const pb = createClient('http://localhost:8090');

// Full autocomplete on collection names
const posts = await pb.collection('posts').getList(1, 20, {
  filter: 'published = true',
  sort: '-created',
});

// posts.items[0].category → 'tech' | 'news' | 'other'
// posts.items[0].title    → string
// posts.items[0].views    → number

// Type-safe create — required fields enforced at compile time
await pb.collection('posts').create({
  title: 'Hello World',       // required
  body: '<p>Content</p>',     // required
  category: 'tech',           // autocomplete: 'tech' | 'news' | 'other'
  published: true,
});

// Type-safe update — all fields optional
await pb.collection('posts').update('RECORD_ID', {
  views: 42,
});

// Auth collections include password fields in create
await pb.collection('users').create({
  email: 'user@example.com',
  password: 'securepassword',
  passwordConfirm: 'securepassword',
  name: 'Alice',
});
```

## CLI Reference

### `pocketforge push`

Push your TypeScript schema to PocketBase.

```bash
npx pocketforge push [options]
```

| Option | Description | Default |
|---|---|---|
| `-u, --url <url>` | PocketBase server URL | *required* |
| `-e, --email <email>` | Superuser email | — |
| `-p, --password <password>` | Superuser password | — |
| `-t, --token <token>` | Superuser auth token (alternative to email/password) | — |
| `-s, --schema <path>` | Path to schema file | `pb_schema/schema.ts` |
| `--delete-missing` | Delete collections not in the schema | `false` |
| `--dry-run` | Preview the JSON payload without applying | `false` |

Connection options can also be loaded from `.env.local`. Supported variables are `POCKETBASE_URL`, `POCKETBASE_TOKEN`, `POCKETBASE_SUPERUSER_TOKEN`, `POCKETBASE_EMAIL`, `POCKETBASE_SUPERUSER_EMAIL`, `POCKETBASE_PASSWORD`, `POCKETBASE_SUPERUSER_PASSWORD`, plus the same names with a `POCKETFORGE_` prefix.

### `pocketforge pull`

Pull existing collections from PocketBase and generate a `schema.ts` file.

```bash
npx pocketforge pull [options]
```

| Option | Description | Default |
|---|---|---|
| `-u, --url <url>` | PocketBase server URL | *required* |
| `-e, --email <email>` | Superuser email | — |
| `-p, --password <password>` | Superuser password | — |
| `-t, --token <token>` | Superuser auth token | — |
| `-o, --output <path>` | Output schema file path | `pb_schema/schema.ts` |
| `--include-system` | Include system collections | `false` |

### `pocketforge generate`

Generate TypeScript types and a typed client from your schema.

```bash
npx pocketforge generate [options]
```

| Option | Description | Default |
|---|---|---|
| `-s, --schema <path>` | Path to schema file | `pb_schema/schema.ts` |
| `-o, --output <dir>` | Output directory for generated files | `pb_schema/generated` |
| `--from-server` | Generate from server collections instead of local schema | `false` |
| `-u, --url <url>` | PocketBase server URL (with `--from-server`) | — |

When `--from-server` is used, the same `.env.local` connection variables are supported.

### `pocketforge dev`

Watch your schema file and auto-push + regenerate on every save.

```bash
npx pocketforge dev [options]
```

| Option | Description | Default |
|---|---|---|
| `-u, --url <url>` | PocketBase server URL | *required* |
| `-e, --email <email>` | Superuser email | — |
| `-p, --password <password>` | Superuser password | — |
| `-t, --token <token>` | Superuser auth token | — |
| `-s, --schema <path>` | Path to schema file | `pb_schema/schema.ts` |
| `-o, --output <dir>` | Output directory | `pb_schema/generated` |
| `--delete-missing` | Delete collections not in the schema | `false` |

## Field Types

All 14 PocketBase field types are supported via the `v` validator namespace:

| Validator | PocketBase Type | TypeScript Type | Description |
|---|---|---|---|
| `v.text(opts?)` | `text` | `string` | Text / string field |
| `v.number(opts?)` | `number` | `number` | Numeric field |
| `v.bool(opts?)` | `bool` | `boolean` | Boolean field |
| `v.email(opts?)` | `email` | `string` | Email with validation |
| `v.url(opts?)` | `url` | `string` | URL with validation |
| `v.date(opts?)` | `date` | `string` | ISO 8601 date string |
| `v.select(opts)` | `select` | `'a' \| 'b'` | Single/multi select with literal types |
| `v.relation(col, opts?)` | `relation` | `string \| string[]` | Relation to another collection |
| `v.relationOne(col, opts?)` | `relation` | `string` | Single relation (maxSelect=1) |
| `v.relationMany(col, opts?)` | `relation` | `string[]` | Multi relation |
| `v.file(opts?)` | `file` | `string \| string[]` | File upload |
| `v.fileOne(opts?)` | `file` | `string` | Single file upload |
| `v.fileMany(opts?)` | `file` | `string[]` | Multi file upload |
| `v.json(opts?)` | `json` | `unknown` | Arbitrary JSON |
| `v.geoPoint(opts?)` | `geopoint` | `{ lat: number; lon: number }` | GPS coordinates |
| `v.password(opts?)` | `password` | *(hidden)* | Bcrypt-hashed, excluded from record type |
| `v.editor(opts?)` | `editor` | `string` | Rich text / HTML |
| `v.autodate(opts?)` | `autodate` | `string` | Auto-timestamp on create/update |

### Select with literal types

Use `as const` on the values array to get a union type instead of `string`:

```typescript
// category: 'tech' | 'news' | 'other'
category: v.select({ values: ['tech', 'news', 'other'] as const })
```

## Collection Types

### Base collection

```typescript
defineCollection({
  type: 'base',
  fields: { /* ... */ },
  rules: { list, view, create, update, delete },
  indexes: [{ name, columns, unique?, where? }],
})
```

### Auth collection

Extends base with authentication options. System fields (`email`, `password`, `verified`, `username`) are added automatically.

```typescript
defineCollection({
  type: 'auth',
  fields: { /* custom fields only */ },
  rules: { /* ... */ },
  authOptions: {
    passwordAuth: { enabled: true, minPasswordLength: 8 },
    oauth2: { enabled: true, providers: [/* ... */] },
    mfa: { enabled: true, duration: 300 },
    otp: { enabled: true, duration: 300, length: 6 },
  },
})
```

### View collection

Read-only collection backed by a SQL query. Fields are auto-derived by PocketBase.

```typescript
defineCollection({
  type: 'view',
  viewQuery: 'SELECT id, title FROM posts WHERE published = true',
  rules: { list: '', view: '' },
})
```

## Generated Types

For a collection named `posts`, the generator produces:

| Interface | Purpose |
|---|---|
| `PostsRecord` | Full record type (includes `id`, `created`, `updated` + all fields) |
| `PostsCreate` | Create input (required fields are non-optional, others optional) |
| `PostsUpdate` | Update input (all fields optional) |

Plus these collection-wide types:

```typescript
type CollectionName = "posts" | "tags" | "users";

interface CollectionRecords {
  posts: PostsRecord;
  tags: TagsRecord;
  users: UsersRecord;
}
```

**New project:** Define schema → `npx pocketforge push` → `pocketforge generate` → code with types

**Existing project:** `npx pocketforge pull` → review generated schema → `pocketforge generate` → code with types

**Development:** `npx pocketforge dev` → edit schema → types auto-regenerate on save

## License

MIT
