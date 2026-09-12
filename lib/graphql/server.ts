import { GraphQLError, execute, parse, validate } from 'graphql';
import type { GraphQLContext } from './context';
import { schema } from './schema';

/**
 * Runs a query against the schema in-process.
 *
 * The HTTP endpoint and server-side rendering execute the same schema with the
 * same resolvers, so the GraphQL API stays the single source of truth - this
 * only skips the loop back out through the network for the first paint.
 */
export async function executeServerQuery<TData>(
  source: string,
  variableValues: Record<string, unknown>,
  contextValue: GraphQLContext,
): Promise<TData | null> {
  const document = parse(source);

  const validationErrors = validate(schema, document);
  if (validationErrors.length > 0) {
    throw new GraphQLError(`Invalid query: ${validationErrors.map((error) => error.message).join('; ')}`);
  }

  const result = await execute({ schema, document, variableValues, contextValue });

  if (result.errors?.length) {
    throw new GraphQLError(result.errors[0].message);
  }

  // graphql-js builds its result maps with a null prototype (a prototype
  // pollution guard). React refuses those at the server/client boundary, so
  // anything handed onwards is rebuilt as plain objects and arrays.
  return toPlain(result.data) as TData | null;
}

function toPlain(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toPlain);

  if (value !== null && typeof value === 'object') {
    const plain: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      plain[key] = toPlain(nested);
    }
    return plain;
  }

  return value;
}
