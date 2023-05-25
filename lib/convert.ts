import type { TypeFromJSONSchema } from '@profusion/json-schema-to-typescript-definitions';

import type {
  BaseEnvParsed,
  BaseEnvSchema,
  EnvSchemaConvertedPartialValues,
  EnvSchemaConvertedPartialValuesWithConvert,
  EnvSchemaCustomConverters,
  EnvSchemaMaybeErrors,
  EnvSchemaProperties,
  KeyOf,
} from './types';

import { addErrors } from './errors';
import dbg from './dbg';

// DO NOT THROW HERE!
type EnvSchemaConvert<
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
  Converters extends EnvSchemaCustomConverters<S, V> | undefined = undefined,
> = (
  value: Partial<V>,
  errors: EnvSchemaMaybeErrors<S>,
  container: Record<string, string | undefined>,
) => [
  EnvSchemaConvertedPartialValuesWithConvert<S, Converters, V>,
  EnvSchemaMaybeErrors<S>,
];

const noRequiredProperties: string[] = [];

const createConvert = <
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
  Converters extends EnvSchemaCustomConverters<
    S,
    V
  > = EnvSchemaCustomConverters<S, V>,
>(
  schema: S,
  properties: Readonly<EnvSchemaProperties<S>>,
  customize: Converters,
): EnvSchemaConvert<S, V, Converters> => {
  const convertedProperties = properties.filter(
    ([key]) => customize[key] !== undefined,
  );

  type ConverterKey = KeyOf<Converters>;
  const requiredProperties = schema.required
    ? schema.required.filter(key => customize[key] !== undefined)
    : noRequiredProperties;

  return (
    initialValues: Partial<V>,
    initialErrors: EnvSchemaMaybeErrors<S>,
    container: Record<string, string | undefined>,
  ): [
    EnvSchemaConvertedPartialValuesWithConvert<S, Converters, V>,
    EnvSchemaMaybeErrors<S>,
  ] => {
    // alias the same object with a different type, save on casts
    const values = initialValues;
    let errors = initialErrors;

    const removeValue = (key: ConverterKey): void => {
      delete values[key];
      // eslint-disable-next-line no-param-reassign
      delete container[key];
    };

    convertedProperties.forEach(([key, propertySchema]) => {
      // it was filtered before
      const convert = customize[key] as NonNullable<
        (typeof customize)[typeof key]
      >;
      const oldValue = values[key];
      try {
        const newValue = convert(
          values[key],
          propertySchema,
          key,
          schema,
          initialValues,
          errors,
        );
        if (oldValue !== newValue) {
          if (newValue === undefined) {
            dbg(
              () =>
                `Conversion of "${key}" removed property. Was ${JSON.stringify(
                  oldValue,
                )}`,
            );
            removeValue(key);
          } else {
            dbg(
              () =>
                `\
Conversion of "${key}" changed property from:
Previous Value: ${JSON.stringify(oldValue)}
New Value.....: ${newValue}
`,
            );
            // eslint-disable-next-line no-param-reassign
            values[key] = newValue;
          }
        }
      } catch (e) {
        dbg(
          () =>
            `Conversion of "${key}" did throw ${e}. Remove property. Was ${JSON.stringify(
              oldValue,
            )}`,
        );
        removeValue(key);
        errors = addErrors(errors, key, e as Error);
      }
    });
    requiredProperties.forEach(key => {
      if (values[key] === undefined) {
        errors = addErrors(
          errors,
          key,
          new Error(`required property "${key}" is undefined`),
        );
      }
    });

    return [
      values as EnvSchemaConvertedPartialValuesWithConvert<S, Converters, V>,
      errors,
    ];
  };
};

const noConversion = <
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
>(
  values: Partial<V>,
  errors: EnvSchemaMaybeErrors<S>,
): [EnvSchemaConvertedPartialValues<S, never, V>, EnvSchemaMaybeErrors<S>] => [
  values as EnvSchemaConvertedPartialValues<S, never, V>,
  errors,
];

export default <
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
  Converters extends EnvSchemaCustomConverters<S, V> | undefined = undefined,
>(
  schema: Readonly<S>,
  properties: Readonly<EnvSchemaProperties<S>>,
  customize: Converters,
): EnvSchemaConvert<S, V, Converters> =>
  customize === undefined
    ? (noConversion as unknown as EnvSchemaConvert<S, V, Converters>)
    : createConvert<S, V, typeof customize>(schema, properties, customize);
