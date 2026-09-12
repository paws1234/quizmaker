import { GraphQLError, Kind, GraphQLScalarType } from 'graphql';

/** ISO-8601 timestamps, so the API never leaks Mongo-specific date objects. */
export const DateTimeScalar = new GraphQLScalarType<Date, string>({
  name: 'DateTime',
  description: 'An ISO-8601 date-time string, e.g. 2026-09-12T10:00:00.000Z',

  serialize(value) {
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      throw new GraphQLError(`DateTime cannot represent value: ${String(value)}`);
    }
    return date.toISOString();
  },

  parseValue(value) {
    if (typeof value !== 'string') {
      throw new GraphQLError('DateTime must be a string');
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new GraphQLError(`DateTime cannot represent value: ${value}`);
    }
    return date;
  },

  parseLiteral(node) {
    if (node.kind !== Kind.STRING) {
      throw new GraphQLError('DateTime must be a string');
    }
    const date = new Date(node.value);
    if (Number.isNaN(date.getTime())) {
      throw new GraphQLError(`DateTime cannot represent value: ${node.value}`);
    }
    return date;
  },
});
