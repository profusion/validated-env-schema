/* eslint-disable import/first */
process.env.VALIDATED_ENV_SCHEMA_DEBUG = 'true';

import {
  commonSchemas,
  JSONSchema7,
} from '@profusion/json-schema-to-typescript-definitions';

import {
  EnvSchemaMaybeErrors,
  EnvSchemaPartialValues,
  schemaProperties,
} from './types';
import commonConvert from './common-convert';
import createConvert from './convert';

const getConsoleMock = (): jest.SpyInstance<void, unknown[]> =>
  jest.spyOn(global.console, 'log').mockImplementation();

const expectConsoleMockAndRestore = (
  spy: jest.SpyInstance<void, unknown[]>,
  calls: unknown[][],
): void => {
  expect(spy.mock.calls).toEqual(calls);
  spy.mockRestore();
};

describe('createConvert', (): void => {
  const schema = {
    properties: {
      OPT_VAR: commonSchemas.string,
      REQ_VAR: commonSchemas.dateTime,
    },
    required: ['REQ_VAR'],
    type: 'object',
  } as const;
  type S = typeof schema;

  it('works without conversion', (): void => {
    const values: EnvSchemaPartialValues<S> = {
      OPT_VAR: '0x1fffffffffffff',
      REQ_VAR: '2021-01-02T12:34:56.000Z',
    };
    const container: Record<string, string | undefined> = {
      OPT_VAR: '0x1fffffffffffff',
      REQ_VAR: '2021-01-02T12:34:56.000Z',
    };
    const convert = createConvert(schema, schemaProperties(schema), undefined);
    const consoleSpy = getConsoleMock();
    const [convertedValue, conversionErrors] = convert(
      values,
      undefined,
      container,
    );
    expect(conversionErrors).toBeUndefined();
    expect(convertedValue).toBe(values); // in place
    expect(container).toEqual({
      OPT_VAR: '0x1fffffffffffff',
      REQ_VAR: '2021-01-02T12:34:56.000Z',
    });
    expect(convertedValue).toEqual({
      OPT_VAR: '0x1fffffffffffff',
      REQ_VAR: '2021-01-02T12:34:56.000Z',
    });
    expectConsoleMockAndRestore(consoleSpy, []);
  });

  it('works with valid schema', (): void => {
    const values: EnvSchemaPartialValues<S> = {
      OPT_VAR: '0x1fffffffffffff',
      REQ_VAR: '2021-01-02T12:34:56.000Z',
    };
    const container = {
      OPT_VAR: '0x1fffffffffffff',
      REQ_VAR: '2021-01-02T12:34:56.000Z',
    } as const;
    const convert = createConvert(schema, schemaProperties(schema), {
      OPT_VAR: (
        value: string | undefined,
        propertySchema: JSONSchema7,
        key: string,
        allSchema: JSONSchema7,
        initialValues: EnvSchemaPartialValues<S>,
        errors: EnvSchemaMaybeErrors<S>,
      ): bigint | undefined =>
        typeof value === 'string' &&
        propertySchema === schema.properties.OPT_VAR &&
        key === 'OPT_VAR' &&
        allSchema === schema &&
        initialValues === values &&
        initialValues.OPT_VAR === value &&
        errors === undefined
          ? BigInt(value)
          : undefined,
      REQ_VAR: commonConvert.dateTime,
    });
    const consoleSpy = getConsoleMock();
    const [convertedValue, conversionErrors] = convert(
      values,
      undefined,
      container,
    );
    expect(conversionErrors).toBeUndefined();
    expect(convertedValue).toBe(values); // in place
    expect(container).toEqual({
      OPT_VAR: '0x1fffffffffffff',
      REQ_VAR: '2021-01-02T12:34:56.000Z',
    });
    expect(convertedValue).toEqual({
      OPT_VAR: BigInt(container.OPT_VAR),
      REQ_VAR: commonConvert.dateTime(container.REQ_VAR),
    });
    expectConsoleMockAndRestore(consoleSpy, [
      [
        `\
Conversion of "OPT_VAR" changed property from:
Previous Value: "0x1fffffffffffff"
New Value.....: 9007199254740991
`,
      ],
      [
        `\
Conversion of "REQ_VAR" changed property from:
Previous Value: "2021-01-02T12:34:56.000Z"
New Value.....: ${commonConvert.dateTime(container.REQ_VAR)}
`,
      ],
    ]);
  });

  it('works with missing values (keep undefined)', (): void => {
    const values: EnvSchemaPartialValues<S> = {};
    const container: Record<string, string | undefined> = {};
    const convert = createConvert(schema, schemaProperties(schema), {
      OPT_VAR: (
        value: string | undefined,
        propertySchema: JSONSchema7,
        key: string,
        allSchema: JSONSchema7,
        initialValues: EnvSchemaPartialValues<S>,
        errors: EnvSchemaMaybeErrors<S>,
      ): bigint | undefined =>
        typeof value === 'string' &&
        propertySchema === schema.properties.OPT_VAR &&
        key === 'OPT_VAR' &&
        allSchema === schema &&
        initialValues === values &&
        initialValues.OPT_VAR === value &&
        errors === undefined
          ? BigInt(value)
          : undefined,
      REQ_VAR: commonConvert.dateTime,
    });
    const consoleSpy = getConsoleMock();
    const [convertedValue, conversionErrors] = convert(
      values,
      undefined,
      container,
    );
    expect(conversionErrors).toEqual({
      REQ_VAR: [new Error('required property "REQ_VAR" is undefined')],
    });
    expect(convertedValue).toBe(values); // in place
    expect(container).toEqual({});
    expect(convertedValue).toEqual({});
    expectConsoleMockAndRestore(consoleSpy, []);
  });

  it('works with missing values (return custom default)', (): void => {
    const values: EnvSchemaPartialValues<S> = {};
    const container: Record<string, string | undefined> = {};
    const convert = createConvert(schema, schemaProperties(schema), {
      OPT_VAR: (
        value: string | undefined,
        propertySchema: JSONSchema7,
        key: string,
        allSchema: JSONSchema7,
        initialValues: EnvSchemaPartialValues<S>,
        errors: EnvSchemaMaybeErrors<S>,
      ): bigint | undefined =>
        typeof value === 'string' &&
        propertySchema === schema.properties.OPT_VAR &&
        key === 'OPT_VAR' &&
        allSchema === schema &&
        initialValues === values &&
        initialValues.OPT_VAR === value &&
        errors === undefined
          ? BigInt(value)
          : BigInt('0x123'),
      REQ_VAR: (value: string | undefined): Date =>
        value ? new Date(value) : new Date(0),
    });
    const consoleSpy = getConsoleMock();
    const [convertedValue, conversionErrors] = convert(
      values,
      undefined,
      container,
    );
    expect(conversionErrors).toBeUndefined();
    expect(convertedValue).toBe(values); // in place
    expect(container).toEqual({});
    expect(convertedValue).toEqual({
      OPT_VAR: BigInt('0x123'),
      REQ_VAR: new Date(0),
    });
    expectConsoleMockAndRestore(consoleSpy, [
      [
        `\
Conversion of "OPT_VAR" changed property from:
Previous Value: undefined
New Value.....: 291
`,
      ],
      [
        `\
Conversion of "REQ_VAR" changed property from:
Previous Value: undefined
New Value.....: ${new Date(0)}
`,
      ],
    ]);
  });

  it('removes properties converted to undefined', (): void => {
    const values: EnvSchemaPartialValues<S> = {
      OPT_VAR: '0x1fffffffffffff',
      REQ_VAR: '2021-01-02T12:34:56.000Z',
    };
    const container: Record<string, string | undefined> = {
      OPT_VAR: '0x1fffffffffffff',
      REQ_VAR: '2021-01-02T12:34:56.000Z',
    };
    const convert = createConvert(schema, schemaProperties(schema), {
      OPT_VAR: (): bigint | undefined => undefined,
      REQ_VAR: (): Date | undefined => undefined,
    });
    const consoleSpy = getConsoleMock();
    const [convertedValue, conversionErrors] = convert(
      values,
      undefined,
      container,
    );
    expect(conversionErrors).toEqual({
      REQ_VAR: [new Error('required property "REQ_VAR" is undefined')],
    });
    expect(convertedValue).toBe(values); // in place
    expect(container).toEqual({});
    expect(convertedValue).toEqual({});
    expectConsoleMockAndRestore(consoleSpy, [
      ['Conversion of "OPT_VAR" removed property. Was "0x1fffffffffffff"'],
      [
        'Conversion of "REQ_VAR" removed property. Was "2021-01-02T12:34:56.000Z"',
      ],
    ]);
  });

  it('removes properties that conversion did throw', (): void => {
    const values: EnvSchemaPartialValues<S> = {
      OPT_VAR: '0x1fffffffffffff',
      REQ_VAR: '2021-01-02T12:34:56.000Z',
    };
    const container: Record<string, string | undefined> = {
      OPT_VAR: '0x1fffffffffffff',
      REQ_VAR: '2021-01-02T12:34:56.000Z',
    };
    const error = new Error('forced error');
    const convert = createConvert(schema, schemaProperties(schema), {
      OPT_VAR: (): bigint => {
        throw error;
      },
      REQ_VAR: (): Date => {
        throw error;
      },
    });
    const consoleSpy = getConsoleMock();
    const [convertedValue, conversionErrors] = convert(
      values,
      undefined,
      container,
    );
    expect(conversionErrors).toEqual({
      OPT_VAR: [error],
      REQ_VAR: [error, new Error('required property "REQ_VAR" is undefined')],
    });
    expect(convertedValue).toBe(values); // in place
    expect(container).toEqual({});
    expect(convertedValue).toEqual({});
    expectConsoleMockAndRestore(consoleSpy, [
      [
        'Conversion of "OPT_VAR" did throw Error: forced error. Remove property. Was "0x1fffffffffffff"',
      ],
      [
        'Conversion of "REQ_VAR" did throw Error: forced error. Remove property. Was "2021-01-02T12:34:56.000Z"',
      ],
    ]);
  });

  it('works without required properties', (): void => {
    const schemaNoRequired = {
      properties: {
        OPT_VAR: commonSchemas.string,
        REQ_VAR: commonSchemas.dateTime,
      },
      type: 'object',
    } as const;
    const values: EnvSchemaPartialValues<typeof schemaNoRequired> = {};
    const container: Record<string, string | undefined> = {};
    const convert = createConvert(
      schemaNoRequired,
      schemaProperties(schemaNoRequired),
      {
        OPT_VAR: (): bigint | undefined => undefined,
        REQ_VAR: (): Date | undefined => undefined,
      },
    );
    const consoleSpy = getConsoleMock();
    const [convertedValue, conversionErrors] = convert(
      values,
      undefined,
      container,
    );
    expect(conversionErrors).toBeUndefined();
    expect(convertedValue).toBe(values); // in place
    expect(container).toEqual({});
    expect(convertedValue).toEqual({});
    expectConsoleMockAndRestore(consoleSpy, []);
  });
});
