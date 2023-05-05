import type {
  TypeFromJSONSchema,
  JSONSchema7,
  JSONSchema7Definition,
} from '@profusion/json-schema-to-typescript-definitions';

export type BaseEnvSchema = {
  type: 'object';
  properties: Readonly<{ [key: string]: JSONSchema7 }>;
  required?: readonly string[];
  dependencies?: {
    readonly [key: string]: JSONSchema7Definition | readonly string[];
  };
  additionalProperties?: true; // if provided, must be true, otherwise it may hurt process.env
};

export type EnvSchemaProperties<S extends BaseEnvSchema> = {
  [K in Extract<keyof S['properties'], string>]: [K, S['properties'][K]];
}[Extract<keyof S['properties'], string>][];

export const schemaProperties = <S extends BaseEnvSchema>(
  schema: S,
): Readonly<EnvSchemaProperties<S>> =>
  Object.entries(schema.properties) as EnvSchemaProperties<S>;

/**
 * Subset of valid (post-validate) properties. If there are no
 * errors, then all required properties should be present.
 */
export type EnvSchemaPartialValues<S extends BaseEnvSchema> = Partial<
  TypeFromJSONSchema<S>
>;

export type EnvSchemaPropertyValue<
  S extends BaseEnvSchema,
  K extends keyof S['properties'],
> = K extends keyof TypeFromJSONSchema<S> ? TypeFromJSONSchema<S>[K] : never;

/**
 * Errors are stored per-property/variable, if something
 * else will be stored in $other.
 *
 * Multiple phases may produce errors, then it's stored as array.
 */
export type EnvSchemaErrors<S extends BaseEnvSchema> = Partial<{
  [K in keyof S['properties'] | '$other']: Error[];
}>;
export type EnvSchemaMaybeErrors<S extends BaseEnvSchema> =
  | EnvSchemaErrors<S>
  | undefined;

/**
 * Parse one property from string to the best JSONSchema7Type.
 *
 * There is no need to coerce types as Ajv.validate() will do that
 * for you.
 */
export type EnvSchemaParserFn<
  S extends BaseEnvSchema,
  K extends keyof S['properties'],
> = (
  str: string,
  propertySchema: Readonly<S['properties'][K]>,
  key: K,
  schema: Readonly<S>,
) => EnvSchemaPropertyValue<S, K>;

/**
 * Customize the parser to be used for each property.
 *
 * If not provided, the default is to `JSON.parse()` and, if that fails,
 * keep the original value as a string.
 */
export type EnvSchemaCustomParsers<S extends BaseEnvSchema> = Readonly<
  Partial<{
    [K in keyof S['properties']]: EnvSchemaParserFn<S, K>;
  }>
>;

/**
 * Serialize one property from validated JSONSchema7Type to string.
 *
 * The types will be validated by Ajv.validate()
 */
export type EnvSchemaSerializeFn<
  S extends BaseEnvSchema,
  K extends keyof S['properties'],
> = (
  value: Exclude<EnvSchemaPropertyValue<S, K>, undefined>,
  propertySchema: Readonly<S['properties'][K]>,
  key: K,
  schema: Readonly<S>,
) => string;

/**
 * Customize the parser to be used for each property.
 *
 * If not provided, the default is to `JSON.stringify()`,
 * unless it's already a string.
 */
