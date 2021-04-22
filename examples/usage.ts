/* eslint-disable no-console */
import {
  commonSchemas,
  schemaHelpers,
} from '@profusion/json-schema-to-typescript-definitions';

import validateEnvVars, {
  EnvSchemaValidationError,
  commonConvert,
} from '../lib'; // or '@profusion/validated-env-schema'

// NOTE: the schemas below use string formats provided by
// the peer-package ajv-formats. It's not installed as a dependency,
// them make sure you: 'yarn add ajv-formats' in your project!
const appVars = {
  properties: {
    AUTH_TOKEN: {
      $comment: 'authorization token to connect to remote server',
      ...commonSchemas.nonEmptyString,
    },
    BIND_HOST: {
      $comment: 'hostname to bind server',
      default: 'localhost',
      ...commonSchemas.ipOrHostname,
    },
    BIND_PORT: {
      $comment: 'port number to bind',
      default: 8080,
      ...commonSchemas.integerPositive,
    },
    COMPLEX_CONFIG: {
      $comment: 'some JSON object value',
      default: { key: 123 },
      ...schemaHelpers.object({
        additionalProperties: false,
        properties: {
          key: commonSchemas.number,
        },
      }),
    },
    OPTIONAL_WITHOUT_DEFAULT: {
      $comment: 'optional variable without a default value',
      ...commonSchemas.number,
    },
    REMOTE_URL: {
      $comment: 'server to connect to',
      default: 'https://jsonplaceholder.typicode.com/todos/',
      ...commonSchemas.uri,
    },
    VALID_UNTIL: {
      $comment: 'some date and time example',
      default: new Date(Date.now() + 1000 * 60).toISOString(),
      ...commonSchemas.dateTime,
    },
  },
  required: [
    'AUTH_TOKEN',
    'BIND_HOST',
    'BIND_PORT',
    'COMPLEX_CONFIG',
    'REMOTE_URL',
    'VALID_UNTIL',
  ],
  type: 'object',
} as const; // is important to get all strings as literals!
const customize = {
  convert: {
    VALID_UNTIL: commonConvert.dateTime,
  },
} as const;

try {
  // validate from process.env, values are sanitized
  const vars = validateEnvVars(appVars, process.env, customize);
  console.log('parsed variables from process.env:', vars);

  // vars.BIND_HOST is of type string, inferred from schema: { type: 'string' }
  console.log('BIND_HOST:', vars.BIND_HOST);

  // vars.BIND_PORT is of type number, inferred from schema: { type: 'number' }
  console.log('BIND_PORT:', vars.BIND_PORT);

  // vars.COMPLEX_CONFIG is of proper object type, also inferred from schema!
  // { readonly key: number | undefined }
  console.log('COMPLEX_CONFIG.key:', vars.COMPLEX_CONFIG.key);

  // vars.OPTIONAL_WITHOUT_DEFAULT will be number | undefined, because it's optional
  console.log('OPTIONAL_WITHOUT_DEFAULT:', vars.OPTIONAL_WITHOUT_DEFAULT);

  // vars.REMOTE_URL is also string, since URI is just a string format:
  console.log('REMOTE_URL:', vars.REMOTE_URL);

  // vars.VALID_UNTIL is of type Date, inferred from convert's return type
  console.log('VALID_UNTIL:', vars.VALID_UNTIL);
} catch (error) {
  // on errors (ie: missing AUTH_TOKEN, invalid BIND_PORT...)
  console.error('Failed to validate process.env variables:', error);

  if (error instanceof EnvSchemaValidationError) {
    const e: EnvSchemaValidationError<typeof appVars, typeof customize> = error;
    // if you want to proceed anyway, the partial result is stored at:
    console.log('partial result:', e.values);
    console.log('errors:', JSON.stringify(e.errors, undefined, 2));
  }
}

// you can also validate any object with it instead of process.env
console.log(
  'another container (not `process.env`):',
  validateEnvVars(
    appVars,
    {
      AUTH_TOKEN: 'AUTH_TOKEN',
      BIND_HOST: '127.0.0.1',
      BIND_PORT: '22',
      COMPLEX_CONFIG: '{"key": 42}',
      OPTIONAL_WITHOUT_DEFAULT: '4142',
      REMOTE_URL: 'ftp://server.com',
      VALID_UNTIL: '2021-01-02T12:34:56Z',
    },
    customize,
  ),
);
