import type {
  BaseEnvSchema,
  EnvSchemaConvertedValues,
  EnvSchemaConverters,
  EnvSchemaCustomizations,
} from './types';

import { schemaProperties } from './types';
import { EnvSchemaValidationError } from './errors';

import createConvert from './convert';
import createParse from './parse';
import createSerialize from './serialize';
import createValidate from './validate';

import providedConverters from './common-convert';

export { EnvSchemaValidationError } from './errors';
export type {
  EnvSchemaMaybeErrors as EnvSchemaErrors,
  EnvSchemaParserFn,
  EnvSchemaSerializeFn,
  EnvSchemaPostValidateFn,
  EnvSchemaConvertFn,
} from './types';

export const commonConvert = providedConverters;

type ValidateEnvSchema<
  S extends BaseEnvSchema,
  Customizations extends EnvSchemaCustomizations<S>,
> = (
  container: Record<string, string | undefined>,
) => EnvSchemaConvertedValues<S, Customizations>;

/**
 * Creates the validator based on JSON Schema 7 and customizations.
 *
 * @param schema a valid `JSONSchema7` describing an object,
 *        where each variable should be an object property.
 *        Required properties can be specified using `required`
 *        member.
 *
 * @param customize customizes how the container will be
 *        parsed and serialized, as well as post-Ajv.validate()
 *        for custom logic. It can also handle conversion from
 *        basic JSON types to native types (ie: `Date`).
 *
 * @returns the validator, see `validateEnvSchema()` for more details.
 *
 * @see validateEnvSchema() for convenience create + execute,
 *      as well as more details on the execution.
 */
export const createValidateEnvSchema = <
  S extends BaseEnvSchema,
  Customizations extends EnvSchemaCustomizations<S>,
>(
  schema: S,
  customize?: Customizations,
): ValidateEnvSchema<S, Customizations> => {
  const properties = schemaProperties(schema);
  const parse = createParse(schema, properties, customize?.parse);
  const validate = createValidate(schema, properties, customize?.postValidate);
  const serialize = createSerialize(schema, properties, customize?.serialize);
  const convert = createConvert<S, EnvSchemaConverters<S, Customizations>>(
    schema,
    properties,
    customize?.convert as EnvSchemaConverters<S, Customizations>,
  );
  return (
    container: Record<string, string | undefined>,
  ): EnvSchemaConvertedValues<S, Customizations> => {
    const [parsedValues, parseErrors] = parse(container);

    const [validatedValues, validationErrors] = validate(
      parsedValues,
      parseErrors,
    );

    const [_, serializeErrors] = serialize(
      validatedValues,
      container,
      validationErrors,
    );

    const [values, errors] = convert(
      validatedValues,
      serializeErrors,
      container,
    );

    if (errors) {
      throw new EnvSchemaValidationError(
        schema,
        customize,
        errors,
        container,
        values,
      );
    }

    // no errors means the partial object is actually complete
    return values as EnvSchemaConvertedValues<S, Customizations>;
  };
};

/**
 * Convenience that creates the validator and executes it.
 *
 * @param schema a valid `JSONSchema7` describing an object,
 *        where each variable should be an object property.
 *        Required properties can be specified using `required`
 *        member.
 *
 * @param container the container to be validated, defaults to
 *        `process.env`.
 *
 * @param customize customizes how the container will be
 *        parsed and serialized, as well as post-Ajv.validate()
 *        for custom logic. It can also handle conversion from
 *        basic JSON types to native types (ie: `Date`).
 *
 * @returns the object matching the described schema. The
 *          type is inferred from `JSONSchema7` using
 *          `TypeFromJSONSchema` from package
 *          @profusion/json-schema-to-typescript-definitions
 *          and can be overridden with `customize.convert`.
 *          On errors, including missing required properties,
 *          the error `EnvSchemaValidationError` is thrown.
 *
 * @throws EnvSchemaValidationError
 *
 * @see createValidateEnvSchema() if the validator is going to
 *      be reused multiple times.
 */
export const validateEnvSchema = <
  S extends BaseEnvSchema,
  Customizations extends EnvSchemaCustomizations<S>,
>(
  schema: S,
  container: Record<string, string | undefined> = process.env,
  customize?: Customizations,
): EnvSchemaConvertedValues<S, Customizations> =>
  createValidateEnvSchema(schema, customize)(container);

export default validateEnvSchema;
