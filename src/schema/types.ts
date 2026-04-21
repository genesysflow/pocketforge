// ---------------------------------------------------------------------------
// Core types for PocketBase schema DSL
// ---------------------------------------------------------------------------

/** Common options shared by all field types */
export interface BaseFieldOptions {
  system?: boolean;
  hidden?: boolean;
  presentable?: boolean;
  help?: string;
}

// -- Text --
export interface TextFieldOptions extends BaseFieldOptions {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  autogeneratePattern?: string;
  primaryKey?: boolean;
}

// -- Number --
export interface NumberFieldOptions extends BaseFieldOptions {
  required?: boolean;
  min?: number;
  max?: number;
  onlyInt?: boolean;
}

// -- Bool --
export interface BoolFieldOptions extends BaseFieldOptions {
  required?: boolean;
}

// -- Email --
export interface EmailFieldOptions extends BaseFieldOptions {
  required?: boolean;
  exceptDomains?: string[];
  onlyDomains?: string[];
}

// -- URL --
export interface UrlFieldOptions extends BaseFieldOptions {
  required?: boolean;
  exceptDomains?: string[];
  onlyDomains?: string[];
}

// -- Date --
export interface DateFieldOptions extends BaseFieldOptions {
  required?: boolean;
  min?: string;
  max?: string;
}

// -- Select --
export interface SelectFieldOptions<V extends readonly string[] = readonly string[]>
  extends BaseFieldOptions {
  values: V;
  required?: boolean;
  maxSelect?: number;
}

// -- Relation --
export interface RelationFieldOptions extends BaseFieldOptions {
  required?: boolean;
  collectionId?: string;
  cascadeDelete?: boolean;
  minSelect?: number;
  maxSelect?: number;
}

// -- File --
export interface FileFieldOptions extends BaseFieldOptions {
  required?: boolean;
  maxSize?: number;
  maxSelect?: number;
  mimeTypes?: string[];
  thumbs?: string[];
  protected?: boolean;
}

// -- JSON --
export interface JsonFieldOptions extends BaseFieldOptions {
  required?: boolean;
  maxSize?: number;
}

// -- GeoPoint --
export interface GeoPointFieldOptions extends BaseFieldOptions {
  required?: boolean;
}

// -- Password --
export interface PasswordFieldOptions extends BaseFieldOptions {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  cost?: number;
}

// -- Editor --
export interface EditorFieldOptions extends BaseFieldOptions {
  required?: boolean;
  maxSize?: number;
  convertURLs?: boolean;
}

// -- Autodate --
export interface AutodateFieldOptions extends BaseFieldOptions {
  onCreate?: boolean;
  onUpdate?: boolean;
}

// ---------------------------------------------------------------------------
// Field definition — carries both JSON config and inferred TS type
// ---------------------------------------------------------------------------

export interface FieldDefinition<TSType = unknown> {
  /** PocketBase field type identifier */
  readonly _type: string;
  /** Inferred TypeScript type (phantom — not used at runtime) */
  readonly _tsType: TSType;
  /** Full options to serialize to JSON */
  readonly _options: Record<string, unknown>;
  /**
   * For relation fields: the collection name this relates to.
   * Resolved to collectionId at push time.
   */
  readonly _relationTarget?: string;
}

// ---------------------------------------------------------------------------
// Collection types
// ---------------------------------------------------------------------------

export type CollectionType = 'base' | 'auth' | 'view';

export type FieldsMap = Record<string, FieldDefinition<any>>;

/** Access rules */
export interface CollectionRules {
  list?: string | null;
  view?: string | null;
  create?: string | null;
  update?: string | null;
  delete?: string | null;
}

export interface IndexDefinition {
  name: string;
  unique?: boolean;
  columns: string;
  where?: string;
}

// -- Auth options (subset exposed to the schema DSL) --

export interface PasswordAuthConfig {
  enabled?: boolean;
  minPasswordLength?: number;
  identityFields?: string[];
}

