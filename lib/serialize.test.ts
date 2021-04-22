/* eslint-disable import/first */
process.env.VALIDATED_ENV_SCHEMA_DEBUG = 'true';

import type {
  JSONSchema7,
  TypeFromJSONSchema,
} from '@profusion/json-schema-to-typescript-definitions';

import createSerialize from './serialize';
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

describe('createSerialize', (): void => {
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
    const container: Record<string, string | undefined> = {};
    expect(
      createSerialize(schema, schemaProperties(schema), undefined)(
        values,
        container,
        undefined,
      ),
    ).toEqual([values, undefined]);
    expect(container).toEqual({ MY_VAR: 'true' });
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
    const container: Record<string, string | undefined> = {};
    expect(
      createSerialize(schema, schemaProperties(schema), undefined)(
        values,
        container,
        undefined,
      ),
    ).toEqual([values, undefined]);
    expect(container).toEqual({ MY_VAR: '123' });
  });

  it('works with string', (): void => {
    const schema = {
      properties: {
        MY_VAR: { type: 'string' },
      },
      type: 'object',
    } as const;
    type S = typeof schema;
    const values: TypeFromJSONSchema<S> = {
      MY_VAR: 'hello',
    } as const;
    const container: Record<string, string | undefined> = {};
    expect(
      createSerialize(schema, schemaProperties(schema), undefined)(
        values,
        container,
        undefined,
      ),
    ).toEqual([values, undefined]);
    expect(container).toEqual({ MY_VAR: 'hello' });
  });

  it('works with string (forced)', (): void => {
    const schema = {
      properties: {
        MY_VAR: { type: 'string' },
      },
      type: 'object',
    } as const;
    type S = typeof schema;
    const values = { MY_VAR: 123 };
    const container: Record<string, string | undefined> = {};
    expect(
      createSerialize(schema, schemaProperties(schema), undefined)(
        (values as unknown) as TypeFromJSONSchema<S>,
        container,
        undefined,
      ),
    ).toEqual([values, undefined]);
    expect(container).toEqual({ MY_VAR: '123' });
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
    const container: Record<string, string | undefined> = {};
    expect(
      createSerialize(schema, schemaProperties(schema), undefined)(
        values,
        container,
        undefined,
      ),
    ).toEqual([values, undefined]);
    expect(container).toEqual({ MY_VAR: 'null' });
  });

  it('works with array', (): void => {
    const schema = {
      properties: {
        MY_VAR: { items: { type: 'string' }, type: 'array' },
      },
      type: 'object',
    } as const;
    type S = typeof schema;
    const values: TypeFromJSONSchema<S> = {
      MY_VAR: ['abc', 'def'] as string[],
    } as const;
    const container: Record<string, string | undefined> = {};
    expect(
      createSerialize(schema, schemaProperties(schema), undefined)(
        values,
        container,
        undefined,
      ),
    ).toEqual([values, undefined]);
    expect(container).toEqual({ MY_VAR: '["abc","def"]' });
  });

  it('works with object', (): void => {
    const schema = {
      properties: {
        MY_VAR: {
          properties: {
            b: { type: 'boolean' },
            s: { type: 'string' },
          },
          type: 'object',
        },
      },
      type: 'object',
    } as const;
    type S = typeof schema;
    const values: TypeFromJSONSchema<S> = {
      MY_VAR: {
        b: true,
        s: 'hello',
      },
    } as const;
    const container: Record<string, string | undefined> = {};
    expect(
      createSerialize(schema, schemaProperties(schema), undefined)(
        values,
        container,
        undefined,
      ),
    ).toEqual([values, undefined]);
    expect(container).toEqual({ MY_VAR: '{"b":true,"s":"hello"}' });
  });

  it('works to unset variables', (): void => {
    const schema = {
      properties: {
        MY_VAR: { type: 'boolean' },
      },
      type: 'object',
    } as const;
    type S = typeof schema;
    const values: Partial<TypeFromJSONSchema<S>> = {} as const;
    const container: Record<string, string | undefined> = {
      MY_VAR: 'will be removed',
    };
    expect(
      createSerialize(schema, schemaProperties(schema), undefined)(
        values,
        container,
        undefined,
      ),
    ).toEqual([values, undefined]);
    expect(container).toEqual({});
  });

  it('works with customized serializer', (): void => {
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
    const container: Record<string, string | undefined> = {};
    expect(
      createSerialize(schema, schemaProperties(schema), {
        // '| undefined' since MY_VAR is not required
        MY_VAR: (
          value: boolean | undefined,
          propertySchema: JSONSchema7,
          key: string,
          allSchema: JSONSchema7,
        ): string =>
          value &&
          propertySchema === schema.properties.MY_VAR &&
          key === 'MY_VAR' &&
          allSchema === schema
            ? '.'
            : '!',
      } as const)(values, container, undefined),
    ).toEqual([values, undefined]);
    expect(container).toEqual({ MY_VAR: '.' });
  });

  it('works with throw', (): void => {
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
    const container: Record<string, string | undefined> = {};
    const consoleSpy = getConsoleMock();
    const error = new Error('forced error');
    expect(
      createSerialize(schema, schemaProperties(schema), {
        MY_VAR: (): string => {
          throw error;
        },
      } as const)(values, container, undefined),
    ).toEqual([
      values,
      {
        MY_VAR: [error],
      },
    ]);
    expect(container).toEqual({});
    expectConsoleMockAndRestore(consoleSpy, [
      ['failed to serialize "MY_VAR": Error: forced error', error],
    ]);
  });
});
