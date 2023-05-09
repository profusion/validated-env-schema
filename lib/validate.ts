import Ajv, { ErrorObject } from 'ajv';
import type { TypeFromJSONSchema } from '@profusion/json-schema-to-typescript-definitions';

import type {
  BaseEnvParsed,
  BaseEnvSchema,
  EnvSchemaCustomPostValidators,
  EnvSchemaMaybeErrors,
  EnvSchemaProperties,
  KeyOf,
} from './types';

import { addErrors, assertIsError } from './errors';
import dbg, { isDebugEnabled } from './dbg';

export const ajv = new Ajv({
  allErrors: true,
  coerceTypes: true,
  removeAdditional: true,
  useDefaults: true,
  verbose: isDebugEnabled,
});

/* istanbul ignore next */
const assertErrorIsModuleNotFoundException: (
  error: unknown,
) => asserts error is NodeJS.ErrnoException = error => {
  if (!error || typeof error !== 'object' || !('code' in error)) throw error;
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
};

/* istanbul ignore next */
try {
  // ajv-formats is a peer dependency, it's slightly heavy and eventually unused
  // eslint-disable-next-line import/no-unresolved, @typescript-eslint/no-var-requires
  require('ajv-formats')(ajv);
} catch (error) {
  assertErrorIsModuleNotFoundException(error);
  dbg(
    'ajv-formats module is not installed, JSON Schema string formats will not be supported.',
  );
}

// DO NOT THROW HERE!
type EnvSchemaValidate<
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
> = (
  value: Partial<V>,
  errors: EnvSchemaMaybeErrors<S>,
) => [Partial<V>, EnvSchemaMaybeErrors<S>];

const createPostValidation = <
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
>(
  schema: S,
  properties: Readonly<EnvSchemaProperties<S, V>>,
  customize: EnvSchemaCustomPostValidators<S, V>,
): EnvSchemaValidate<S, V> => {
  const postValidatedProperties = properties.filter(
    ([key]) => customize[key] !== undefined,
  );
  return (
    values: Partial<V>,
    initialErrors: EnvSchemaMaybeErrors<S>,
  ): [Partial<V>, EnvSchemaMaybeErrors<S>] => {
    let errors = initialErrors;
    postValidatedProperties.forEach(([key, propertySchema]) => {
      // it was filtered before
      const validate = customize[key] as NonNullable<
        (typeof customize)[string]
      >;
      const oldValue = values[key];
      try {
        const newValue = validate(
          oldValue,
          propertySchema,
          key,
          schema,
          values,
          errors,
        );
        if (oldValue !== newValue && newValue === undefined) {
          dbg(
            () =>
              `Post validation of "${key}" removed property. Was ${JSON.stringify(
                oldValue,
              )}`,
          );
          // eslint-disable-next-line no-param-reassign
          delete values[key];
        } else {
          dbg(
            () =>
              `\
Post validation of "${key}" changed property from:
Previous Value: ${JSON.stringify(oldValue)}
New Value.....: ${JSON.stringify(newValue)}
`,
          );
          // eslint-disable-next-line no-param-reassign
          values[key] = newValue;
        }
      } catch (e) {
        dbg(
          () =>
            `Post validation of "${key}" did throw ${e}. Remove property. Was ${JSON.stringify(
              oldValue,
            )}`,
        );
        // eslint-disable-next-line no-param-reassign
        delete values[key];
        assertIsError(e);
        errors = addErrors(errors, key, e);
      }
    });
    return [values, errors];
  };
};

const noPostValidation = <
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
>(
  values: Partial<V>,
  errors: EnvSchemaMaybeErrors<S>,
): [Partial<V>, EnvSchemaMaybeErrors<S>] => [values, errors];

const createExceptionForAjvError = (ajvError: ErrorObject): Error =>
  new Ajv.ValidationError([ajvError]);

