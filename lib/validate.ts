import Ajv, { ErrorObject } from 'ajv';

import type {
  BaseEnvSchema,
  EnvSchemaCustomPostValidators,
  EnvSchemaMaybeErrors,
  EnvSchemaPostValidateFn,
  EnvSchemaProperties,
  EnvSchemaPropertyValue,
  EnvSchemaPartialValues,
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

type ErrorIsModuleNotFoundException = (
  error: unknown,
) => asserts error is NodeJS.ErrnoException;

/* istanbul ignore next */
const assertErrorIsModuleNotFoundException: ErrorIsModuleNotFoundException =
  error => {
    if (!error || typeof error !== 'object' || !('code' in error)) throw error;
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
  };

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
type EnvSchemaValidate<S extends BaseEnvSchema> = (
  value: EnvSchemaPartialValues<S>,
  errors: EnvSchemaMaybeErrors<S>,
) => [EnvSchemaPartialValues<S>, EnvSchemaMaybeErrors<S>];

const createPostValidation = <S extends BaseEnvSchema>(
  schema: S,
  properties: Readonly<EnvSchemaProperties<S>>,
  customize: EnvSchemaCustomPostValidators<S>,
): EnvSchemaValidate<S> => {
  const postValidatedProperties = properties.filter(
    ([key]) => customize[key] !== undefined,
  );
  return (
    values: EnvSchemaPartialValues<S>,
    initialErrors: EnvSchemaMaybeErrors<S>,
  ): [EnvSchemaPartialValues<S>, EnvSchemaMaybeErrors<S>] => {
    let errors = initialErrors;
    postValidatedProperties.forEach(([key, propertySchema]) => {
      type K = typeof key;
      // it was filtered before
      const validate = customize[key] as EnvSchemaPostValidateFn<S, K>;
      const oldValue = values[key];
      try {
        const newValue = validate(
          oldValue as EnvSchemaPropertyValue<S, K> | undefined,
          propertySchema,
          key,
          schema,
          values,
          errors,
        );
        if (oldValue !== newValue) {
          if (newValue === undefined) {
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

const noPostValidation = <S extends BaseEnvSchema>(
  values: EnvSchemaPartialValues<S>,
  errors: EnvSchemaMaybeErrors<S>,
): [EnvSchemaPartialValues<S>, EnvSchemaMaybeErrors<S>] => [values, errors];

const createExceptionForAjvError = (ajvError: ErrorObject): Error =>
  new Ajv.ValidationError([ajvError]);

const processAjvTopLevelError = <S extends BaseEnvSchema>(
  schema: S,
  key: Extract<keyof S['properties'], string>,
  _path: string[],
  values: EnvSchemaPartialValues<S>,
  ajvError: ErrorObject,
): void => {
  const defVal = schema.properties[key].default;
  if (defVal !== undefined) {
    dbg(
      () =>
        `Ajv failed the validation of "${key}": ${ajv.errorsText([
          ajvError,
        ])}. Use default ${JSON.stringify(defVal)}. Was ${JSON.stringify(
          values[key],
        )}`,
    );
    // eslint-disable-next-line no-param-reassign
    values[key] = defVal as EnvSchemaPropertyValue<S, typeof key>;
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

const processSingleAjvError = <S extends BaseEnvSchema>(
  schema: S,
  key: Extract<keyof S['properties'], string>,
  path: string[],
  values: EnvSchemaPartialValues<S>,
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

const processAjvErrors = <S extends BaseEnvSchema>(
  schema: Readonly<S>,
  schemaKeys: Readonly<Set<Extract<keyof S['properties'], string>>>,
  values: EnvSchemaPartialValues<S>,
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
        const key = path[0] as Extract<keyof S['properties'], string>;
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

export default <S extends BaseEnvSchema>(
  schema: Readonly<S>,
  properties: Readonly<EnvSchemaProperties<S>>,
  customize: EnvSchemaCustomPostValidators<S> | undefined,
): EnvSchemaValidate<S> => {
  const validate = ajv.compile(schema);
  const postValidate =
    customize === undefined
      ? noPostValidation
      : createPostValidation(schema, properties, customize);
  const schemaKeys = new Set(properties.map(([key]) => key));
  return (
    values: EnvSchemaPartialValues<S>,
    initialErrors: EnvSchemaMaybeErrors<S>,
  ): [EnvSchemaPartialValues<S>, EnvSchemaMaybeErrors<S>] => {
    let errors = initialErrors;
    if (!validate(values)) {
      /* istanbul ignore else */
      if (validate.errors && validate.errors.length > 0) {
        errors = processAjvErrors(schema, schemaKeys, values, validate.errors);
      }
    }
    return postValidate(values, errors);
  };
};
