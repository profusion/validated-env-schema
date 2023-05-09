import type {
  JSONSchema7Definition,
  JSONSchema7Type,
  TypeFromJSONSchema,
} from '@profusion/json-schema-to-typescript-definitions';

import dbg from './dbg';

import {
  BaseEnvParsed,
  EnvSchemaMaybeErrors,
  EnvSchemaProperties,
} from './types';
import type {
  BaseEnvSchema,
  EnvSchemaCustomParsers,
  EnvSchemaParserFn,
} from './types';
import { addErrors, assertIsError } from './errors';

// NOTE: this is only basic parsing, Ajv will handle coercion
// such as string to boolean, numbers...
const defaultParser = (
  str: string,
  _propertySchema: JSONSchema7Definition,
): JSONSchema7Type => {
  try {
    return JSON.parse(str);
  } catch (e) {
    return str;
  }
};

// Do its best to parse values, however Ajv will handle most
// of the specific conversions itself during validate()
// DO NOT THROW HERE!
type EnvSchemaParse<S extends BaseEnvSchema, V extends BaseEnvParsed<S>> = (
  container: Readonly<Record<string, string | undefined>>,
) => [Partial<V>, EnvSchemaMaybeErrors<S>];

export default <
    S extends BaseEnvSchema,
    V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
  >(
    schema: Readonly<S>,
    properties: Readonly<EnvSchemaProperties<S, V>>,
    customize: EnvSchemaCustomParsers<S, V> | undefined,
  ): EnvSchemaParse<S, V> =>
  (
    container: Readonly<Record<string, string | undefined>>,
  ): [Partial<V>, EnvSchemaMaybeErrors<S>] =>
    properties.reduce<[Partial<V>, EnvSchemaMaybeErrors<S>]>(
      (
        [values, initialErrors],
        [key, propertySchema],
      ): [Partial<V>, EnvSchemaMaybeErrors<S>] => {
        const containerKey = container[key];
        let errors = initialErrors;
        if (typeof containerKey === 'string') {
          const parser = (customize?.[key] ||
            defaultParser) as EnvSchemaParserFn<S, V>;
          try {
            // eslint-disable-next-line no-param-reassign
            values[key] = parser(containerKey, propertySchema, key, schema);
          } catch (e) {
            dbg(`failed to parse "${key}": ${e}`, e);
            assertIsError(e);
            errors = addErrors(errors, key, e);
          }
        }
        return [values, errors];
      },
      [{}, undefined],
    );
