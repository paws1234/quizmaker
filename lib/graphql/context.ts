import { createHash, timingSafeEqual } from 'node:crypto';
import { GraphQLError } from 'graphql';

/**
 * Builder authentication.
 *
 * One shared token (`ADMIN_TOKEN`) unlocks the builder and every admin
 * operation. The browser receives it once at /builder, and it travels back as
 * an httpOnly, SameSite=strict cookie; scripts and other origins cannot read or
 * replay it. If the token is not configured the builder fails closed instead of
 * silently opening up.
 */

export const ADMIN_COOKIE = 'quiz_admin';

export type GraphQLContext = {
  isAdmin: boolean;
};

export type Session = {
  isAdmin: boolean;
  /** False when the server has no ADMIN_TOKEN: nobody can sign in. */
  configured: boolean;
};

function expectedToken(): string | null {
  const token = process.env.ADMIN_TOKEN?.trim();
  return token ? token : null;
}

/** Constant-time comparison over fixed-length digests (never compares lengths). */
function tokensMatch(candidate: string, expected: string): boolean {
  const a = createHash('sha256').update(candidate).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function isAdminToken(candidate: string | null | undefined): boolean {
  const expected = expectedToken();
  if (!expected || !candidate) return false;
  return tokensMatch(candidate, expected);
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}

export function authenticate(request: Request): GraphQLContext {
  const token = request.headers.get('x-admin-token') ?? readCookie(request, ADMIN_COOKIE);
  return { isAdmin: isAdminToken(token) };
}

export function sessionFor(request: Request): Session {
  const token = request.headers.get('x-admin-token') ?? readCookie(request, ADMIN_COOKIE);
  return { isAdmin: isAdminToken(token), configured: expectedToken() !== null };
}

export function requireAdmin(context: GraphQLContext): void {
  if (!context.isAdmin) {
    throw new GraphQLError('An admin session is required. Sign in at /builder.', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }
}
