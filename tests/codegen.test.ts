import { describe, it, expect } from 'vitest';
import { defineSchema, defineCollection, v } from '../src/index.js';
import { generateTypes } from '../src/codegen/types.js';
import { generateClient } from '../src/codegen/client.js';

// ---------------------------------------------------------------------------
// Record type generation tests
// ---------------------------------------------------------------------------

describe('generateTypes', () => {
  const schema = defineSchema({
    posts: defineCollection({
      type: 'base',
      fields: {
        title: v.text({ required: true }),
        body: v.editor(),
        views: v.number({ onlyInt: true }),
        published: v.bool(),
        category: v.select({ values: ['tech', 'news', 'other'] as const }),
        author: v.relationOne('users'),
        tags: v.relationMany('tags'),
        cover: v.fileOne(),
        attachments: v.fileMany({ maxSelect: 10 }),
        metadata: v.json(),
        location: v.geoPoint(),
        secret: v.password({ min: 8 }),
      },
    }),
    users: defineCollection({
      type: 'auth',
      fields: {
        name: v.text({ max: 100 }),
        avatar: v.fileOne(),
      },
    }),
    stats: defineCollection({
      type: 'view',
      viewQuery: 'SELECT id, COUNT(*) as total FROM posts',
    }),
  });

  const output = generateTypes(schema);

  it('generates BaseRecord and AuthRecord interfaces', () => {
    expect(output).toContain('export interface BaseRecord {');
    expect(output).toContain('export interface AuthRecord extends BaseRecord {');
  });

  it('generates PostsRecord with correct field types', () => {
    expect(output).toContain('export interface PostsRecord extends BaseRecord {');
    expect(output).toContain('title: string;');
    expect(output).toContain('body: string;');
    expect(output).toContain('views: number;');
    expect(output).toContain('published: boolean;');
    expect(output).toContain('category: "tech" | "news" | "other";');
    expect(output).toContain('author: string;');
    expect(output).toContain('tags: string[];');
    expect(output).toContain('cover: string;');
    expect(output).toContain('attachments: string[];');
    expect(output).toContain('metadata: unknown;');
    expect(output).toContain('location: { lat: number; lon: number };');
    // password fields should NOT appear in record type
    expect(output).not.toMatch(/PostsRecord[\s\S]*?secret.*never/);
  });

  it('generates UsersRecord extending AuthRecord', () => {
    expect(output).toContain('export interface UsersRecord extends AuthRecord {');
    expect(output).toContain('name: string;');
    expect(output).toContain('avatar: string;');
  });

  it('generates StatsRecord for view collection', () => {
    expect(output).toContain('export interface StatsRecord extends BaseRecord {');
    expect(output).toContain('[key: string]: unknown;');
  });

  it('generates PostsCreate with required fields', () => {
    expect(output).toContain('export interface PostsCreate {');
    expect(output).toMatch(/PostsCreate[\s\S]*?title: string;/);
    // Non-required fields should be optional in create
    expect(output).toMatch(/PostsCreate[\s\S]*?body\?: string;/);
  });

  it('generates PostsUpdate with all optional fields', () => {
    expect(output).toContain('export interface PostsUpdate {');
    expect(output).toMatch(/PostsUpdate[\s\S]*?title\?: string;/);
  });

  it('generates UsersCreate with password fields', () => {
    expect(output).toContain('export interface UsersCreate {');
    expect(output).toMatch(/UsersCreate[\s\S]*?password: string;/);
    expect(output).toMatch(/UsersCreate[\s\S]*?passwordConfirm: string;/);
  });

  it('generates CollectionName union type', () => {
    expect(output).toContain('export type CollectionName = "posts" | "users" | "stats";');
  });

  it('generates CollectionRecords map', () => {
    expect(output).toContain('export interface CollectionRecords {');
    expect(output).toContain('posts: PostsRecord;');
    expect(output).toContain('users: UsersRecord;');
    expect(output).toContain('stats: StatsRecord;');
  });

  it('does not generate create/update for view collections', () => {
    expect(output).not.toContain('StatsCreate');
    expect(output).not.toContain('StatsUpdate');
  });
});

// ---------------------------------------------------------------------------
// Client generation tests
// ---------------------------------------------------------------------------

describe('generateClient', () => {
  const schema = defineSchema({
    posts: defineCollection({
      type: 'base',
      fields: {
        title: v.text({ required: true }),
      },
    }),
    users: defineCollection({
      type: 'auth',
      fields: {
        name: v.text(),
      },
    }),
  });

  const output = generateClient(schema);

  it('imports PocketBase and RecordService', () => {
    expect(output).toContain("import PocketBase from 'pocketbase';");
    expect(output).toContain("import type { RecordService, RecordOptions } from 'pocketbase';");
  });

  it('imports generated record types', () => {
    expect(output).toContain('PostsRecord,');
    expect(output).toContain('PostsCreate,');
    expect(output).toContain('PostsUpdate,');
    expect(output).toContain('UsersRecord,');
  });

  it('generates TypedRecordService interface', () => {
    expect(output).toContain('export interface TypedRecordService<');
    expect(output).toContain("extends Omit<RecordService<R>, 'create' | 'update'>");
  });

  it('generates TypedPocketBase with overloaded collection()', () => {
    expect(output).toContain('export interface TypedPocketBase extends PocketBase {');
    expect(output).toContain('collection(idOrName: "posts"): TypedRecordService<PostsRecord, PostsCreate, PostsUpdate>;');
    expect(output).toContain('collection(idOrName: "users"): TypedRecordService<UsersRecord, UsersCreate, UsersUpdate>;');
    // Fallback
    expect(output).toContain('collection(idOrName: string): RecordService;');
  });

  it('generates createClient factory', () => {
    expect(output).toContain('export function createClient(url: string): TypedPocketBase {');
    expect(output).toContain('return new PocketBase(url) as TypedPocketBase;');
  });
});
