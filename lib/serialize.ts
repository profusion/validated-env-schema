import type {
  JSONSchema7Definition,
  JSONSchema7Type,
} from '@profusion/json-schema-to-typescript-definitions';

import { EnvSchemaProperties } from './types';
import type {
  BaseEnvSchema,
  EnvSchemaCustomSerializers,
  EnvSchemaMaybeErrors,
  EnvSchemaPartialValues,
} from './types';
import dbg from './dbg';
import { addErrors, assertIsError } from './errors';

const defaultSerialize = (
  value: JSONSchema7Type,
  _propertySchema: JSONSchema7Definition,
): string => {
  if (typeof value === 'string') return value; // no double-quotes
  return JSON.stringify(value);
};

// Serialize the parsed and validated values back to container.
// DO NOT THROW HERE!
type EnvSchemaSerialize<S extends BaseEnvSchema> = (
  values: Readonly<EnvSchemaPartialValues<S>>,
  container: Record<string, string | undefined>,
  errors: EnvSchemaMaybeErrors<S>,
) => [EnvSchemaPartialValues<S>, EnvSchemaMaybeErrors<S>];

export default <S extends BaseEnvSchema>(
    schema: Readonly<S>,
    properties: Readonly<EnvSchemaProperties<S>>,
    customize: EnvSchemaCustomSerializers<S> | undefined,
  ): EnvSchemaSerialize<S> =>
  (
    givenValues: Readonly<EnvSchemaPartialValues<S>>,
    container: Record<string, string | undefined>,
    givenErrors: EnvSchemaMaybeErrors<S>,
  ): [EnvSchemaPartialValues<S>, EnvSchemaMaybeErrors<S>] =>
    properties.reduce(
      (
        [values, initialErrors],
        [key, propertySchema],
      ): [EnvSchemaPartialValues<S>, EnvSchemaMaybeErrors<S>] => {
        const value = values[key];
        let errors = initialErrors;
        if (value !== undefined) {
          const serialize = customize?.[key] || defaultSerialize;

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
