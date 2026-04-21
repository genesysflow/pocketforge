// ---------------------------------------------------------------------------
// Validator builders — PocketBase field type → FieldDefinition<TSType>
// ---------------------------------------------------------------------------
// Each function returns a FieldDefinition carrying:
//   - _type:    the PocketBase field type string
//   - _tsType:  phantom TS type (never read at runtime)
//   - _options: all options to serialize into the import JSON
//   - _relationTarget: (relation only) collection name for resolution
// ---------------------------------------------------------------------------

import type {
  AutodateFieldOptions,
  BoolFieldOptions,
  DateFieldOptions,
  EditorFieldOptions,
  EmailFieldOptions,
  FieldDefinition,
  FileFieldOptions,
  GeoPointFieldOptions,
  JsonFieldOptions,
  NumberFieldOptions,
  PasswordFieldOptions,
  RelationFieldOptions,
  SelectFieldOptions,
  TextFieldOptions,
  UrlFieldOptions,
} from './types.js';

function field<T>(type: string, options: Record<string, unknown>): FieldDefinition<T> {
  return { _type: type, _tsType: undefined as unknown as T, _options: options };
}

function fieldWithRelation<T>(
  type: string,
  options: Record<string, unknown>,
  relationTarget: string,
): FieldDefinition<T> {
  return {
    _type: type,
    _tsType: undefined as unknown as T,
    _options: options,
    _relationTarget: relationTarget,
  };
}

// ---------------------------------------------------------------------------
// Public API — `v` namespace
// ---------------------------------------------------------------------------

/** String/text field */
function text(opts?: TextFieldOptions): FieldDefinition<string> {
  return field<string>('text', { ...opts });
}

/** Number field */
function number(opts?: NumberFieldOptions): FieldDefinition<number> {
  return field<number>('number', { ...opts });
}

/** Boolean field */
function bool(opts?: BoolFieldOptions): FieldDefinition<boolean> {
  return field<boolean>('bool', { ...opts });
}

/** Email field */
function email(opts?: EmailFieldOptions): FieldDefinition<string> {
  return field<string>('email', { ...opts });
}

/** URL field */
function url(opts?: UrlFieldOptions): FieldDefinition<string> {
  return field<string>('url', { ...opts });
}

/** Date field (ISO 8601 string) */
function date(opts?: DateFieldOptions): FieldDefinition<string> {
  return field<string>('date', { ...opts });
}

/**
 * Select field with literal type inference.
 *
 * Usage:
 *   v.select({ values: ['draft', 'published'] as const })
 *   // → FieldDefinition<'draft' | 'published'>  (single)
 *   v.select({ values: ['a', 'b'] as const, maxSelect: 3 })
 *   // → FieldDefinition<('a' | 'b')[]>  (multi)
 */
function select<const V extends readonly string[]>(
  opts: SelectFieldOptions<V>,
): FieldDefinition<
  V[number] extends never
    ? string
    : typeof opts extends { maxSelect: number }
      ? (V[number])[]
      : V[number]
> {
  return field(
    'select',
    { ...opts, values: [...opts.values] },
  );
}

/**
 * Relation field.
 *
 * @param collection  Target collection name (resolved to ID at push time)
 * @param opts        Relation options
 *
 * Returns `string` for single relations, `string[]` for multi (maxSelect > 1).
 */
function relation(
  collection: string,
  opts?: Omit<RelationFieldOptions, 'collectionId'>,
): FieldDefinition<string | string[]> {
  const maxSelect = opts?.maxSelect ?? 1;
  if (maxSelect === 1) {
    return fieldWithRelation<string>('relation', { ...opts, maxSelect }, collection);
  }
  return fieldWithRelation<string[]>('relation', { ...opts, maxSelect }, collection);
}

/** Single relation (maxSelect=1), returns string ID */
function relationOne(
  collection: string,
  opts?: Omit<RelationFieldOptions, 'collectionId' | 'maxSelect'>,
): FieldDefinition<string> {
  return fieldWithRelation<string>('relation', { ...opts, maxSelect: 1 }, collection);
}

/** Multi relation (maxSelect > 1), returns string[] IDs */
function relationMany(
  collection: string,
  opts?: Omit<RelationFieldOptions, 'collectionId' | 'maxSelect'> & { maxSelect?: number },
): FieldDefinition<string[]> {
  return fieldWithRelation<string[]>(
    'relation',
    { ...opts, maxSelect: opts?.maxSelect ?? 9999 },
    collection,
  );
}

/**
 * File field.
 *
 * Single file (maxSelect=1) → string filename.
 * Multi file (maxSelect > 1) → string[] filenames.
 */
function file(
  opts?: FileFieldOptions,
): FieldDefinition<string | string[]> {
  const maxSelect = opts?.maxSelect ?? 1;
  if (maxSelect === 1) {
    return field<string>('file', { ...opts, maxSelect });
  }
  return field<string[]>('file', { ...opts, maxSelect });
}

/** Single file upload field */
function fileOne(opts?: Omit<FileFieldOptions, 'maxSelect'>): FieldDefinition<string> {
  return field<string>('file', { ...opts, maxSelect: 1 });
}

/** Multi file upload field */
function fileMany(
  opts?: Omit<FileFieldOptions, 'maxSelect'> & { maxSelect?: number },
): FieldDefinition<string[]> {
  return field<string[]>('file', { ...opts, maxSelect: opts?.maxSelect ?? 9999 });
}

/** JSON field (untyped by default, or pass a generic) */
function json<T = unknown>(opts?: JsonFieldOptions): FieldDefinition<T> {
  return field<T>('json', { ...opts });
}

/** GeoPoint field → { lat: number; lon: number } */
function geoPoint(opts?: GeoPointFieldOptions): FieldDefinition<{ lat: number; lon: number }> {
  return field<{ lat: number; lon: number }>('geopoint', { ...opts });
}

/** Password field (never returned in API responses) */
function password(opts?: PasswordFieldOptions): FieldDefinition<never> {
  return field<never>('password', { ...opts });
}

/** Rich text / HTML editor field */
function editor(opts?: EditorFieldOptions): FieldDefinition<string> {
  return field<string>('editor', { ...opts });
}

/** Auto-date field (automatically set on create/update) */
function autodate(opts?: AutodateFieldOptions): FieldDefinition<string> {
  return field<string>('autodate', {
    onCreate: true,
    onUpdate: true,
    ...opts,
  });
}

// ---------------------------------------------------------------------------
// Export as `v` namespace object
// ---------------------------------------------------------------------------

export const v = {
  text,
  number,
  bool,
  email,
  url,
  date,
  select,
  relation,
  relationOne,
  relationMany,
  file,
  fileOne,
  fileMany,
  json,
  geoPoint,
  password,
  editor,
  autodate,
} as const;
