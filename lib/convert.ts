import type {
  BaseEnvSchema,
  EnvSchemaConvertedPartialValues,
  EnvSchemaConvertedPartialValuesWithConvert,
  EnvSchemaCustomConverters,
  EnvSchemaMaybeErrors,
  EnvSchemaProperties,
  EnvSchemaPropertyValue,
  EnvSchemaPartialValues,
} from './types';

import { addErrors } from './errors';
import dbg from './dbg';

// DO NOT THROW HERE!
type EnvSchemaConvert<
  S extends BaseEnvSchema,
  Converters extends EnvSchemaCustomConverters<S> | undefined,
> = (
  value: EnvSchemaPartialValues<S>,
  errors: EnvSchemaMaybeErrors<S>,
  container: Record<string, string | undefined>,
) => [
  EnvSchemaConvertedPartialValuesWithConvert<S, Converters>,
  EnvSchemaMaybeErrors<S>,
];

const noRequiredProperties: string[] = [];

const createConvert = <
  S extends BaseEnvSchema,
  Converters extends EnvSchemaCustomConverters<S>,
>(
  schema: S,
  properties: Readonly<EnvSchemaProperties<S>>,
  customize: Converters,
): EnvSchemaConvert<S, Converters> => {
  const convertedProperties = properties.filter(
    ([key]) => customize[key] !== undefined,
  );

  type ConverterKey = Extract<keyof Converters, string>;
  const requiredProperties: readonly ConverterKey[] = schema.required
    ? (schema.required.filter(
        key => customize[key] !== undefined,
      ) as ConverterKey[])
    : (noRequiredProperties as ConverterKey[]);

  return (
    initialValues: EnvSchemaPartialValues<S>,
    initialErrors: EnvSchemaMaybeErrors<S>,
    container: Record<string, string | undefined>,
  ): [
    EnvSchemaConvertedPartialValuesWithConvert<S, Converters>,
    EnvSchemaMaybeErrors<S>,
  ] => {
    // alias the same object with a different type, save on casts
    const values = initialValues as EnvSchemaConvertedPartialValuesWithConvert<
      S,
      Converters
    >;
    let errors = initialErrors;

    const removeValue = (key: ConverterKey): void => {
      delete values[key];
      // eslint-disable-next-line no-param-reassign
      delete container[key];
    };

    convertedProperties.forEach(([key, propertySchema]) => {
      type K = typeof key;
      // it was filtered before
      const convert = customize[key] as Exclude<Converters[K], undefined>;
      const oldValue = values[key];
      try {
        const newValue = convert(
          values[key] as EnvSchemaPropertyValue<S, K> | undefined,
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
          key as Extract<keyof S['properties'], string>,
          new Error(`required property "${key}" is undefined`),
        );
      }
    });

    return [values, errors];
  };
};

const noConversion = <S extends BaseEnvSchema>(
  values: EnvSchemaPartialValues<S>,
  errors: EnvSchemaMaybeErrors<S>,
): [EnvSchemaConvertedPartialValues<S, undefined>, EnvSchemaMaybeErrors<S>] => [
  values as EnvSchemaConvertedPartialValues<S, undefined>,
  errors,
];

export default <
  S extends BaseEnvSchema,
  Converters extends EnvSchemaCustomConverters<S> | undefined,
>(
  schema: Readonly<S>,
  properties: Readonly<EnvSchemaProperties<S>>,
  customize: Converters,
): EnvSchemaConvert<S, Converters> =>
  customize === undefined
    ? (noConversion as unknown as EnvSchemaConvert<S, Converters>)
    : createConvert(
        schema,
        properties,
        customize as Exclude<Converters, undefined>,
      );
