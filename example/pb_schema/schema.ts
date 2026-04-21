import { defineSchema, defineCollection, v } from 'pocketforge';

export default defineSchema({
  posts: defineCollection({
    type: 'base',
    fields: {
      title: v.text({ required: true, min: 3, max: 500 }),
      body: v.editor({ required: true }),
      published: v.bool(),
      category: v.select({ values: ['tech', 'news', 'lifestyle', 'other'] as const, required: true }),
      author: v.relationOne('users'),
      tags: v.relationMany('tags', { maxSelect: 10 }),
      cover: v.fileOne({ mimeTypes: ['image/png', 'image/jpeg', 'image/webp'] }),
      views: v.number({ min: 0, onlyInt: true }),
      metadata: v.json(),
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
      { name: 'idx_posts_published', columns: 'published, created' },
    ],
  }),

  tags: defineCollection({
    type: 'base',
    fields: {
      name: v.text({ required: true, min: 1, max: 50 }),
      slug: v.text({ required: true, pattern: '^[a-z0-9-]+$' }),
    },
    rules: {
      list: '',
      view: '',
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
      bio: v.editor(),
    },
    authOptions: {
      passwordAuth: { enabled: true, minPasswordLength: 8 },
    },
  }),

  published_posts: defineCollection({
    type: 'view',
    viewQuery: 'SELECT id, title, category, created FROM posts WHERE published = true',
    rules: {
      list: '',
      view: '',
    },
  }),
});
