import type {
  JSONSchema7Definition,
  TypeFromJSONSchema,
} from '@profusion/json-schema-to-typescript-definitions';

import {
  BaseEnvParsed,
  EnvSchemaProperties,
  EnvSchemaPropertyValue,
} from './types';
import type {
  BaseEnvSchema,
  EnvSchemaCustomSerializers,
  EnvSchemaMaybeErrors,
} from './types';
import dbg from './dbg';
import { addErrors, assertIsError } from './errors';

const defaultSerialize = (
  value: unknown,
  _propertySchema: JSONSchema7Definition,
): string => (typeof value === 'string' ? value : JSON.stringify(value)); // no double quotes

// Serialize the parsed and validated values back to container.
// DO NOT THROW HERE!
type EnvSchemaSerialize<
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
> = (
  values: Readonly<Partial<V>>,
  container: Record<string, string | undefined>,
  errors: EnvSchemaMaybeErrors<S>,
) => [Partial<V>, EnvSchemaMaybeErrors<S>];

export default <
    S extends Readonly<BaseEnvSchema>,
    V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
  >(
    schema: S,
    properties: Readonly<EnvSchemaProperties<S>>,
    customize: EnvSchemaCustomSerializers<S, V> | undefined,
  ): EnvSchemaSerialize<S, V> =>
  (
    givenValues: Readonly<Partial<V>>,
    container: Record<string, string | undefined>,
    givenErrors: EnvSchemaMaybeErrors<S>,
  ): [Partial<V>, EnvSchemaMaybeErrors<S>] =>
    properties.reduce(
      (
        [values, initialErrors],
        [key, propertySchema],
      ): [Partial<V>, EnvSchemaMaybeErrors<S>] => {
        const value: EnvSchemaPropertyValue<S, V> | undefined = values[key];
        let errors = initialErrors;
        if (value !== undefined) {
          const serialize = customize?.[key] || defaultSerialize;

          try {
            // eslint-disable-next-line no-param-reassign
            container[key] = serialize(value, propertySchema, key, schema);
          } catch (e) {
            dbg(`failed to serialize "${key}": ${e}`, e);
            // eslint-disable-next-line no-param-reassign
            delete container[key];
            assertIsError(e);
            errors = addErrors(errors, key, e);
          }
        } else {
          // eslint-disable-next-line no-param-reassign
          delete container[key];
        }
        return [values, errors];
      },
      [givenValues, givenErrors],
    );
