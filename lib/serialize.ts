import type {
  JSONSchema7Definition,
  JSONSchema7Type,
  TypeFromJSONSchema,
} from '@profusion/json-schema-to-typescript-definitions';

import { BaseEnvParsed, EnvSchemaProperties } from './types';
import type {
  BaseEnvSchema,
  EnvSchemaCustomSerializers,
  EnvSchemaSerializeFn,
  EnvSchemaMaybeErrors,
} from './types';
import dbg from './dbg';
import { addErrors, assertIsError } from './errors';

const defaultSerialize = (
  value: JSONSchema7Type,
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
    S extends BaseEnvSchema,
    V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
  >(
    schema: Readonly<S>,
    properties: Readonly<EnvSchemaProperties<S, V>>,
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
        const value = values[key];
        let errors = initialErrors;
        if (value !== undefined) {
          const serialize =
            // we already checked for not undefined, but TS doesn't get it :-(
            ((customize && customize[key]) as EnvSchemaSerializeFn<S, V>) ||
            defaultSerialize;

          try {
            // eslint-disable-next-line no-param-reassign
            container[key] = serialize(
              // we already checked for not undefined, but TS doesn't get it :-(
              value as Parameters<typeof serialize>[0],
              propertySchema,
              key,
              schema,
            );
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
