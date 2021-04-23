# Validated Environments using JSON Schema

This script eases the usage of environment variables in your
applications by using [Ajv](https://ajv.js.org/) in coerce mode.

It will take care to check the variable in various complex formats,
including arrays and objects, applying all of the
[JSON Schema](https://json-schema.org/understanding-json-schema/)
rules, which includes:
- required properties
- default values
- minimum and maximum elements in an array
- string patterns

The sanitized values are serialized to strings and are written back to
the variable, while the invalid variables are deleted. One can trust
only valid variables exist after the process finishes.

The parse, serialize and post-validate of properties can be customized,
this allows non-JSON encoding to be supported (such as comma-separated
lists, booleans using 'y/n', etc).

The resulting object will have TypeScript signature based on the
JSON schema, so `prop: { type: 'number' }` results in `prop: number`.

JSON types can be converted to high-level types with convert functions,
they will also define the type of the resulting object. For instance
the JSON type can be a `string` (ISO8601 formatted date) while
the converted type can be `Date`, this will reflect in the TypeScript
object. (Note that the converted values are **NOT** serialized/written
back to the container/process.env)

## Install

```sh
yarn add @profusion/validated-env-schema
```

## Usage

```ts
import validateEnvVars from '@profusion/validated-env-schema';

const values = validateEnvVars({
  properties: {
    AUTH_TOKEN: { type: 'string' },
    TTL: { type: 'number' },
  },
  required: ['AUTH_TOKEN'],
  type: 'object',
} as const);
console.log('values:', values.AUTH_TOKEN, values.TTL);
// values.AUTH_TOKEN is type: string
// values.TTL is type: number | undefined (not int required array)
```

See more complete [usage example](./examples/usage.ts).

**NOTE:** This package doesn't load the environment variables from
files, they must be present when the validation call is executed.

Debug messages can be enabled with `VALIDATED_ENV_SCHEMA_DEBUG=true`,
this will print out extensive debug.

### JSON Schema String Formats

In order to use `{ "type": "string", "format": "..."}`, one must
install [ajv-formats](https://github.com/ajv-validator/ajv-formats):

```sh
yarn add ajv-formats
```

### Usage with dotenv and others

The packages such as `dotenv` can be used with this software
without any specific configuration, just require those packages,
either explicit or using `node -r dotenv/config app.js`


## Similar Packages

This package is similar to
[fastify/env-schema](https://github.com/fastify/env-schema), as it
uses Ajv in the same way, but the usage interface is different.

This project's  `validateEnvVars()` takes an optional customize
object that can handle parse, serialization, post-validation and
conversion to native type for each property. It will also
properly type the returned object, will remove invalid properties
and throw errors.

## License

Open source - [MIT](https://opensource.org/licenses/MIT).
