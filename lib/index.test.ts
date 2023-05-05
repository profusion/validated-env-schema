/* eslint-disable import/first */
process.env.VALIDATED_ENV_SCHEMA_DEBUG = 'true';

import {
  commonSchemas,
  schemaHelpers,
} from '@profusion/json-schema-to-typescript-definitions';
import Ajv from 'ajv';

import validateEnvSchema, { EnvSchemaValidationError } from './index';

const getConsoleMock = (): jest.SpyInstance<void, unknown[]> =>
  jest.spyOn(global.console, 'log').mockImplementation();

const expectConsoleMockAndRestore = (
  spy: jest.SpyInstance<void, unknown[]>,
  calls: unknown[][],
): void => {
  expect(spy.mock.calls).toEqual(calls);
  spy.mockRestore();
};

describe('validateEnvSchema', (): void => {
  describe('basic schema', (): void => {
    const schema = {
      properties: {
        OPT_VAR: { default: 42, minimum: 0, type: 'number' },
        REQ_VAR: {
          properties: {
            a: schemaHelpers.array({ items: commonSchemas.number }),
            s: commonSchemas.string,
          },
          required: ['s'],
          type: 'object',
        },
      },
      required: ['REQ_VAR'],
      type: 'object',
    } as const;

    it('works with valid data', (): void => {
      const container: Record<string, string | undefined> = {
        OPT_VAR: '1',
        REQ_VAR: '{"a": [2, 3], "s": "hello"}',
      };
      expect(validateEnvSchema(schema, container)).toEqual({
        OPT_VAR: 1,
        REQ_VAR: {
          a: [2, 3],
          s: 'hello',
        },
      });
      expect(container).toEqual({
        OPT_VAR: '1',
        REQ_VAR: '{"a":[2,3],"s":"hello"}',
      });
    });

    it('throws on error', (): void => {
      const container: Record<string, string | undefined> = {
        REQ_VAR: 'bug',
      };
      const consoleSpy = getConsoleMock();
      expect.hasAssertions();
      try {
        validateEnvSchema(schema, container);
      } catch (e) {
        expect(e).toBeInstanceOf(EnvSchemaValidationError);
        const err = e as EnvSchemaValidationError<typeof schema, undefined>;
        expect(err.schema).toBe(schema);
        expect(err.container).toBe(container);
        expect(err.values).toEqual({
          OPT_VAR: 42, // default
        });
        expect(err.errors).toEqual({
          REQ_VAR: [new Ajv.ValidationError([])],
        });
        expect(container).toEqual({
          OPT_VAR: '42',
        });
      } finally {
        expectConsoleMockAndRestore(consoleSpy, [
          [
            'Ajv failed the validation of "REQ_VAR": data/REQ_VAR must be object. Remove property. Was "bug"',
          ],
        ]);
      }
    });

    it('works with customizations', (): void => {
      const container: Record<string, string | undefined> = {
        OPT_VAR: '1.23',
        REQ_VAR: '{"a": [2, 3], "s": "hello"}',
      };
      const consoleSpy = getConsoleMock();
      const values = validateEnvSchema(schema, container, {
        convert: {
          OPT_VAR: (value: number | undefined): bigint | undefined =>
            value !== undefined ? BigInt(value * 1e6) : undefined,
        },
        parse: {
          OPT_VAR: (str: string): number => Number(str) * 1000,
        },
        postValidate: {
          OPT_VAR: (value: number | undefined): number | undefined =>
            typeof value === 'number'
              ? Math.round(value / 1000) * 1000
              : undefined,
        },
        serialize: {
          OPT_VAR: (value: number): string => String(value / 1000),
        },
      } as const);
      type ValueType = typeof values;
      type ExpectedType = {
        OPT_VAR: bigint | undefined;
        REQ_VAR: {
          a?: number[];
          s: string;
        };
      };
      type CheckType = ValueType extends ExpectedType ? true : false;
      const check: CheckType = true;
      expect(check).toBe(true);
      expect(values).toEqual({
        OPT_VAR: BigInt(1000 * 1e6), // rounded by postValidated, then converted
        REQ_VAR: {
          a: [2, 3],
          s: 'hello',
        },
      });
      expect(container).toEqual({
        OPT_VAR: '1', // touched by serialize after postValidate
        REQ_VAR: '{"a":[2,3],"s":"hello"}',
      });
      expectConsoleMockAndRestore(consoleSpy, [
        [
          `\
Post validation of "OPT_VAR" changed property from:
Previous Value: 1230
New Value.....: 1000
`,
        ],
        [
          `\
Conversion of "OPT_VAR" changed property from:
Previous Value: 1000
New Value.....: 1000000000
`,
        ],
      ]);
    });

    it('defaults to process.env', (): void => {
      delete process.env.OPT_VAR;
      process.env.REQ_VAR = '{"a": [2, 3], "s": "hello"}';
      expect(validateEnvSchema(schema)).toEqual({
        OPT_VAR: 42, // default
        REQ_VAR: {
          a: [2, 3],
          s: 'hello',
        },
      });
      expect(process.env.OPT_VAR).toEqual('42');
      expect(process.env.REQ_VAR).toEqual('{"a":[2,3],"s":"hello"}');
    });

    it('throws parse errors', (): void => {
      const container: Record<string, string | undefined> = {
        OPT_VAR: '1.23',
        REQ_VAR: '{"a": [2, 3], "s": "hello"}',
      };
      const consoleSpy = getConsoleMock();
      const error = new Error('forced error');
      expect.hasAssertions();
      try {
        validateEnvSchema(schema, container, {
          parse: {
            OPT_VAR: (): number => {
              throw error;
            },
          },
        } as const);
      } catch (e) {
        expect(e).toBeInstanceOf(EnvSchemaValidationError);
        const err = e as EnvSchemaValidationError<typeof schema, undefined>;
        expect(err.schema).toBe(schema);
        expect(err.container).toBe(container);
        expect(err.values).toEqual({
          OPT_VAR: 42, // goes to default value
          REQ_VAR: { a: [2, 3], s: 'hello' },
        });
        expect(err.errors).toEqual({ OPT_VAR: [error] });
        expect(container).toEqual({
          OPT_VAR: '42',
          REQ_VAR: '{"a":[2,3],"s":"hello"}',
        });
      } finally {
        expectConsoleMockAndRestore(consoleSpy, [
          ['failed to parse "OPT_VAR": Error: forced error', error],
        ]);
      }
    });

    it('throws serialize errors', (): void => {
      const container: Record<string, string | undefined> = {
        OPT_VAR: '1.23',
        REQ_VAR: '{"a": [2, 3], "s": "hello"}',
      };
      const consoleSpy = getConsoleMock();
      const error = new Error('forced error');
      expect.hasAssertions();
      try {
        validateEnvSchema(schema, container, {
          serialize: {
            OPT_VAR: (): string => {
              throw error;
            },
          },
        } as const);
      } catch (e) {
        expect(e).toBeInstanceOf(EnvSchemaValidationError);
        const err = e as EnvSchemaValidationError<typeof schema, undefined>;
        expect(err.schema).toBe(schema);
        expect(err.container).toBe(container);
        expect(err.values).toEqual({
          OPT_VAR: 1.23, // not deleted if fails to serialize
          REQ_VAR: { a: [2, 3], s: 'hello' },
        });
        expect(err.errors).toEqual({ OPT_VAR: [error] });
        expect(container).toEqual({
          REQ_VAR: '{"a":[2,3],"s":"hello"}',
        });
      } finally {
        expectConsoleMockAndRestore(consoleSpy, [
          ['failed to serialize "OPT_VAR": Error: forced error', error],
        ]);
      }
    });

    it('throws post-validate errors', (): void => {
      const container: Record<string, string | undefined> = {
        OPT_VAR: '1.23',
        REQ_VAR: '{"a": [2, 3], "s": "hello"}',
      };
      const consoleSpy = getConsoleMock();
      const error = new Error('forced error');
      expect.hasAssertions();
      try {
        validateEnvSchema(schema, container, {
          postValidate: {
            OPT_VAR: (): number => {
              throw error;
            },
          },
        } as const);
      } catch (e) {
        expect(e).toBeInstanceOf(EnvSchemaValidationError);
        const err = e as EnvSchemaValidationError<typeof schema, undefined>;
        expect(err.schema).toBe(schema);
        expect(err.container).toBe(container);
        expect(err.values).toEqual({
          REQ_VAR: { a: [2, 3], s: 'hello' },
        });
        expect(err.errors).toEqual({ OPT_VAR: [error] });
        expect(container).toEqual({
          REQ_VAR: '{"a":[2,3],"s":"hello"}',
        });
      } finally {
        expectConsoleMockAndRestore(consoleSpy, [
          [
            'Post validation of "OPT_VAR" did throw Error: forced error. Remove property. Was 1.23',
          ],
        ]);
      }
    });

    it('throws convert errors', (): void => {
      const container: Record<string, string | undefined> = {
        OPT_VAR: '1.23',
        REQ_VAR: '{"a": [2, 3], "s": "hello"}',
      };
      const consoleSpy = getConsoleMock();
      const error = new Error('forced error');
      expect.hasAssertions();
      try {
        validateEnvSchema(schema, container, {
          convert: {
            OPT_VAR: (): number => {
              throw error;
            },
          },
        } as const);
      } catch (e) {
        expect(e).toBeInstanceOf(EnvSchemaValidationError);
        const err = e as EnvSchemaValidationError<typeof schema, undefined>;
        expect(err.schema).toBe(schema);
        expect(err.container).toBe(container);
        expect(err.values).toEqual({
          REQ_VAR: { a: [2, 3], s: 'hello' },
        });
        expect(err.errors).toEqual({ OPT_VAR: [error] });
        expect(container).toEqual({
          REQ_VAR: '{"a":[2,3],"s":"hello"}',
        });
      } finally {
        expectConsoleMockAndRestore(consoleSpy, [
          [
            'Conversion of "OPT_VAR" did throw Error: forced error. Remove property. Was 1.23',
          ],
        ]);
      }
    });
  });
});