export interface OAuth2ProviderConfig {
  name: string;
  clientId: string;
  clientSecret?: string;
  authURL?: string;
  tokenURL?: string;
  userInfoURL?: string;
  displayName?: string;
  pkce?: boolean | null;
  extra?: Record<string, unknown> | null;
}

export interface OAuth2Config {
  enabled?: boolean;
  providers?: OAuth2ProviderConfig[];
  mappedFields?: {
    id?: string;
    name?: string;
    username?: string;
    avatarURL?: string;
  };
}

export interface MFAConfig {
  enabled?: boolean;
  duration?: number;
  rule?: string;
}

export interface OTPConfig {
  enabled?: boolean;
  duration?: number;
  length?: number;
  emailTemplate?: { subject?: string; body?: string };
}

export interface TokenConfig {
  duration?: number;
  secret?: string;
}

export interface AuthAlertConfig {
  enabled?: boolean;
  emailTemplate?: { subject?: string; body?: string };
}

export interface AuthOptions {
  authRule?: string | null;
  manageRule?: string | null;
  passwordAuth?: PasswordAuthConfig;
  oauth2?: OAuth2Config;
  mfa?: MFAConfig;
  otp?: OTPConfig;
  authAlert?: AuthAlertConfig;
  authToken?: TokenConfig;
  passwordResetToken?: TokenConfig;
  emailChangeToken?: TokenConfig;
  verificationToken?: TokenConfig;
  fileToken?: TokenConfig;
  verificationTemplate?: { subject?: string; body?: string; actionURL?: string };
  resetPasswordTemplate?: { subject?: string; body?: string; actionURL?: string };
  confirmEmailChangeTemplate?: { subject?: string; body?: string; actionURL?: string };
}

// ---------------------------------------------------------------------------
// Collection definitions (discriminated by `type`)
// ---------------------------------------------------------------------------

export interface BaseCollectionDefinition<F extends FieldsMap = FieldsMap> {
  type: 'base';
  fields: F;
  rules?: CollectionRules;
  indexes?: IndexDefinition[];
}

export interface AuthCollectionDefinition<F extends FieldsMap = FieldsMap> {
  type: 'auth';
  fields: F;
  rules?: CollectionRules;
  indexes?: IndexDefinition[];
  authOptions?: AuthOptions;
}

export interface ViewCollectionDefinition {
  type: 'view';
  viewQuery: string;
  rules?: Pick<CollectionRules, 'list' | 'view'>;
}

export type CollectionDefinition<F extends FieldsMap = FieldsMap> =
  | BaseCollectionDefinition<F>
  | AuthCollectionDefinition<F>
  | ViewCollectionDefinition;

// ---------------------------------------------------------------------------
// Schema definition — the top-level object
// ---------------------------------------------------------------------------

export type SchemaDefinition = Record<string, CollectionDefinition<any>>;

// ---------------------------------------------------------------------------
// Infer record types from schema
// ---------------------------------------------------------------------------

/** Base record fields added by PocketBase to all records */
export interface BaseRecord {
  id: string;
  created: string;
  updated: string;
  collectionId: string;
  collectionName: string;
}

/** Extra fields added to auth collection records */
export interface AuthRecord extends BaseRecord {
  email: string;
  emailVisibility: boolean;
  verified: boolean;
  username: string;
}

/** Infer the TypeScript type for a single field definition */
export type InferFieldType<F> = F extends FieldDefinition<infer T> ? T : never;

/** Infer the full record type for a fields map */
export type InferFields<F extends FieldsMap> = {
  [K in keyof F]: InferFieldType<F[K]>;
};

/** Infer a record type from a collection definition */
export type InferRecord<C extends CollectionDefinition<any>> =
  C extends AuthCollectionDefinition<infer F>
    ? AuthRecord & InferFields<F>
    : C extends BaseCollectionDefinition<infer F>
      ? BaseRecord & InferFields<F>
      : C extends ViewCollectionDefinition
        ? BaseRecord & Record<string, unknown>
        : never;

/** Infer all record types from a schema definition */
export type InferSchema<S extends SchemaDefinition> = {
  [K in keyof S]: InferRecord<S[K]>;
};
