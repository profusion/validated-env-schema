/* eslint-disable import/first */
process.env.VALIDATED_ENV_SCHEMA_DEBUG = 'true';

import type {
  JSONSchema7,
  TypeFromJSONSchema,
} from '@profusion/json-schema-to-typescript-definitions';

import createParse from './parse';
import { schemaProperties } from './types';

const getConsoleMock = (): jest.SpyInstance<void, unknown[]> =>
  jest.spyOn(global.console, 'log').mockImplementation();

const expectConsoleMockAndRestore = (
  spy: jest.SpyInstance<void, unknown[]>,
  calls: unknown[][],
): void => {
  expect(spy.mock.calls).toEqual(calls);
  spy.mockRestore();
};

describe('createParse', (): void => {
  it('works with boolean', (): void => {
    const schema = {
      properties: {
        MY_VAR: { type: 'boolean' },
      },
      type: 'object',
    } as const;
    type S = typeof schema;
    const values: TypeFromJSONSchema<S> = {
      MY_VAR: true,
    } as const;
    const container: Record<string, string | undefined> = {
      MY_VAR: 'true',
    } as const;
    expect(
      createParse(schema, schemaProperties(schema), undefined)(container),
    ).toEqual([values, undefined]);
  });

  it('works with number', (): void => {
    const schema = {
      properties: {
        MY_VAR: { type: 'number' },
      },
      type: 'object',
    } as const;
    type S = typeof schema;
    const values: TypeFromJSONSchema<S> = {
      MY_VAR: 123,
    } as const;
    const container: Record<string, string | undefined> = {
      MY_VAR: '123',
    } as const;
    expect(
      createParse(schema, schemaProperties(schema), undefined)(container),
    ).toEqual([values, undefined]);
  });

  it('works with integer', (): void => {
    const schema = {
      properties: {
        MY_VAR: { type: 'integer' },
      },
      type: 'object',
    } as const;
    type S = typeof schema;
    const values: TypeFromJSONSchema<S> = {
      MY_VAR: 123.456, // will be truncated later by ajv
    } as const;
    const container: Record<string, string | undefined> = {
      MY_VAR: '123.456',
    } as const;
    expect(
      createParse(schema, schemaProperties(schema), undefined)(container),
    ).toEqual([values, undefined]);
  });

  describe('works with string', (): void => {
    const schema = {
      properties: {
        MY_VAR: { type: 'string' },
      },
      type: 'object',
    } as const;
    type S = typeof schema;

    it('works without quotes', (): void => {
      const values: TypeFromJSONSchema<S> = {
        MY_VAR: 'hello world',
      } as const;
      const container: Record<string, string | undefined> = {
        MY_VAR: 'hello world',
      } as const;
      expect(
        createParse(schema, schemaProperties(schema), undefined)(container),
      ).toEqual([values, undefined]);
    });

    it('works with quotes', (): void => {
      const values: TypeFromJSONSchema<S> = {
        MY_VAR: 'hello world',
      } as const;
      const container: Record<string, string | undefined> = {
        MY_VAR: '"hello world"',
      } as const;
      expect(
        createParse(schema, schemaProperties(schema), undefined)(container),
      ).toEqual([values, undefined]);
    });

    it('works with empty', (): void => {
      const values: TypeFromJSONSchema<S> = {
        MY_VAR: '',
      } as const;
      const container: Record<string, string | undefined> = {
        MY_VAR: '',
      } as const;
      expect(
        createParse(schema, schemaProperties(schema), undefined)(container),
      ).toEqual([values, undefined]);
    });
  });

  it('works with array', (): void => {
    const schema = {
      properties: {
        MY_VAR: { items: { type: 'number' }, type: 'array' },
      },
      type: 'object',
    } as const;
    type S = typeof schema;
    const values: TypeFromJSONSchema<S> = {
      MY_VAR: [1, 2] as number[],
    } as const;
    const container: Record<string, string | undefined> = {
      MY_VAR: '[1, 2]',
    } as const;
    expect(
      createParse(schema, schemaProperties(schema), undefined)(container),
    ).toEqual([values, undefined]);
  });

  it('works with null', (): void => {
    const schema = {
      properties: {
        MY_VAR: { type: 'null' },
      },
      type: 'object',
    } as const;
    type S = typeof schema;
    const values: TypeFromJSONSchema<S> = {
      MY_VAR: null,
    } as const;
    const container: Record<string, string | undefined> = {
      MY_VAR: 'null',
    } as const;
    expect(
      createParse(schema, schemaProperties(schema), undefined)(container),
    ).toEqual([values, undefined]);
  });

  it('works with array', (): void => {
    const schema = {
      properties: {
        MY_VAR: { items: { type: 'number' }, type: 'array' },
      },
      type: 'object',
    } as const;
    type S = typeof schema;
    const values: TypeFromJSONSchema<S> = {
      MY_VAR: [1, 2] as number[],
    } as const;
    const container: Record<string, string | undefined> = {
      MY_VAR: '[1, 2]',
    } as const;
    expect(
      createParse(schema, schemaProperties(schema), undefined)(container),
    ).toEqual([values, undefined]);
  });

  it('works with object', (): void => {
    const schema = {
      properties: {
        MY_VAR: {
          properties: {
            n: { type: 'number' },
          },
          type: 'object',
        },
      },
      type: 'object',
    } as const;
    type S = typeof schema;
    const values: TypeFromJSONSchema<S> = {
      MY_VAR: { n: 123 },
    } as const;
    const container: Record<string, string | undefined> = {
      MY_VAR: '{"n":123}',
    } as const;
    expect(
      createParse(schema, schemaProperties(schema), undefined)(container),
    ).toEqual([values, undefined]);
  });

  it('works with missing value', (): void => {
    const schema = {
      properties: {
        MY_VAR: { type: 'boolean' },
      },
      type: 'object',
    } as const;
    type S = typeof schema;
    const values: Partial<TypeFromJSONSchema<S>> = {} as const;
    const container: Record<string, string | undefined> = {} as const;
    expect(
      createParse(schema, schemaProperties(schema), undefined)(container),
    ).toEqual([values, undefined]);
  });

  it('works with customized parser', (): void => {
    const schema = {
      properties: {
        MY_VAR: { type: 'boolean' },
      },
      type: 'object',
    } as const;
    type S = typeof schema;
    const values: Partial<TypeFromJSONSchema<S>> = {
      MY_VAR: true,
    } as const;
    const container: Record<string, string | undefined> = {
      MY_VAR: 'yes',
    } as const;
    expect(
      createParse(schema, schemaProperties(schema), {
        MY_VAR: (
          str: string,
          propertySchema: JSONSchema7,
          key: string,
          allSchema: JSONSchema7,
        ): boolean =>
          str === 'yes' &&
          propertySchema === schema.properties.MY_VAR &&
          key === 'MY_VAR' &&
          allSchema === schema,
      } as const)(container),
    ).toEqual([values, undefined]);
  });

  it('works with throw', (): void => {
    const schema = {
      properties: {
        MY_VAR: { type: 'boolean' },
      },
      type: 'object',
    } as const;
    const container: Record<string, string | undefined> = {
      MY_VAR: 'yes',
    } as const;
    const consoleSpy = getConsoleMock();
    const error = new Error('forced error');
    expect(
      createParse(schema, schemaProperties(schema), {
        MY_VAR: (): boolean => {
          throw error;
        },
      } as const)(container),
    ).toEqual([
      {},
      {
        MY_VAR: [error],
      },
    ]);
    expectConsoleMockAndRestore(consoleSpy, [
      ['failed to parse "MY_VAR": Error: forced error', error],
    ]);
  });
});
