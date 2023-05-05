import type { TypeFromJSONSchema } from '@profusion/json-schema-to-typescript-definitions';

import type {
  BaseEnvSchema,
  EnvSchemaConvertedPartialValues,
  EnvSchemaCustomizations,
  EnvSchemaMaybeErrors,
  EnvSchemaErrors,
  BaseEnvParsed,
  KeyOf,
} from './types';

/* istanbul ignore next */
export const assertIsError: (e: unknown) => asserts e is Error = e => {
  if (!(e instanceof Error)) throw e;
};

export const addErrors = <S extends BaseEnvSchema>(
  initialErrors: EnvSchemaMaybeErrors<S>,
  key: KeyOf<S['properties']> | '$other',
  exception: Error,
): EnvSchemaErrors<S> => {
  const errors: EnvSchemaErrors<S> = initialErrors ?? {};
  const keyErrors = errors[key] ?? [];
  if (!keyErrors.length) {
    errors[key] = keyErrors;
  }
  keyErrors.push(exception);
  return errors;
};

/**
 * Reports validation errors
 *
 * For convenience the values will be throw only
 * after all errors are collected, then all variables
 * will be parsed, validated, serialized and converted.
 *
 * All errors will be collected and will carry the values
 * properly parsed, the validated container, schema and
 * the mapping of errors.
 */
export class EnvSchemaValidationError<
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
  Customizations extends EnvSchemaCustomizations<
    S,
    V
  > = EnvSchemaCustomizations<S, V>,
> extends Error {
  readonly schema: S;

  values: EnvSchemaConvertedPartialValues<S, V, Customizations>;

  errors: EnvSchemaErrors<S>;

  container: Record<string, string | undefined>;

  customize: Customizations;

  constructor(
    schema: S,
    customize: Customizations,
    errors: EnvSchemaErrors<S>,
    container: Record<string, string | undefined>,
    values: EnvSchemaConvertedPartialValues<S, V, Customizations>,
  ) {
    const names = Object.keys(errors).join(', ');
    super(`Failed to validate environment variables against schema: ${names}`);
    this.schema = schema;
    this.values = values;
    this.errors = errors;
    this.container = container;
    this.customize = customize;
  }
}
