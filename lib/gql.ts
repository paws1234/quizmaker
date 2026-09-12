/**
 * Browser-side GraphQL client.
 *
 * Deliberately tiny: the frontend is just one client of the API, so a plain
 * fetch wrapper keeps the coupling thin and the bundle small.
 */

export class GqlError extends Error {
  readonly code?: string;
  readonly status: number;

  constructor(message: string, code: string | undefined, status: number) {
    super(message);
    this.name = 'GqlError';
    this.code = code;
    this.status = status;
  }

  get isAuthError(): boolean {
    return this.code === 'UNAUTHENTICATED';
  }
}

export async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
    });
  } catch {
    throw new GqlError('Could not reach the API. Is the stack running?', 'NETWORK', 0);
  }

  const payload = (await response.json().catch(() => null)) as
    | { data?: T; errors?: Array<{ message: string; extensions?: { code?: string } }> }
    | null;

  if (payload?.errors?.length) {
    const first = payload.errors[0];
    throw new GqlError(first.message, first.extensions?.code, response.status);
  }

  if (!response.ok || !payload?.data) {
    throw new GqlError(`Request failed with status ${response.status}.`, 'HTTP', response.status);
  }

  return payload.data;
}

export type AdminSession = {
  authenticated: boolean;
  configured: boolean;
};

export async function readSession(): Promise<AdminSession> {
  const response = await fetch('/api/admin/session', { cache: 'no-store' });
  if (!response.ok) return { authenticated: false, configured: true };
  return (await response.json()) as AdminSession;
}

async function postJson(url: string, method: 'POST' | 'DELETE', body?: unknown): Promise<Response> {
  return fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function signIn(token: string): Promise<void> {
  const response = await postJson('/api/admin/session', 'POST', { token });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? 'Sign-in failed.');
  }
}

export async function signOut(): Promise<void> {
  await postJson('/api/admin/session', 'DELETE');
}