export type EnvSchemaCustomSerializers<S extends BaseEnvSchema> = Readonly<
  Partial<{
    [K in keyof S['properties']]: EnvSchemaSerializeFn<S, K>;
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
  K extends keyof S['properties'],
> = (
  value: EnvSchemaPropertyValue<S, K> | undefined,
  propertySchema: S['properties'][K],
  key: K,
  schema: Readonly<S>,
  allValues: EnvSchemaPartialValues<S>,
  errors: Readonly<EnvSchemaMaybeErrors<S>>,
) => EnvSchemaPropertyValue<S, K> | undefined;

/**
 * Customize the validator to be executed for each property,
 * **AFTER** `Ajv.validate()` is executed.
 *
 * Each validator will receive the other properties for convenience.
 */
export type EnvSchemaCustomPostValidators<S extends BaseEnvSchema> = Readonly<
  Partial<{
    [K in keyof S['properties']]: EnvSchemaPostValidateFn<S, K>;
  }>
>;

/**
 * Convert JSONSchema7Type to high-level values, such as 'Date'.
 *
 * This is executed with the post-Validated data.
 */
export type EnvSchemaConvertFn<
  S extends BaseEnvSchema,
  K extends keyof S['properties'],
  R,
> = (
  value: EnvSchemaPropertyValue<S, K> | undefined,
  propertySchema: S['properties'][K],
  key: K,
  schema: Readonly<S>,
  allValues: EnvSchemaPartialValues<S>,
  errors: Readonly<EnvSchemaMaybeErrors<S>>,
) => R;

/**
 * Each converter will receive the other properties for convenience.
 *
 * If not provided, the value will be kept as the post-validated
 * JSONSchema7Type that matches the type (TypeFromJSONSchema),
 * otherwise it may be converted to high-level type, such as `Date`.
 */
export type EnvSchemaCustomConverters<S extends BaseEnvSchema> = Readonly<
  Partial<{
    // we must match any return type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [K in keyof S['properties']]: EnvSchemaConvertFn<S, K, any>;
  }>
>;

/**
 * Customizations, in order of execution:
 * - parse the value from string
 * - post-validate (after `Ajv.validate()`) the parsed value
 * - serialize the post-validated value back to string
 * - convert the JSON type to native type (ie: `Date`)
 */
export type EnvSchemaCustomizations<S extends BaseEnvSchema> =
  | Readonly<{
      convert?: EnvSchemaCustomConverters<S>;
      parse?: EnvSchemaCustomParsers<S>;
      postValidate?: EnvSchemaCustomPostValidators<S>;
      serialize?: EnvSchemaCustomSerializers<S>;
    }>
  | undefined;

type EnvSchemaConvertedValue<
  S extends BaseEnvSchema,
  K extends keyof S['properties'],
  Convert,
> = Convert extends EnvSchemaConvertFn<S, K, infer N>
  ? N
  : K extends keyof TypeFromJSONSchema<S>
  ? TypeFromJSONSchema<S>[K]
  : never;

type EnvSchemaConvertedValuesWithConvertInternal<
  S extends BaseEnvSchema,
  Converters extends EnvSchemaCustomConverters<S>,
> = {
  -readonly [K in keyof S['properties']]: EnvSchemaConvertedValue<
    S,
    K,
    Converters[K]
  >;
};

export type EnvSchemaConverters<
  S extends BaseEnvSchema,
  Customizations extends EnvSchemaCustomizations<S>,
> = Customizations extends { readonly convert: EnvSchemaCustomConverters<S> }
  ? Customizations['convert']
  : undefined;

export type EnvSchemaConvertedPartialValuesWithConvert<
  S extends BaseEnvSchema,
  Converters extends EnvSchemaCustomConverters<S> | undefined,
> = Converters extends EnvSchemaCustomConverters<S>
  ? Partial<EnvSchemaConvertedValuesWithConvertInternal<S, Converters>>
  : EnvSchemaPartialValues<S>;

/**
 * Subset of converted properties. If there are no
 * errors, then all required properties should be present.
 */
export type EnvSchemaConvertedPartialValues<
  S extends BaseEnvSchema,
  Customizations extends EnvSchemaCustomizations<S>,
> = EnvSchemaConvertedPartialValuesWithConvert<
  S,
  EnvSchemaConverters<S, Customizations>
>;

export type EnvSchemaConvertedValuesWithConvert<
  S extends BaseEnvSchema,
  Converters extends EnvSchemaCustomConverters<S> | undefined,
> = Converters extends EnvSchemaCustomConverters<S>
  ? EnvSchemaConvertedValuesWithConvertInternal<S, Converters>
  : TypeFromJSONSchema<S>;

/**
 * All converted properties. It assumes there
 * were no errors, every property was validated,
 * converted and the required are present.
 */
export type EnvSchemaConvertedValues<
  S extends BaseEnvSchema,
  Customizations extends EnvSchemaCustomizations<S>,
> = EnvSchemaConvertedValuesWithConvert<
  S,
  EnvSchemaConverters<S, Customizations>
>;
