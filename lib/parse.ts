import type {
  JSONSchema7Definition,
  JSONSchema7Type,
} from '@profusion/json-schema-to-typescript-definitions';

import dbg from './dbg';

import { EnvSchemaMaybeErrors, EnvSchemaProperties } from './types';
import type {
  BaseEnvSchema,
  EnvSchemaCustomParsers,
  EnvSchemaParserFn,
  EnvSchemaPartialValues,
} from './types';
import { addErrors } from './errors';

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
type EnvSchemaParse<S extends BaseEnvSchema> = (
  container: Readonly<Record<string, string | undefined>>,
) => [EnvSchemaPartialValues<S>, EnvSchemaMaybeErrors<S>];

export default <S extends BaseEnvSchema>(
  schema: Readonly<S>,
  properties: Readonly<EnvSchemaProperties<S>>,
  customize: EnvSchemaCustomParsers<S> | undefined,
): EnvSchemaParse<S> => (
  container: Readonly<Record<string, string | undefined>>,
): [EnvSchemaPartialValues<S>, EnvSchemaMaybeErrors<S>] =>
  properties.reduce(
    (
      [values, initialErrors],
      [key, propertySchema],
    ): [EnvSchemaPartialValues<S>, EnvSchemaMaybeErrors<S>] => {
      type K = typeof key;
      const str = container[key];
      let errors = initialErrors;
      if (typeof str === 'string') {
        const parser =
          // we already checked for not undefined, but TS doesn't get it :-(
          ((customize && customize[key]) as EnvSchemaParserFn<S, K>) ||
          ((defaultParser as unknown) as EnvSchemaParserFn<S, K>);
        try {
          const value = parser(str, propertySchema, key, schema);
          // eslint-disable-next-line no-param-reassign
          values[key] = value;
        } catch (e) {
          dbg(`failed to parse "${key}": ${e}`, e);
          errors = addErrors(errors, key, e);
        }
      }
      return [values, errors];
    },
    [{}, undefined] as [EnvSchemaPartialValues<S>, EnvSchemaMaybeErrors<S>],
  );
