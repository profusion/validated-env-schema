import type { TypeFromJSONSchema } from '@profusion/json-schema-to-typescript-definitions';
import type { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import type { DeepReadonly } from 'json-schema-to-ts/lib/types/type-utils/readonly';

type ReadonlyJSONSchema = DeepReadonly<JSONSchema7>;
type ReadonlyJSONSchemaDefinition = DeepReadonly<JSONSchema7Definition>;

// string-only keys
export type KeyOf<T extends object> = keyof T & string;

export type BaseEnvSchema = {
  type: 'object';
  properties: Readonly<{ [key: string]: ReadonlyJSONSchema }>;
  required?: readonly string[];
  dependencies?: Readonly<{
    [key: string]: ReadonlyJSONSchemaDefinition | string[];
  }>;
  additionalProperties?: true; // if provided, must be true, otherwise it may hurt process.env
};

export type BaseEnvParsed<S extends BaseEnvSchema> = Record<
  KeyOf<S['properties']>,
  unknown
>;

export type EnvSchemaProperties<
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
  Keys extends KeyOf<S['properties'] & V> = KeyOf<S['properties'] & V>,
> = {
  [K in Keys]: [K, S['properties'][K]];
}[Keys][];

export const schemaProperties = <
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
  Ret extends EnvSchemaProperties<S, V> = EnvSchemaProperties<S, V>,
>({
  properties,
}: S): Readonly<Ret> => Object.entries(properties) as Ret;

export type EnvSchemaPropertyValue<
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S>,
> = V[KeyOf<V>];

/**
 * Errors are stored per-property/variable, if something
 * else will be stored in $other.
 *
 * Multiple phases may produce errors, then it's stored as array.
 */
export type EnvSchemaErrors<S extends BaseEnvSchema> = Partial<{
  [K in KeyOf<S['properties']> | '$other']: Error[];
}>;
export type EnvSchemaMaybeErrors<S extends BaseEnvSchema> =
  | EnvSchemaErrors<S>
  | undefined;

/**
 * Parse one property from string to the best ReadonlyJSONSchema.
 *
 * There is no need to coerce types as Ajv.validate() will do that
 * for you.
 */
export type EnvSchemaParserFn<
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
> = (
  str: string,
  propertySchema: Readonly<S['properties'][KeyOf<S['properties']>]>,
  key: KeyOf<S['properties']>,
  schema: Readonly<S>,
) => EnvSchemaPropertyValue<S, V>;

/**
 * Customize the parser to be used for each property.
 *
 * If not provided, the default is to `JSON.parse()` and, if that fails,
 * keep the original value as a string.
 */
export type EnvSchemaCustomParsers<
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
> = Readonly<
  Partial<{
    [K in KeyOf<S['properties']>]: EnvSchemaParserFn<S, V>;
  }>
>;

/**
 * Serialize one property from validated ReadonlyJSONSchema to string.
 *
 * The types will be validated by Ajv.validate()
 */
export type EnvSchemaSerializeFn<
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
> = (
  value: Exclude<EnvSchemaPropertyValue<S, V>, undefined>,
  propertySchema: Readonly<S['properties'][KeyOf<S['properties']>]>,
  key: KeyOf<S['properties']>,
  schema: Readonly<S>,
) => string;

/**
 * Customize the parser to be used for each property.
 *
 * If not provided, the default is to `JSON.stringify()`,
 * unless it's already a string.
 */
export type EnvSchemaCustomSerializers<
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
> = Readonly<
  Partial<{
    [K in KeyOf<S['properties']>]: EnvSchemaSerializeFn<S, V>;
  }>
>;

/**
 * Validate one property after Ajv validated the whole set.
 *
 * If a new value is returned, then it will be stored in the place
 * of the original value.
 *
 * If the validator throw, the error will be accumulated and dispatched
 * at the end in a single batch with an array of errors.
 *
 * If `undefined` is returned, the value will be **REMOVED** from the
 * `allValues`
 */
export type EnvSchemaPostValidateFn<
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
  PV extends EnvSchemaPropertyValue<S, V> = EnvSchemaPropertyValue<S, V>,
> = (
  value: PV | undefined,
  propertySchema: S['properties'][KeyOf<S['properties']>],
  key: KeyOf<S['properties']>,
  schema: Readonly<S>,
  allValues: Partial<V>,
  errors: Readonly<EnvSchemaMaybeErrors<S>>,
) => PV | undefined;

/**
 * Customize the validator to be executed for each property,
 * **AFTER** `Ajv.validate()` is executed.
 *
 * Each validator will receive the other properties for convenience.
 */
export type EnvSchemaCustomPostValidators<
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
> = Readonly<
  Partial<{
    [K in KeyOf<S['properties']>]: EnvSchemaPostValidateFn<S, V>;
  }>
>;

/**
 * Convert ReadonlyJSONSchema to high-level values, such as 'Date'.
 *
 * This is executed with the post-Validated data.
 */
export type EnvSchemaConvertFn<
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S>,
  // we must match any return type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Ret = any,
> = (
  value: EnvSchemaPropertyValue<S, V> | undefined,
  propertySchema: S['properties'][KeyOf<S['properties']>],
  key: KeyOf<S['properties']>,
  schema: Readonly<S>,
  allValues: Partial<V>,
  errors: Readonly<EnvSchemaMaybeErrors<S>>,
) => Ret;

/**
 * Each converter will receive the other properties for convenience.
 *
 * If not provided, the value will be kept as the post-validated
 * ReadonlyJSONSchema that matches the type (TypeFromJSONSchema),
 * otherwise it may be converted to high-level type, such as `Date`.
 */
export type EnvSchemaCustomConverters<
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S>,
> = Readonly<
  Partial<{
    [K in KeyOf<S['properties'] & V>]: EnvSchemaConvertFn<S, V>;
  }>
>;

/**
 * Customizations, in order of execution:
 * - parse the value from string
 * - post-validate (after `Ajv.validate()`) the parsed value
 * - serialize the post-validated value back to string
 * - convert the JSON type to native type (ie: `Date`)
 */
export type EnvSchemaCustomizations<
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S>,
> =
  | Readonly<{
      convert?: EnvSchemaCustomConverters<S, V>;
      parse?: EnvSchemaCustomParsers<S, V>;
      postValidate?: EnvSchemaCustomPostValidators<S, V>;
      serialize?: EnvSchemaCustomSerializers<S, V>;
    }>
  | undefined;

type EnvSchemaConvertedValue<
  S extends BaseEnvSchema,
  K extends KeyOf<S['properties']>,
  Convert,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
> = Convert extends EnvSchemaConvertFn<S, V, infer N> ? N : V[K];

type EnvSchemaConvertedValuesWithConvertInternal<
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
  Converters extends EnvSchemaCustomConverters<
    S,
    V
  > = EnvSchemaCustomConverters<S, V>,
> = {
  -readonly [K in KeyOf<S['properties']>]: EnvSchemaConvertedValue<
    S,
    K,
    Converters[K],
    V
  >;
};

export type EnvSchemaConverters<
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
  Customizations extends EnvSchemaCustomizations<
    S,
    V
  > = EnvSchemaCustomizations<S, V>,
> = Customizations extends { readonly convert: EnvSchemaCustomConverters<S, V> }
  ? Customizations['convert']
  : undefined;

export type EnvSchemaConvertedPartialValuesWithConvert<
  S extends BaseEnvSchema,
  Converters,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
> = Partial<
  Converters extends EnvSchemaCustomConverters<S, V>
    ? EnvSchemaConvertedValuesWithConvertInternal<S, V, Converters>
    : V
>;

/**
 * Subset of converted properties. If there are no
 * errors, then all required properties should be present.
 */
export type EnvSchemaConvertedPartialValues<
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
  Customizations extends EnvSchemaCustomizations<
    S,
    V
  > = EnvSchemaCustomizations<S, V>,
> = EnvSchemaConvertedPartialValuesWithConvert<
  S,
  EnvSchemaConverters<S, V, Customizations>,
  V
>;

type EnvSchemaConvertedValuesWithConvert<
  S extends BaseEnvSchema,
  Converters,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
> = Converters extends EnvSchemaCustomConverters<S, V>
  ? EnvSchemaConvertedValuesWithConvertInternal<S, V, Converters>
  : V;

/**
 * All converted properties. It assumes there
 * were no errors, every property was validated,
 * converted and the required are present.
 */
export type EnvSchemaConvertedValues<
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
  Customizations extends EnvSchemaCustomizations<
    S,
    V
  > = EnvSchemaCustomizations<S, V>,
> = EnvSchemaConvertedValuesWithConvert<
  S,
  EnvSchemaConverters<S, V, Customizations>,
  V
>;
