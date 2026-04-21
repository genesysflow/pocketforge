// Main public API for pocketforge
export { defineCollection, defineSchema } from './schema/index.js';
export { v } from './schema/validators.js';
export { schemaToJSON, deterministicId } from './schema/converter.js';
export type {
  // Field option types
  TextFieldOptions,
  NumberFieldOptions,
  BoolFieldOptions,
  EmailFieldOptions,
  UrlFieldOptions,
  DateFieldOptions,
  SelectFieldOptions,
  RelationFieldOptions,
  FileFieldOptions,
  JsonFieldOptions,
  GeoPointFieldOptions,
  PasswordFieldOptions,
  EditorFieldOptions,
  AutodateFieldOptions,
  // Core types
  FieldDefinition,
  FieldsMap,
  CollectionType,
  CollectionRules,
  IndexDefinition,
  AuthOptions,
  BaseCollectionDefinition,
  AuthCollectionDefinition,
  ViewCollectionDefinition,
  CollectionDefinition,
  SchemaDefinition,
  // Inference helpers
  BaseRecord,
  AuthRecord,
  InferFieldType,
  InferFields,
  InferRecord,
  InferSchema,
} from './schema/types.js';