const processAjvTopLevelError = <
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
>(
  schema: S,
  key: KeyOf<V>,
  _path: string[],
  values: Partial<V>,
  ajvError: ErrorObject,
): void => {
  const defaultValue = schema.properties[key].default as V[KeyOf<V>];
  if (defaultValue) {
    dbg(
      () =>
        `Ajv failed the validation of "${key}": ${ajv.errorsText([
          ajvError,
        ])}. Use default ${JSON.stringify(defaultValue)}. Was ${JSON.stringify(
          values[key],
        )}`,
    );
    // eslint-disable-next-line no-param-reassign
    values[key] = defaultValue;
    return;
  }

  dbg(
    () =>
      `Ajv failed the validation of "${key}": ${ajv.errorsText([
        ajvError,
      ])}. Remove property. Was ${JSON.stringify(values[key])}`,
  );
  // eslint-disable-next-line no-param-reassign
  delete values[key];
};

// TODO: should we try to fixup the internal object?
// Problem is to handle all kinds of nesting:
// array, const, oneOf/allOf/anyOf/not...
const processAjvNestedError = processAjvTopLevelError;

const processSingleAjvError = <
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
>(
  schema: S,
  key: KeyOf<V>,
  path: string[],
  values: Partial<V>,
  ajvError: ErrorObject,
  errors: EnvSchemaMaybeErrors<S>,
): EnvSchemaMaybeErrors<S> => {
  if (path.length === 1) {
    processAjvTopLevelError(schema, key, path, values, ajvError);
  } else {
    processAjvNestedError(schema, key, path, values, ajvError);
  }
  return addErrors(errors, key, createExceptionForAjvError(ajvError));
};

/* istanbul ignore next */
const processSpuriousAjvError = <S extends BaseEnvSchema>(
  ajvError: ErrorObject,
  errors: EnvSchemaMaybeErrors<S>,
): EnvSchemaMaybeErrors<S> => {
  dbg(
    () =>
      `Ajv failed validation of spurious error: ${ajv.errorsText([ajvError])}`,
  );
  return addErrors(errors, '$other', createExceptionForAjvError(ajvError));
};

const processAjvErrors = <
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
>(
  schema: Readonly<S>,
  schemaKeys: Readonly<Set<KeyOf<V>>>,
  values: Partial<V>,
  ajvErrors: readonly ErrorObject[],
): EnvSchemaMaybeErrors<S> =>
  ajvErrors.reduce(
    (
      errors: EnvSchemaMaybeErrors<S>,
      ajvError: ErrorObject,
    ): EnvSchemaMaybeErrors<S> => {
      /* istanbul ignore else */
      if (ajvError.instancePath.startsWith('/')) {
        const path = ajvError.instancePath.substr(1).split('/');
        const key = path[0];
        /* istanbul ignore else */
        if (schemaKeys.has(key)) {
          return processSingleAjvError(
            schema,
            key,
            path,
            values,
            ajvError,
            errors,
          );
        }
      } else if (ajvError.keyword === 'required') {
        const { missingProperty } = ajvError.params;
        /* istanbul ignore else */
        if (schemaKeys.has(missingProperty)) {
          return processSingleAjvError(
            schema,
            missingProperty,
            [],
            values,
            ajvError,
            errors,
          );
        }
      }
      /* istanbul ignore next */
      return processSpuriousAjvError(ajvError, errors);
    },
    undefined,
  );

export default <
  S extends BaseEnvSchema,
  V extends BaseEnvParsed<S> = TypeFromJSONSchema<S>,
>(
  schema: Readonly<S>,
  properties: Readonly<EnvSchemaProperties<S, V>>,
  customize: EnvSchemaCustomPostValidators<S, V> | undefined,
): EnvSchemaValidate<S, V> => {
  const validate = ajv.compile(schema);
  const postValidate =
    customize === undefined
      ? noPostValidation
      : createPostValidation(schema, properties, customize);
  const schemaKeys = new Set(properties.map(([key]) => key));
  return (
    values: Partial<V>,
    initialErrors: EnvSchemaMaybeErrors<S>,
  ): [Partial<V>, EnvSchemaMaybeErrors<S>] => {
    let errors = initialErrors;
    if (!validate(values)) {
      /* istanbul ignore else */
      if (validate.errors && validate.errors.length > 0) {
        errors = processAjvErrors<S, V>(
          schema,
          schemaKeys,
          values,
          validate.errors,
        );
      }
    }
    return postValidate(values, errors);
  };
};
