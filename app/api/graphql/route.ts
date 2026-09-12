import { createYoga } from 'graphql-yoga';
import { authenticate } from '@/lib/graphql/context';
import { schema } from '@/lib/graphql/schema';

/**
 * The single GraphQL endpoint. It is the only way the frontend reads or writes
 * quiz data, which is what keeps the architecture headless: any other client
 * can POST to the same URL.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const yoga = createYoga({
  schema,
  graphqlEndpoint: '/api/graphql',
  // Next's Request/Response are the fetch API's own, so yoga can use them directly.
  fetchAPI: { Response },
  // GraphiQL is a development convenience; it stays off in production builds.
  graphiql: process.env.NODE_ENV !== 'production',
  context: ({ request }) => authenticate(request),
  logging: false,
});

/**
 * Wrapped so the export matches Next's route handler signature - yoga's own
 * handleRequest takes a second, yoga-specific argument that Next rejects.
 */
async function graphqlHandler(request: Request): Promise<Response> {
  return yoga.handleRequest(request, {});
}

export { graphqlHandler as GET, graphqlHandler as POST, graphqlHandler as OPTIONS };
