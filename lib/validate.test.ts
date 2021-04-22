/* eslint-disable import/first */
process.env.VALIDATED_ENV_SCHEMA_DEBUG = 'true';

import Ajv from 'ajv';

import {
  EnvSchemaMaybeErrors,
  EnvSchemaPartialValues,
  schemaProperties,
} from './types';
import createValidate from './validate';

const getConsoleMock = (): jest.SpyInstance<void, unknown[]> =>
  jest.spyOn(global.console, 'log').mockImplementation();

const expectConsoleMockAndRestore = (
  spy: jest.SpyInstance<void, unknown[]>,
  calls: unknown[][],
): void => {
  expect(spy.mock.calls).toEqual(calls);
  spy.mockRestore();
};

describe('createValidate', (): void => {
  const schema = {
    properties: {
      OPT_VAR: { default: 42, minimum: 0, type: 'number' },
      REQ_VAR: {
        properties: {
          a: { items: { type: 'number' }, type: 'array' },
          s: { type: 'string' },
        },
        required: ['s'],
        type: 'object',
      },
    },
    required: ['REQ_VAR'],
    type: 'object',
  } as const;
  type S = typeof schema;

  it('works with valid data', (): void => {
    expect(
      createValidate(
        schema,
        schemaProperties(schema),
        undefined,
      )(
        {
          OPT_VAR: 1,
          REQ_VAR: {
            a: [2, 3],
            s: 'hello',
          },
        },
        undefined,
      ),
    ).toEqual([
      {
        OPT_VAR: 1,
        REQ_VAR: {
          a: [2, 3],
          s: 'hello',
        },
      },
      undefined,
    ]);
  });

  it('works with valid schema defaults', (): void => {
    expect(
      createValidate(
        schema,
        schemaProperties(schema),
        undefined,
      )(
        {
          REQ_VAR: {
            a: [2, 3],
            s: 'hello',
          },
        },
        undefined,
      ),
    ).toEqual([
      {
        OPT_VAR: 42,
        REQ_VAR: {
          a: [2, 3],
          s: 'hello',
        },
      },
      undefined,
    ]);
  });

  it('works with valid data coerced', (): void => {
    expect(
      createValidate(
        schema,
        schemaProperties(schema),
        undefined,
      )(
        {
          OPT_VAR: '1',
          REQ_VAR: {
            a: ['2', '3'],
            s: true,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        undefined,
      ),
    ).toEqual([
      {
        OPT_VAR: 1,
        REQ_VAR: {
          a: [2, 3],
          s: 'true',
        },
      },
      undefined,
    ]);
  });

  describe('handles invalid data', (): void => {
    it('optional is set to default', (): void => {
      const consoleSpy = getConsoleMock();
      expect(
        createValidate(
          schema,
          schemaProperties(schema),
          undefined,
        )(
          {
            OPT_VAR: 'bug',
            REQ_VAR: {
              a: [2, 3],
              s: 'hello',
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
          undefined,
        ),
      ).toEqual([
        {
          OPT_VAR: 42,
          REQ_VAR: {
            a: [2, 3],
            s: 'hello',
          },
        },
        {
          OPT_VAR: [new Ajv.ValidationError([])],
        },
      ]);
      expectConsoleMockAndRestore(consoleSpy, [
        [
          'Ajv failed the validation of "OPT_VAR": data/OPT_VAR must be number. Use default 42. Was "bug"',
        ],
      ]);
    });

    it('missing required', (): void => {
      const consoleSpy = getConsoleMock();
      expect(
        createValidate(
          schema,
          schemaProperties(schema),
          undefined,
        )(
          {
            OPT_VAR: 1,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
          undefined,
        ),
      ).toEqual([
        {
          OPT_VAR: 1,
        },
        {
          REQ_VAR: [new Ajv.ValidationError([])],
        },
      ]);
      expectConsoleMockAndRestore(consoleSpy, [
        [
          'Ajv failed the validation of "REQ_VAR": data must have required property \'REQ_VAR\'. Remove property. Was undefined',
        ],
      ]);
    });

    it('required is removed', (): void => {
      const consoleSpy = getConsoleMock();
      expect(
        createValidate(
          schema,
          schemaProperties(schema),
          undefined,
        )(
          {
            OPT_VAR: 1,
            REQ_VAR: '{"bug":"not-an-object"}',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
          undefined,
        ),
      ).toEqual([
        {
          OPT_VAR: 1,
        },
        {
          REQ_VAR: [new Ajv.ValidationError([])],
        },
      ]);
      expectConsoleMockAndRestore(consoleSpy, [
        [
          'Ajv failed the validation of "REQ_VAR": data/REQ_VAR must be object. Remove property. Was "{\\"bug\\":\\"not-an-object\\"}"',
        ],
      ]);
    });

    it('failure inside object value (optional member)', (): void => {
      const consoleSpy = getConsoleMock();
      expect(
        createValidate(
          schema,
          schemaProperties(schema),
          undefined,
        )(
          {
            REQ_VAR: {
              a: [2, 'bug'],
              s: 'hello',
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
          undefined,
        ),
      ).toEqual([
        {
          OPT_VAR: 42,
        },
        {
          REQ_VAR: [new Ajv.ValidationError([])],
        },
      ]);
      expectConsoleMockAndRestore(consoleSpy, [
        [
          'Ajv failed the validation of "REQ_VAR": data/REQ_VAR/a/1 must be number. Remove property. Was {"a":[2,"bug"],"s":"hello"}',
        ],
      ]);
    });

    it('failure inside object value (required member)', (): void => {
      const consoleSpy = getConsoleMock();
      expect(
        createValidate(
          schema,
          schemaProperties(schema),
          undefined,
        )(
          {
            REQ_VAR: {
              a: [1, 2],
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
          undefined,
        ),
      ).toEqual([
        {
          OPT_VAR: 42,
        },
        {
          REQ_VAR: [new Ajv.ValidationError([])],
        },
      ]);
      expectConsoleMockAndRestore(consoleSpy, [
        [
          'Ajv failed the validation of "REQ_VAR": data/REQ_VAR must have required property \'s\'. Remove property. Was {"a":[1,2]}',
        ],
      ]);
    });
  });

  describe('works with customized post validate', (): void => {
    it('works returning the value unmodified', (): void => {
      const values = {
        OPT_VAR: '1',
        REQ_VAR: {
          a: ['2', '3'],
          s: true,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
      expect(
        createValidate(schema, schemaProperties(schema), {
          OPT_VAR: (
            value: number | undefined,
            propertySchema: S['properties']['OPT_VAR'],
            key: string,
            allSchema: S,
            allValues: EnvSchemaPartialValues<S>,
            errors: Readonly<EnvSchemaMaybeErrors<S>>,
          ): number | undefined =>
            value === 1 &&
            propertySchema === schema.properties.OPT_VAR &&
            key === 'OPT_VAR' &&
            allSchema === schema &&
            allValues === values &&
            errors === undefined
              ? value
              : undefined,
        })(values, undefined),
      ).toEqual([
        {
          OPT_VAR: 1,
          REQ_VAR: {
            a: [2, 3],
            s: 'true',
          },
        },
        undefined,
      ]);
    });

    it('works returning the value modified values', (): void => {
      const values = {
        OPT_VAR: '1',
        REQ_VAR: {
          a: ['2', '3'],
          s: true,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
      const consoleSpy = getConsoleMock();
      expect(
        createValidate(schema, schemaProperties(schema), {
          OPT_VAR: (
            value: number | undefined,
            propertySchema: S['properties']['OPT_VAR'],
            key: string,
            allSchema: S,
            allValues: EnvSchemaPartialValues<S>,
            errors: Readonly<EnvSchemaMaybeErrors<S>>,
          ): number | undefined =>
            value === 1 &&
            propertySchema === schema.properties.OPT_VAR &&
            key === 'OPT_VAR' &&
            allSchema === schema &&
            allValues === values &&
            errors === undefined
              ? 1234
              : undefined,
        })(values, undefined),
      ).toEqual([
        {
          OPT_VAR: 1234,
          REQ_VAR: {
            a: [2, 3],
            s: 'true',
          },
        },
        undefined,
      ]);
      expectConsoleMockAndRestore(consoleSpy, [
        [
          `\
Post validation of "OPT_VAR" changed property from:
Previous Value: 1
New Value.....: 1234
`,
        ],
      ]);
    });

    it('works returning the value undefined', (): void => {
      const values = {
        OPT_VAR: '1',
        REQ_VAR: {
          a: ['2', '3'],
          s: true,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
      const consoleSpy = getConsoleMock();
      expect(
        createValidate(schema, schemaProperties(schema), {
          OPT_VAR: (
            value: number | undefined,
            propertySchema: S['properties']['OPT_VAR'],
            key: string,
            allSchema: S,
            allValues: EnvSchemaPartialValues<S>,
            errors: Readonly<EnvSchemaMaybeErrors<S>>,
          ): number | undefined =>
            value === 1 &&
            propertySchema === schema.properties.OPT_VAR &&
            key === 'OPT_VAR' &&
            allSchema === schema &&
            allValues === values &&
            errors === undefined
              ? undefined
              : 333,
        })(values, undefined),
      ).toEqual([
        {
          REQ_VAR: {
            a: [2, 3],
            s: 'true',
          },
        },
        undefined,
      ]);
      expectConsoleMockAndRestore(consoleSpy, [
        ['Post validation of "OPT_VAR" removed property. Was 1'],
      ]);
    });

    it('works if throws', (): void => {
      const values = {
        OPT_VAR: '1',
        REQ_VAR: {
          a: ['2', '3'],
          s: true,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
      const error = new Error('forced error');
      const consoleSpy = getConsoleMock();
      expect(
        createValidate(schema, schemaProperties(schema), {
          OPT_VAR: (): number | undefined => {
            throw error;
          },
        })(values, undefined),
      ).toEqual([
        {
          REQ_VAR: {
            a: [2, 3],
            s: 'true',
          },
        },
        {
          OPT_VAR: [error],
        },
      ]);
      expectConsoleMockAndRestore(consoleSpy, [
        [
          'Post validation of "OPT_VAR" did throw Error: forced error. Remove property. Was 1',
        ],
      ]);
    });

    it('works if throws and had error', (): void => {
      const values = {
        OPT_VAR: '1',
        REQ_VAR: '{"bug":"not-an-object"}',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
      const error = new Error('forced error');
      const consoleSpy = getConsoleMock();
      expect(
        createValidate(schema, schemaProperties(schema), {
          REQ_VAR: (): EnvSchemaPartialValues<S>['REQ_VAR'] => {
            throw error;
          },
        })(values, undefined),
      ).toEqual([
        {
          OPT_VAR: 1,
        },
        {
          REQ_VAR: [new Ajv.ValidationError([]), error],
        },
      ]);
      expectConsoleMockAndRestore(consoleSpy, [
        [
          'Ajv failed the validation of "REQ_VAR": data/REQ_VAR must be object. Remove property. Was "{\\"bug\\":\\"not-an-object\\"}"',
        ],
        [
          'Post validation of "REQ_VAR" did throw Error: forced error. Remove property. Was undefined',
        ],
      ]);
    });
  });
});
