import { describe, it, expect } from 'vitest';
import { v } from '../src/schema/validators.js';
import { defineCollection, defineSchema } from '../src/schema/index.js';
import { schemaToJSON, deterministicId } from '../src/schema/converter.js';

// ---------------------------------------------------------------------------
// Validator unit tests
// ---------------------------------------------------------------------------

describe('validators', () => {
  it('v.text() produces correct field definition', () => {
    const f = v.text({ required: true, min: 3, max: 500, pattern: '^[a-z]+$' });
    expect(f._type).toBe('text');
    expect(f._options).toEqual({ required: true, min: 3, max: 500, pattern: '^[a-z]+$' });
  });

  it('v.number() produces correct field definition', () => {
    const f = v.number({ min: 0, max: 100, onlyInt: true });
    expect(f._type).toBe('number');
    expect(f._options.onlyInt).toBe(true);
  });

  it('v.bool() produces correct field definition', () => {
    const f = v.bool();
    expect(f._type).toBe('bool');
  });

  it('v.email() produces correct field definition', () => {
    const f = v.email({ onlyDomains: ['example.com'] });
    expect(f._type).toBe('email');
    expect(f._options.onlyDomains).toEqual(['example.com']);
  });

  it('v.url() produces correct field definition', () => {
    const f = v.url({ required: true });
    expect(f._type).toBe('url');
    expect(f._options.required).toBe(true);
  });

  it('v.date() produces correct field definition', () => {
    const f = v.date();
    expect(f._type).toBe('date');
  });

  it('v.select() produces correct field definition with values', () => {
    const f = v.select({ values: ['draft', 'published', 'archived'] as const, required: true });
    expect(f._type).toBe('select');
    expect(f._options.values).toEqual(['draft', 'published', 'archived']);
    expect(f._options.required).toBe(true);
  });

  it('v.relation() sets _relationTarget', () => {
    const f = v.relation('users', { cascadeDelete: true });
    expect(f._type).toBe('relation');
    expect(f._relationTarget).toBe('users');
    expect(f._options.cascadeDelete).toBe(true);
    expect(f._options.maxSelect).toBe(1);
  });

  it('v.relationOne() forces maxSelect=1', () => {
    const f = v.relationOne('posts');
    expect(f._options.maxSelect).toBe(1);
  });

  it('v.relationMany() sets large maxSelect', () => {
    const f = v.relationMany('tags');
    expect(f._options.maxSelect).toBe(9999);
    expect(f._relationTarget).toBe('tags');
  });

  it('v.file() sets maxSelect', () => {
    const f = v.file({ maxSelect: 5, mimeTypes: ['image/png'] });
    expect(f._type).toBe('file');
    expect(f._options.maxSelect).toBe(5);
    expect(f._options.mimeTypes).toEqual(['image/png']);
  });

  it('v.fileOne() forces maxSelect=1', () => {
    const f = v.fileOne({ protected: true });
    expect(f._options.maxSelect).toBe(1);
    expect(f._options.protected).toBe(true);
  });

  it('v.json() produces correct field definition', () => {
    const f = v.json({ maxSize: 2_000_000 });
    expect(f._type).toBe('json');
    expect(f._options.maxSize).toBe(2_000_000);
  });

  it('v.geoPoint() produces correct field definition', () => {
    const f = v.geoPoint({ required: true });
    expect(f._type).toBe('geopoint');
    expect(f._options.required).toBe(true);
  });

  it('v.password() produces correct field definition', () => {
    const f = v.password({ min: 8, max: 128 });
    expect(f._type).toBe('password');
    expect(f._options.min).toBe(8);
    expect(f._options.max).toBe(128);
  });

  it('v.editor() produces correct field definition', () => {
    const f = v.editor({ convertURLs: true });
    expect(f._type).toBe('editor');
    expect(f._options.convertURLs).toBe(true);
  });

  it('v.autodate() defaults to onCreate+onUpdate', () => {
    const f = v.autodate();
    expect(f._type).toBe('autodate');
    expect(f._options.onCreate).toBe(true);
    expect(f._options.onUpdate).toBe(true);
  });

  it('v.autodate() can override defaults', () => {
    const f = v.autodate({ onCreate: true, onUpdate: false });
    expect(f._options.onCreate).toBe(true);
    expect(f._options.onUpdate).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Deterministic ID tests
// ---------------------------------------------------------------------------

describe('deterministicId', () => {
  it('produces stable IDs for the same seed', () => {
    const id1 = deterministicId('posts/title');
    const id2 = deterministicId('posts/title');
    expect(id1).toBe(id2);
  });

  it('produces different IDs for different seeds', () => {
    const id1 = deterministicId('posts/title');
    const id2 = deterministicId('posts/body');
    expect(id1).not.toBe(id2);
  });

  it('produces 15-char IDs', () => {
    const id = deterministicId('test/field');
    expect(id).toHaveLength(15);
  });
});

// ---------------------------------------------------------------------------
// Schema conversion tests
// ---------------------------------------------------------------------------

describe('schemaToJSON', () => {
  it('converts a base collection correctly', () => {
    const schema = defineSchema({
      posts: defineCollection({
        type: 'base',
        fields: {
          title: v.text({ required: true, min: 3 }),
          body: v.editor({ required: true }),
          published: v.bool(),
        },
        rules: {
          list: '',
          create: '@request.auth.id != ""',
        },
      }),
    });

    const json = schemaToJSON(schema);
    expect(json).toHaveLength(1);

    const col = json[0]!;
    expect(col.name).toBe('posts');
    expect(col.type).toBe('base');
    expect(col.fields).toHaveLength(3);
    expect(col.listRule).toBe('');
    expect(col.createRule).toBe('@request.auth.id != ""');

    const titleField = col.fields!.find((f) => f.name === 'title')!;
    expect(titleField.type).toBe('text');
    expect(titleField.required).toBe(true);
    expect(titleField.min).toBe(3);
    // Has a deterministic ID
    expect(titleField.id).toBeTruthy();
    expect(titleField.id).toHaveLength(15);
  });

  it('converts an auth collection correctly', () => {
    const schema = defineSchema({
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

    const json = schemaToJSON(schema);
    const col = json[0]!;
    expect(col.type).toBe('auth');
    expect(col.passwordAuth).toEqual({ enabled: true, minPasswordLength: 8 });
  });

  it('converts a view collection correctly', () => {
    const schema = defineSchema({
      published_posts: defineCollection({
        type: 'view',
        viewQuery: 'SELECT id, title, created FROM posts WHERE published = true',
        rules: { list: '' },
      }),
    });

    const json = schemaToJSON(schema);
    const col = json[0]!;
    expect(col.type).toBe('view');
    expect(col.viewQuery).toBe('SELECT id, title, created FROM posts WHERE published = true');
    expect(col.fields).toBeUndefined();
  });

  it('resolves relation collectionId from idMap', () => {
    const schema = defineSchema({
      posts: defineCollection({
        type: 'base',
        fields: {
          author: v.relationOne('users'),
        },
      }),
    });

    const json = schemaToJSON(schema, { users: 'abc123', posts: 'def456' });
    const col = json[0]!;
    const authorField = col.fields!.find((f) => f.name === 'author')!;
    expect(authorField.collectionId).toBe('abc123');
    expect(col.id).toBe('def456');
  });

  it('assigns deterministic IDs to new collections so same-import relations resolve', () => {
    const schema = defineSchema({
      posts: defineCollection({
        type: 'base',
        fields: { author: v.relationOne('users') },
      }),
      users: defineCollection({
        type: 'auth',
        fields: { name: v.text() },
      }),
    });

    const json = schemaToJSON(schema);
    const posts = json.find((c) => c.name === 'posts')!;
    const users = json.find((c) => c.name === 'users')!;

    expect(users.id).toBeTruthy();
    expect(users.id).toHaveLength(15);

    const authorField = posts.fields!.find((f) => f.name === 'author')!;
    // Relation must resolve to the target collection's assigned ID, not its name
    expect(authorField.collectionId).toBe(users.id);
    expect(authorField.collectionId).not.toBe('users');
  });

  it('converts indexes correctly', () => {
    const schema = defineSchema({
      posts: defineCollection({
        type: 'base',
        fields: {
          title: v.text(),
          category: v.text(),
        },
        indexes: [
          { name: 'idx_posts_category', columns: 'category' },
          { name: 'idx_posts_title', unique: true, columns: 'title' },
        ],
      }),
    });

    const json = schemaToJSON(schema);
    const col = json[0]!;
    expect(col.indexes).toHaveLength(2);
    expect(col.indexes![0]).toBe('CREATE INDEX `idx_posts_category` ON `posts` (category)');
    expect(col.indexes![1]).toBe('CREATE UNIQUE INDEX `idx_posts_title` ON `posts` (title)');
  });
});
